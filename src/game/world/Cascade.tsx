import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * A waterfall (the wild lands' north cliff, the village river's rock, the temple terrace): instead of a flat plane
 * with a scrolling picture of streaks,
 *  - a sheet that arcs out from the lip as it falls and widens a little toward the foot, drawn by a shader: two
 *    layers of streaks falling at different speeds, foam at the lip and at the foot, soft sides, the scene's fog;
 *  - foam puffs boiling at the foot, mist rising and thinning out, and rings spreading on the pool.
 * Four draws whatever its size (a roll of water over the lip read as a white pipe: the sheet's own foam band does it). Placed by the lip's middle; `yaw` turns the direction the water falls away to
 * (0: toward +z).
 */

const SHEET_VERT = /* glsl */ `
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const NOISE = /* glsl */ `
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
  }
`;

const SHEET_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uAspect;
  uniform vec3 uDeep;
  uniform vec3 uLight;
  uniform float uOpacity;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  ${NOISE}
  void main() {
    float u = vUv.x;
    float v = 1.0 - vUv.y; // 0 at the lip, 1 at the foot
    // the water speeds up as it falls: the streaks stretch toward the foot
    float fall = v * v * 0.6 + v * 0.4;
    float n1 = vnoise(vec2(u * 26.0 * uAspect, fall * 5.0 - uTime * 1.9));
    float n2 = vnoise(vec2(u * 52.0 * uAspect + 7.0, fall * 9.0 - uTime * 3.1));
    float streak = smoothstep(0.5, 0.9, n1 * 0.6 + n2 * 0.4);
    vec3 col = mix(uDeep, uLight, 0.35 + 0.45 * streak);
    // foam: a band over the lip, and the churn at the foot (both broken up)
    float churn = vnoise(vec2(u * 18.0 * uAspect, v * 4.0 - uTime * 2.4));
    float foam = (1.0 - smoothstep(0.0, 0.09, v)) * (0.6 + 0.4 * churn) + smoothstep(0.78, 0.98, v + churn * 0.08);
    col = mix(col, vec3(0.96, 0.99, 1.0), clamp(foam, 0.0, 1.0));
    // soft sides and a little see-through between the streaks
    float side = smoothstep(0.0, 0.1, u) * smoothstep(1.0, 0.9, u);
    float a = uOpacity * side * (0.72 + 0.28 * max(streak, foam));
    gl_FragColor = vec4(col, a);
    #include <fog_fragment>
  }
`;

const MIST_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform vec3 uSpread;
  attribute float aSeed;
  varying float vAlpha;
  #include <fog_pars_vertex>
  void main() {
    // each puff of mist is born at the foot, rises and drifts out, grows and fades, then starts again
    float life = fract(uTime * (0.16 + 0.08 * fract(aSeed * 7.3)) + aSeed);
    vec3 p = position;
    p.x += (fract(aSeed * 13.7) - 0.5) * uSpread.x * (0.6 + life);
    p.y += life * uSpread.y;
    p.z += life * uSpread.z * (0.4 + fract(aSeed * 3.1));
    vAlpha = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.45, 1.0, life));
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (0.6 + 1.2 * life) * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const MIST_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  #include <fog_pars_fragment>
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.2, 1.0, d)) * vAlpha * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(0.94, 0.98, 1.0, a);
    #include <fog_fragment>
  }
`;

const RING_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  void main() {
    // rings spreading out from the foot of the fall, fading as they go
    vec2 q = (vUv - 0.5) * 2.0;
    float d = length(q);
    float w = fract(d * 1.6 - uTime * 0.45);
    float ring = smoothstep(0.0, 0.08, w) * (1.0 - smoothstep(0.08, 0.2, w));
    float a = ring * (1.0 - smoothstep(0.35, 1.0, d)) * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(0.95, 0.99, 1.0, a);
    #include <fog_fragment>
  }
`;

function fogUniforms() {
  return THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
}

/** The sheet: from the lip (y 0) down to the foot (y -height), arcing out along +z by `bulge`. */
export function sheetGeometry(width: number, height: number, bulge: number) {
  const g = new THREE.PlaneGeometry(1, 1, 10, 28);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i); // -0.5..0.5
    const t = 0.5 - pos.getY(i); // 0 at the top, 1 at the bottom
    const arc = bulge * Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5);
    pos.setXYZ(i, u * width * (1 + 0.14 * t), -t * height, arc + 0.04 * Math.sin(u * 9 + t * 3));
  }
  g.computeVertexNormals();
  return g;
}

