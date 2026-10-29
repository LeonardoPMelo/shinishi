import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useLighting } from '../timeOfDay';

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 top;
  uniform vec3 mid;
  uniform vec3 horizon;
  uniform vec3 sunDir;
  uniform vec3 sunGlow;
  void main() {
    float h = vDir.y;
    vec3 col = mix(horizon, mid, smoothstep(-0.05, 0.22, h));
    col = mix(col, top, smoothstep(0.22, 0.85, h));
    float sun = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
    col += sunGlow * pow(sun, 8.0) * 0.45;
    col += vec3(1.0, 0.98, 0.9) * smoothstep(0.9975, 0.999, sun) * 1.2;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const PUFFS: [number, number, number, number][] = [
  [0, 0, 0, 1.6], [1.8, 0.35, 0.2, 1.3], [-1.7, 0.1, -0.2, 1.2],
  [0.8, 1.0, 0, 1.1], [-0.6, 0.85, 0.3, 1.0], [3.0, -0.1, 0, 0.9], [-3, -0.15, 0.1, 0.8],
];

/** One instanced mesh for every cloud puff: cheap, soft, always bright. */
function Clouds({ color }: { color: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const clouds = useMemo(() => {
    const out: { pos: THREE.Vector3; scale: number }[] = [];
    let s = 3;
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + r() * 0.3;
      const d = 75 + r() * 35;
      out.push({ pos: new THREE.Vector3(Math.cos(a) * d, 30 + r() * 22, 10 + Math.sin(a) * d), scale: 2.4 + r() * 2.2 });
    }
    return out;
  }, []);
  const count = clouds.length * PUFFS.length;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const drift = useRef(0);

  useFrame((_s, d) => {
    if (!mesh.current) return;
    drift.current += d * 0.6;
    let i = 0;
    for (const c of clouds) {
      const x = ((c.pos.x + drift.current + 130) % 260) - 130;
      for (const [px, py, pz, pr] of PUFFS) {
        dummy.position.set(x + px * c.scale, c.pos.y + py * c.scale, c.pos.z + pz * c.scale);
        dummy.scale.set(pr * c.scale, pr * c.scale * 0.7, pr * c.scale * 0.8);
        dummy.updateMatrix();
        mesh.current.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial color={color} fog={false} />
    </instancedMesh>
  );
}

export function SkyDome() {
  const { sky } = useLighting();
  const uniforms = useMemo(() => ({
    top: { value: new THREE.Color() },
    mid: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3() },
    sunGlow: { value: new THREE.Color() },
  }), []);
  // the dome goes where the camera goes: inside the houses (built far east of the map, Etapa 4 da expansão)
  // the camera is beyond its 170 m radius and would see the outside of the sphere
  const dome = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (dome.current) dome.current.position.set(camera.position.x, 0, camera.position.z);
  });
  uniforms.top.value.set(sky.top);
  uniforms.mid.value.set(sky.mid);
  uniforms.horizon.value.set(sky.horizon);
  uniforms.sunDir.value.set(...sky.sunDir);
  uniforms.sunGlow.value.set(sky.sunGlow);

  return (
    <>
      <mesh ref={dome} scale={170}>
        <sphereGeometry args={[1, 32, 16]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
          uniforms={uniforms}
          vertexShader={skyVertex}
          fragmentShader={skyFragment}
        />
      </mesh>
      <Clouds color={sky.clouds} />
    </>
  );
}
