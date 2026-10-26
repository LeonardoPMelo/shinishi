import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { useUiSettings, AUTO_LADDER } from '../store/uiSettings';

/**
 * Final look: tone mapping made for the toon shading, warm/cool split toning, saturation and a soft vignette.
 *
 * Tone mapping (Etapa 3). The frame used to be clamped at 1, so the sunlit side of anything warm lost its
 * hue and detail: at sunset up to 8% of the pixels had one channel stuck at 255 (flat orange dirt, flat pink
 * cherry trees, white cats glowing). The standard film curves (ACES, AgX) fix that but also flatten the
 * toon look: they desaturate and lower contrast everywhere. This one leaves every channel below 0.8
 * untouched (the toon bands and the colors the art was painted with) and rolls each channel off above that
 * along a smooth shoulder that never reaches 1, so bright areas keep their variation instead of a flat 255.
 * Per channel on purpose: a shoulder on the luminance that pushes overflow toward white (tried first) also
 * turned yellow flowers and lit windows cream-white; per channel a yellow stays yellow, at the price of
 * very bright oranges leaning slightly toward yellow, the usual look of games.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uSat: { value: 1.12 }, uVignette: { value: 0.22 }, uTint: { value: new THREE.Vector3(1, 1, 1) },
    uExposure: { value: 1 }, uKnee: { value: 0.8 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSat, uVignette, uExposure, uKnee;
    uniform vec3 uTint;
    varying vec2 vUv;
    // per-channel shoulder: identity below the knee, asymptotic to 1 above it
    vec3 toneShoulder(vec3 c) {
      float w = 1.0 - uKnee;
      vec3 over = max(c - uKnee, 0.0);
      return min(c, vec3(uKnee)) + w * (1.0 - exp(-over / w));
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb = max(c.rgb, 0.0) * uExposure;
      c.rgb *= uTint; // time-of-day color (warm amber at sunset)
      // saturation before the curve, so the curve also catches what it pushes past 1
      float l0 = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = max(mix(vec3(l0), c.rgb, uSat), 0.0);
      c.rgb = toneShoulder(c.rgb);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      // split toning: lifted violet shadows, golden highlights
      c.rgb += mix(vec3(0.012, 0.0, 0.03), vec3(0.02, 0.012, -0.012), smoothstep(0.25, 0.85, l));
      c.rgb = clamp(c.rgb, 0.0, 1.0);
      c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.22);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.35, 0.85, length(d * vec2(1.1, 1.0)) * 1.4);
      gl_FragColor = c;
    }`,
};

/**
 * Last pass: enlarges the (possibly reduced-resolution) frame to the full canvas with a light
 * contrast-adaptive sharpen, then converts to the screen's color space. Letting the browser stretch a
 * small canvas looked soft and jagged; doing it here keeps edges crisp at 60–90% resolution.
 */