export function Cascade({
  position, height, width, yaw = 0, bulge = 0.6, mist = 1, deep = '#3E8FB8', light = '#BDE9FA', opacity = 0.92,
}: {
  position: [number, number, number]; height: number; width: number; yaw?: number; bulge?: number;
  /** How much spray and foam at the foot (1 for a big fall, less for a trickle). */
  mist?: number; deep?: string; light?: string; opacity?: number;
}) {
  const parts = useMemo(() => {
    const sheet = new THREE.ShaderMaterial({
      uniforms: { ...fogUniforms(), uTime: { value: 0 }, uAspect: { value: width / Math.max(1, height) * 1.6 }, uDeep: { value: new THREE.Color(deep) }, uLight: { value: new THREE.Color(light) }, uOpacity: { value: opacity } },
      vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    });
    const mistMat = new THREE.ShaderMaterial({
      uniforms: { ...fogUniforms(), uTime: { value: 0 }, uSize: { value: 0.7 + 0.45 * mist }, uSpread: { value: new THREE.Vector3(width * 0.9, 1.4 + height * 0.18, 1.2 + bulge) }, uOpacity: { value: 0.38 } },
      vertexShader: MIST_VERT, fragmentShader: MIST_FRAG, transparent: true, depthWrite: false, fog: true,
    });
    const ringMat = new THREE.ShaderMaterial({
      uniforms: { ...fogUniforms(), uTime: { value: 0 }, uOpacity: { value: 0.55 } },
      vertexShader: SHEET_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, fog: true,
    });
    // the foot: puffs of foam along the width
    const puffs = Math.max(4, Math.round(width * 4 * mist));
    const foamGeo = new THREE.IcosahedronGeometry(1, 1);
    // unlit: lit by the sunset, toon foam turned into pink pillows
    const foamMat = new THREE.MeshBasicMaterial({ color: '#EEF8FF', transparent: true, opacity: 0.9 });
    const foam = new THREE.InstancedMesh(foamGeo, foamMat, puffs);
    foam.frustumCulled = false;
    const n = Math.round(14 + 18 * mist * Math.min(2, width / 3));
    const mg = new THREE.BufferGeometry();
    const mp = new Float32Array(n * 3);
    const ms = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      mp.set([((i * 0.618) % 1 - 0.5) * width, -height + 0.2, bulge + 0.2], i * 3);
      ms[i] = (i * 0.7548) % 1;
    }
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    mg.setAttribute('aSeed', new THREE.BufferAttribute(ms, 1));
    // a generous bound: the puffs travel up and out from where they start
    mg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -height + 1, bulge + 1), Math.max(width, 3) + 2);
    return { sheet, mistMat, ringMat, foam, foamGeo, foamMat, puffs, mg, sheetGeo: sheetGeometry(width, height, bulge) };
  }, [width, height, bulge, mist, deep, light, opacity]);
  useEffect(() => () => {
    for (const d of [parts.sheet, parts.mistMat, parts.ringMat, parts.foamMat, parts.foamGeo, parts.mg, parts.sheetGeo]) d.dispose();
    parts.foam.dispose();
  }, [parts]);

  const m = useRef(new THREE.Matrix4());
  const q = useRef(new THREE.Quaternion());
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    parts.sheet.uniforms.uTime.value = t;
    parts.mistMat.uniforms.uTime.value = t;
    parts.ringMat.uniforms.uTime.value = t;
    // foam boiling: each puff swells and sinks on its own beat
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < parts.puffs; i++) {
      const u = (i + 0.5) / parts.puffs - 0.5;
      const beat = Math.sin(t * (2.6 + (i % 3) * 0.5) + i * 1.9);
      // sizes and places vary puff to puff (an even row read as a line of pillows)
      const big = 0.65 + 0.7 * (((i * 53) % 7) / 6);
      const r = (0.2 + 0.08 * beat) * big * (0.75 + 0.45 * Math.min(1, width / 3));
      p.set(u * width * 1.05 + (((i * 29) % 5) - 2) * 0.05, -height + r * 0.4 + 0.05 * beat, bulge + 0.05 + ((i * 37) % 7) * 0.08);
      s.set(r * 1.25, r * 0.8, r);
      m.current.compose(p, q.current, s);
      parts.foam.setMatrixAt(i, m.current);
    }
    parts.foam.instanceMatrix.needsUpdate = true;
  });

  const ring = Math.max(2.2, width * 1.1);
  return (
    <group position={position} rotation={[0, yaw, 0]} userData={{ dynamic: true }}>
      <mesh geometry={parts.sheetGeo} material={parts.sheet} renderOrder={2} />
      <primitive object={parts.foam} />
      <points geometry={parts.mg} material={parts.mistMat} renderOrder={3} />
      <mesh position={[0, -height + 0.045, bulge + ring * 0.42]} rotation={[-Math.PI / 2, 0, 0]} material={parts.ringMat} renderOrder={1}>
        <planeGeometry args={[ring * 2, ring * 2]} />
      </mesh>
    </group>
  );
}
