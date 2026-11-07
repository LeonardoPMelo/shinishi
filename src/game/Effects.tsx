import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { useUiSettings, AUTO_LADDER } from '../store/uiSettings';
import { useZone } from './systems/zone';

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
    let shadowCasters = -1;
    const warm = () => {
      // three's compile() only walks what is visible: everything a DistanceCull, a zone or a cutaway had hidden
      // (the clearing's deer, the temple's koi and waterfall, the wild lands, the interiors) compiled the first
      // time it came into view, a frame of a second or more. Shown for this call only, hidden again before any
      // frame is drawn.
      // Lights that are not lit now (a room's lamps while outdoors) stay out: a program is built for the number
      // of lights the frame has, and one built with them would never be the one drawn.
      const dark: THREE.Light[] = [];
      scene.traverse((o) => {
        if (!(o as THREE.Light).isLight) return;
        let shown = true;
        for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) shown = false;
        if (!shown) dark.push(o as THREE.Light);
      });
      const hidden: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if (!o.visible) {
          hidden.push(o);
          o.visible = true;
        }
      });
      const darkWas = dark.map((l) => l.visible);
      for (const l of dark) l.visible = false;
      const prev = gl.getRenderTarget();
      try {
        gl.setRenderTarget(composer.readBuffer);
        // compile() starts the same work compileAsync() does (programs link in the background where the driver
        // allows it); compileAsync's own polling threw "reading 'isReady'" from a timer, out of reach of any
        // catch, when a material swapped its program while it waited (a roof fading, a zone change)
        gl.compile(scene, camera);
        // the see-through version of what fades out of the camera's way (a roof between the camera and the cat:
        // three builds another program for a transparent material, and it did so on the first fade)
        const fading: THREE.Material[] = [];
        scene.traverse((o) => {
          if (!o.userData.fades) return;
          o.traverse((c) => {
            const m = (c as THREE.Mesh).material;
            if (m) for (const mm of Array.isArray(m) ? m : [m]) if (!mm.transparent) fading.push(mm);
          });
        });
        if (fading.length) {
          for (const m of fading) {
            m.transparent = true;
            m.needsUpdate = true;
          }
          gl.compile(scene, camera);
          for (const m of fading) {
            m.transparent = false;
            m.needsUpdate = true;
          }
        }
        // the shadow map's depth programs: three makes one per kind of caster (skinned, instanced, cut-out...)
        // the first time such a caster enters the sun's shadow box, which follows the cat. One shadow pass with
        // the box stretched over the whole map makes them all now.
        let sun: THREE.DirectionalLight | null = null;
        let casters = 0;
        scene.traverse((o) => {
          if ((o as THREE.DirectionalLight).isDirectionalLight && o.castShadow) sun = o as THREE.DirectionalLight;
          else if (o.castShadow && (o as THREE.Mesh).isMesh) casters++;
        });
        // (only when the casters changed: models that load late, a zone's own; the pass draws every one of them)
        if (sun && gl.shadowMap.enabled && casters !== shadowCasters) {
          shadowCasters = casters;
          const cam = (sun as THREE.DirectionalLight).shadow.camera;
          const saved = [cam.left, cam.right, cam.top, cam.bottom, cam.near, cam.far] as const;
          Object.assign(cam, { left: -700, right: 700, top: 700, bottom: -700, near: -1500, far: 1500 });
          cam.updateProjectionMatrix();
          const tiny = new THREE.WebGLRenderTarget(4, 4);
          gl.setRenderTarget(tiny);
          gl.shadowMap.needsUpdate = true;
          gl.render(scene, camera);
          [cam.left, cam.right, cam.top, cam.bottom, cam.near, cam.far] = saved;
          cam.updateProjectionMatrix();
          gl.shadowMap.needsUpdate = true;
          tiny.dispose();
        }
        // and the textures go up to the GPU now, not on the frame that first shows them
        const seen = new Set<THREE.Texture>();
        scene.traverse((o) => {
          const m = (o as THREE.Mesh).material;
          if (!m) return;
          for (const mat of Array.isArray(m) ? m : [m]) {
            for (const v of Object.values(mat)) {
              if (v instanceof THREE.Texture && !seen.has(v) && v.image) {
                seen.add(v);
                gl.initTexture(v);
              }
            }
          }
        });
      } finally {
        gl.setRenderTarget(prev);
        for (const o of hidden) o.visible = false;
        dark.forEach((l, i) => (l.visible = darkWas[i]));
        if (import.meta.env.DEV) {
          const w = window as unknown as { __warm?: { runs: number; hidden: number; programs: number } };
          w.__warm = { runs: (w.__warm?.runs ?? 0) + 1, hidden: hidden.length, programs: gl.info.programs?.length ?? 0 };
        }
      }
    };
    const timers = [1500, 8000, 20000].map((ms) => setTimeout(warm, ms)); // again as the cast's GLBs load
    // a zone change mounts what it shows (the wild lands' creatures, a room's models): warm those too, again
    // as the zone's models and grass arrive (one pass at 1.2 s still left 17 programs for the first walk)
    let zoneTimers: number[] = [];
    const unsub = useZone.subscribe((s, p) => {
      if (s.zone === p.zone) return;
      zoneTimers.forEach(clearTimeout);
      // the first one while the screen is still dark (the fade lasts 260 ms either side of the switch)
      zoneTimers = [150, 1200, 5000, 12000].map((ms) => window.setTimeout(warm, ms));
    });
    return () => {
      timers.forEach(clearTimeout);
      zoneTimers.forEach(clearTimeout);
      unsub();
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
    s.slow = fps < 45 ? s.slow + (fps < 30 ? 2 : 1) : 0; // far too slow (a phone at the top rung): step at once
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