const UpscaleShader = {
  uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 768) }, uSharp: { value: 0.3 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform float uSharp;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb;
      vec3 s = texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y)).rgb;
      vec3 e = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb;
      vec3 w = texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.0)).rgb;
      // contrast-adaptive: sharpen less where the neighbourhood already has strong contrast (no halos)
      vec3 mn = min(c, min(min(n, s), min(e, w)));
      vec3 mx = max(c, max(max(n, s), max(e, w)));
      vec3 amp = clamp(min(mn, 1.0 - mx) / max(mx, 1e-4), 0.0, 1.0);
      vec3 wgt = -sqrt(amp) * uSharp * 0.25;
      vec3 col = clamp((c + (n + s + e + w) * wgt) / (1.0 + 4.0 * wgt), 0.0, 1.0);
      gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
    }`,
};

/**
 * Post-processing chain (Média, Alta and Automática). Renders into a multisampled target so edges stay
 * antialiased, adds bloom when the profile allows it and always applies the color grade.
 * Bloom and MSAA change in place (a pass flag, a target reallocation): no remount, no shader recompile.
 */
export function PostFX({ bloom, msaa, scale = 1, tint = [1, 1, 1], exposure = 1, saturation = 1.12 }: {
  bloom: boolean; msaa: 0 | 2 | 4; scale?: number; tint?: [number, number, number]; exposure?: number; saturation?: number;
}) {
  const { gl, scene, camera, size } = useThree();
  const dpr = useThree((st) => st.viewport.dpr);
  const passes = useRef<{ grade: ShaderPass; bloom: UnrealBloomPass; upscale: ShaderPass } | null>(null);
  const composer = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(size.width, size.height, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(gl, target);
    c.addPass(new RenderPass(scene, camera));
    // threshold above 1 (was 0.9): only lights glow (lanterns, windows, emissive props); sunlit white fur
    // stays fur instead of a glowing blob at midday (Etapa 3)
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(size.width / 2, size.height / 2), 0.45, 0.55, 1.05);
    c.addPass(bloomPass);
    const gradePass = new ShaderPass(GradeShader);
    c.addPass(gradePass);
    const upscale = new ShaderPass(UpscaleShader);
    c.addPass(upscale);
    passes.current = { grade: gradePass, bloom: bloomPass, upscale };
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  // the canvas stays at the screen's resolution; only the composer's internal targets shrink with `scale`
  useEffect(() => {
    const ratio = Math.min(dpr, 1.5) * scale;
    composer.setPixelRatio(ratio);
    composer.setSize(size.width, size.height);
    const up = passes.current?.upscale;
    if (up) {
      up.uniforms.uTexel.value.set(1 / (size.width * ratio), 1 / (size.height * ratio));
      up.uniforms.uSharp.value = scale < 0.95 ? 0.55 : 0.25;
    }
  }, [composer, size, dpr, scale]);

  useEffect(() => {
    if (passes.current) passes.current.bloom.enabled = bloom;
  }, [composer, bloom]);

  useEffect(() => {
    for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
      if (rt.samples === msaa) continue;
      rt.samples = msaa;
      rt.dispose(); // reallocated with the new sample count on the next render
    }
  }, [composer, msaa]);

  useEffect(() => () => composer.dispose(), [composer]);
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__postfx = { composer, THREE };
  }, [composer]);

  useEffect(() => {
    const grade = passes.current?.grade;
    if (!grade) return;
    grade.uniforms.uTint.value.set(...tint);
    grade.uniforms.uExposure.value = exposure;
    grade.uniforms.uSat.value = saturation;
  }, [composer, tint, exposure, saturation]);

  // Compile every material once, for the render target the scene really draws into, so walking into a
  // new area (or the first villager appearing) doesn't stall on shader compilation.
  useEffect(() => {
    const warm = () => {
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(composer.readBuffer);
      const done = gl.compileAsync ? gl.compileAsync(scene, camera) : Promise.resolve(gl.compile(scene, camera));
      gl.setRenderTarget(prev);
      return done.catch(() => undefined);
    };
    const t1 = setTimeout(warm, 1500);
    const t2 = setTimeout(warm, 8000); // again once the cast GLBs have loaded
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [gl, scene, camera, composer]);

  // Priority 1 takes over rendering from R3F for this frame.
  useFrame((_s, delta) => composer.render(delta), 1);
  return null;
}

/**
 * Automática: watches the frame rate and moves along AUTO_LADDER (uiSettings.ts). It steps down after
 * two slow windows and back up after three fast ones, so the picture recovers when the game runs well;
 * a step up that turns out too slow is not retried for a while. Only cheap knobs move (bloom, internal
 * resolution, MSAA, shadow-map size): shadows, lighting and the grade always stay on.
 */
export function AutoQuality() {
  const st = useRef({ frames: 0, elapsed: 0, slow: 0, fast: 0, settleUntil: 6, clock: 0, lastUp: -99, upBlockedUntil: 0 });

  useFrame((_s, delta) => {
    const ui = useUiSettings.getState();
    const s = st.current;
    if (ui.quality !== 'auto' || document.hidden || delta > 0.25) return; // pauses, tab switches, hitches
    s.clock += delta;
    if (s.clock < s.settleUntil) return; // ignore the frames right after loading or after a change
    s.frames++;
    s.elapsed += delta;
    if (s.elapsed < 2) return;
    const fps = s.frames / s.elapsed;
    s.frames = 0;
    s.elapsed = 0;
    s.slow = fps < 45 ? s.slow + 1 : 0;
    s.fast = fps > 56 ? s.fast + 1 : 0;
    const level = ui.autoLevel;
    if (s.slow >= 2 && level < AUTO_LADDER.length - 1) {
      // a step up that didn't hold: stay put longer before trying again
      if (s.clock - s.lastUp < 12) s.upBlockedUntil = s.clock + 90;
      ui.setAutoLevel(level + 1);
      s.slow = 0;
      s.fast = 0;
      s.settleUntil = s.clock + 3;
    } else if (s.fast >= 3 && level > 0 && s.clock > s.upBlockedUntil) {
      ui.setAutoLevel(level - 1);
      s.lastUp = s.clock;
      s.slow = 0;
      s.fast = 0;
      s.settleUntil = s.clock + 3;
    }
  });
  return null;
}
