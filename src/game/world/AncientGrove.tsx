import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Toon, Ink, enhanceToon, getGradient, windTime } from '../materials';
import { getPuffGeometry } from '../foliageGeometry';
import { Torii } from './Buildings';
import { StoneLantern } from './Props';
import { usePondMaterial } from './EastDistrict';
import { FenceLine, DistrictGate } from './districtParts';
import { DistanceCull } from '../DistanceCull';
import {
  SOUTH_FENCE, SOUTH_GATE, STREAM, LOG_BRIDGE, STREAM_STONES, ANCIENT, MEADOW, LEDGES, GROVE_TORII, cedarSpots, southFree,
} from '../../data/south';
import { Rock } from './Rock';

/**
 * Bosque Antigo (art audit §26): tall cedars (instanced: two draw calls for the whole forest), a stream
 * with a log bridge, the deer meadow and its fairy ring, climbable ledges and the Ancient Tree.
 */

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const MOSS = '#5E8F48';

// ── Cedars ──────────────────────────────────────────────────────────────────

/**
 * Sugi crown: five stacked tiers, each a little off-centre and turned, with a ragged rim (vertices pushed
 * in and out) so the silhouette reads as needles rather than a smooth cone; darker under each tier.
 */
function cedarCrownGeometry() {
  const r = seeded(919);
  const tiers = [
    { r: 1.0, h: 1.5, y: 2.5 },
    { r: 0.88, h: 1.45, y: 3.35 },
    { r: 0.72, h: 1.35, y: 4.15 },
    { r: 0.52, h: 1.2, y: 4.9 },
    { r: 0.32, h: 1.05, y: 5.55 },
  ];
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  tiers.forEach((t) => {
    const g = new THREE.ConeGeometry(t.r, t.h, 10, 1);
    const p = g.getAttribute('position');
    const jag = Array.from({ length: 11 }, () => 0.82 + r() * 0.3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < t.h / 2 - 0.01) {
        // the rim: ragged, and drooping a little where it sticks out
        const ang = Math.atan2(p.getZ(i), p.getX(i));
        const k = jag[Math.round(((ang + Math.PI) / (Math.PI * 2)) * 10) % 11];
        p.setXYZ(i, p.getX(i) * k, y - (k - 0.9) * 0.35, p.getZ(i) * k);
      }
    }
    g.rotateY(r() * 6.28);
    g.translate((r() - 0.5) * 0.12, t.y, (r() - 0.5) * 0.12);
    g.computeVertexNormals();
    const ng = g.toNonIndexed();
    const pp = ng.getAttribute('position');
    const nn = ng.getAttribute('normal');
    for (let i = 0; i < pp.count; i++) {
      pos.push(pp.getX(i), pp.getY(i), pp.getZ(i));
      nor.push(nn.getX(i), nn.getY(i), nn.getZ(i));
      const k = THREE.MathUtils.clamp((pp.getY(i) - (t.y - t.h / 2)) / t.h, 0, 1);
      const v = 0.6 + 0.4 * k;
      col.push(v, v, v);
    }
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

function Cedars() {
  const spots = useMemo(() => cedarSpots(), []);
  const { trunks, crowns } = useMemo(() => {
    const trunkMat = new THREE.MeshToonMaterial({ gradientMap: getGradient(), color: '#5C4838' });
    enhanceToon(trunkMat, false);
    const crownMat = new THREE.MeshToonMaterial({ gradientMap: getGradient(), vertexColors: true });
    enhanceToon(crownMat, false);
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.24, 3.4, 7);
    trunkGeo.translate(0, 1.7, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const crowns = new THREE.InstancedMesh(cedarCrownGeometry(), crownMat, spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const greens = ['#46845A', '#3B7350', '#52905E', '#356B48', '#5A9A5E'];
    spots.forEach((sp, i) => {
      const r = seeded(sp.seed * 31 + 5);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      const sy = sp.s * (1 + r() * 0.25);
      m.compose(new THREE.Vector3(sp.x, 0, sp.z), q, new THREE.Vector3(sp.s, sy, sp.s));
      trunks.setMatrixAt(i, m);
      crowns.setMatrixAt(i, m);
      crowns.setColorAt(i, c.set(greens[i % greens.length]));
    });
    for (const mesh of [trunks, crowns]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.dynamic = true;
      mesh.computeBoundingSphere();
    }
    return { trunks, crowns };
  }, [spots]);
  useEffect(() => () => {
    for (const mesh of [trunks, crowns]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }, [trunks, crowns]);
  return (
    <group>
      <primitive object={trunks} />
      <primitive object={crowns} />
      <RigidBody type="fixed" colliders={false}>
        {spots.map((sp, i) => <CylinderCollider key={i} args={[1.6, 0.3 * sp.s]} position={[sp.x, 1.6, sp.z]} />)}
      </RigidBody>
    </group>
  );
}

/** Mossy boulders and ferns between the cedars (static). */
function ForestFloor() {
  const { rocks, ferns } = useMemo(() => {
    const r = seeded(2121);
    const rocks: { p: [number, number, number]; s: number; rot: number }[] = [];
    const ferns: { p: [number, number, number]; s: number; rot: number }[] = [];
    for (let i = 0; i < 140 && (rocks.length < 22 || ferns.length < 60); i++) {
      const x = -18 + r() * 36;
      const z = 41 + r() * 22;
      if (!southFree(x, z, 0)) continue;
      if (rocks.length < 22 && i % 3 === 0) rocks.push({ p: [x, 0, z], s: 0.35 + r() * 0.5, rot: r() * 6 });
      else if (ferns.length < 60) ferns.push({ p: [x, 0, z], s: 0.25 + r() * 0.2, rot: r() * 6 });
    }
    return { rocks, ferns };
  }, []);
  return (
    <>
      {rocks.map((b, i) => (
        <group key={i} position={b.p} rotation={[0, b.rot, 0]}>
          {/* moss is baked on the faces turned to the sky (was a green cap sitting on top) */}
          <Rock variant={i % 6} moss position={[0, b.s * 0.55, 0]} rotation={[0.2, 0, 0.12]} scale={[b.s * 1.2, b.s * 0.95, b.s]} color={i % 2 ? '#86867C' : '#7A7B72'} castShadow receiveShadow />
          {b.s > 0.6 && (
            <RigidBody type="fixed" colliders={false}>
              <CylinderCollider args={[b.s * 0.45, b.s * 0.9]} position={[0, b.s * 0.45, 0]} />
            </RigidBody>
          )}
        </group>
      ))}
      {ferns.map((f, i) => (
        <mesh key={i} position={[f.p[0], f.s * 0.45, f.p[2]]} scale={[f.s * 1.5, f.s * 0.9, f.s * 1.5]} rotation={[0, f.rot, 0]} geometry={getPuffGeometry(i, 'tiny')} dispose={null}>
          <Toon color={i % 3 ? '#4A8442' : '#5A9A4A'} vertexColors />
        </mesh>
      ))}
    </>
  );
}

// ── Stream, log bridge, stones ──────────────────────────────────────────────

function Stream() {
  const water = usePondMaterial('#C8EDE2', '#5FA8B8');
  const len = SOUTH_FENCE.maxX - SOUTH_FENCE.minX;
  const banks = useMemo(() => {
    const r = seeded(4545);
    const out: { p: [number, number, number]; s: number; rot: number }[] = [];
    for (const side of [-1, 1]) {
      for (let x = SOUTH_FENCE.minX + 0.4; x < SOUTH_FENCE.maxX; x += 0.9 + r() * 0.7) {
        if (Math.abs(x - LOG_BRIDGE.x) < 0.7) continue;
        out.push({ p: [x, 0.06, STREAM.z + side * (STREAM.halfWidth + 0.12)], s: 0.18 + r() * 0.14, rot: r() * 6 });
      }
    }
    return out;
  }, []);
  return (
    <group>
      {/* a long, thin plane; the shader's radial depth is replaced by its uv, so it reads as a shallow brook */}
      <mesh position={[0, 0.03, STREAM.z]} rotation={[-Math.PI / 2, 0, 0]} userData={{ dynamic: true }}>
        <planeGeometry args={[len, STREAM.halfWidth * 2]} />
        <primitive object={water} attach="material" />
      </mesh>
      {banks.map((b, i) => (
        <Rock key={i} variant={i % 5} kind="flat" position={b.p} rotation={[0, b.rot, 0]} scale={[b.s * 1.4, b.s * 0.9, b.s]} color={i % 3 ? '#9A9184' : '#7F776B'} receiveShadow />
      ))}
      {/* the fallen log, with a flat walking top */}
      <RigidBody type="fixed" colliders={false} userData={{ surface: 'wood' }}>
        <CuboidCollider args={[LOG_BRIDGE.halfWidth, LOG_BRIDGE.h / 2, (LOG_BRIDGE.z1 - LOG_BRIDGE.z0) / 2]} position={[LOG_BRIDGE.x, LOG_BRIDGE.h / 2, (LOG_BRIDGE.z0 + LOG_BRIDGE.z1) / 2]} />
      </RigidBody>
      <mesh position={[LOG_BRIDGE.x, LOG_BRIDGE.h * 0.55, (LOG_BRIDGE.z0 + LOG_BRIDGE.z1) / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[LOG_BRIDGE.halfWidth, LOG_BRIDGE.halfWidth + 0.04, LOG_BRIDGE.z1 - LOG_BRIDGE.z0, 12]} />
        <Toon color="#7A5A44" tex="bark" />
        <Ink thickness={0.02} />
      </mesh>
      {[LOG_BRIDGE.z0, LOG_BRIDGE.z1].map((z) => (
        <mesh key={z} position={[LOG_BRIDGE.x, LOG_BRIDGE.h * 0.55, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[LOG_BRIDGE.halfWidth - 0.02, LOG_BRIDGE.halfWidth - 0.02, 0.02, 12]} />
          <Toon color="#C9A27A" />
        </mesh>
      ))}
      <mesh position={[LOG_BRIDGE.x + 0.2, LOG_BRIDGE.h + 0.08, (LOG_BRIDGE.z0 + LOG_BRIDGE.z1) / 2 - 0.6]} scale={[0.3, 0.12, 0.5]}>
        <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Toon color={MOSS} />
      </mesh>
      {STREAM_STONES.map((p, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={p}>
          <CylinderCollider args={[0.12, 0.45]} position={[0, 0.12, 0]} />
          <mesh position={[0, 0.11, 0]} scale={[1, 1, 0.85]} rotation={[0, i, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.45, 0.52, 0.24, 9]} />
            <Toon color="#9A9184" />
            <Ink thickness={0.015} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

// ── The Ancient Tree ────────────────────────────────────────────────────────

/**
 * The Ancient Tree's trunk: a lathe that flares wide at the foot and narrows as it climbs, twisted and
 * lumpy (radius modulated by angle and height), with vertex colors darker in the bark's furrows.
 */
function ancientTrunkGeometry(trunk: number) {
  const prof: [number, number][] = [[1.55, 0], [1.25, 0.35], [1.05, 0.9], [0.98, 1.8], [0.92, 2.8], [0.84, 3.7], [0.72, 4.6], [0.6, 5.4], [0.5, 6.0]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * trunk, y)), 28);
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ang = Math.atan2(z, x) + y * 0.18; // a slow twist up the trunk
    const lump = 1 + 0.09 * Math.sin(ang * 5) + 0.05 * Math.sin(ang * 11 + y * 2.1) + 0.06 * Math.sin(y * 1.7 + ang * 2);
    pos.setX(i, x * lump);
    pos.setZ(i, z * lump);
    const furrow = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(ang * 14));
    const v = furrow * (0.9 + 0.1 * Math.min(1, y / 2));
    col.set([v, v, v], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function AncientTree() {
  const { x, z, trunk, mound, moundH } = ANCIENT;
  const trunkGeo = useMemo(() => ancientTrunkGeometry(trunk), [trunk]);
  useEffect(() => () => trunkGeo.dispose(), [trunkGeo]);
  // buttress roots: long, low humps that run out from the trunk and sink into the mound
  const roots = useMemo(() => Array.from({ length: 7 }).map((_, i) => ({ a: (i / 7) * Math.PI * 2 + 0.25 + (i % 2) * 0.2, len: 1.5 + (i % 3) * 0.35 })), []);
  // low, wide branches, so the canopy spreads over the mound and shows from the play camera
  const branches = useMemo(() => [0.2, 1.25, 2.3, 3.3, 4.3, 5.35].map((a, i) => ({ a, y: 3.0 + (i % 3) * 0.6, tilt: 1.15 + (i % 2) * 0.15, len: 3.0 + (i % 3) * 0.5 })), []);
  const crown = useMemo(() => {
    const r = seeded(7070);
    const out: { p: [number, number, number]; s: number; c: string }[] = [];
    // a puff cluster at each branch tip, then a dome over the middle
    branches.forEach((b, i) => {
      const reach = Math.sin(b.tilt) * b.len;
      const tipY = b.y + Math.cos(b.tilt) * b.len;
      for (let k = 0; k < 2; k++) {
        out.push({ p: [Math.cos(b.a) * (reach + 0.3 + k * 0.6), tipY + 0.6 + k * 0.5 + r() * 0.4, -Math.sin(b.a) * (reach + 0.3 + k * 0.6)], s: 1.35 + r() * 0.5, c: ['#3F7A4A', '#4A8452', '#5E9A4A', '#356B40'][(i + k) % 4] });
      }
    });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const ring = i === 0 ? 0 : 1.8;
      out.push({ p: [Math.cos(a) * ring, 6.6 + r() * 0.8, Math.sin(a) * ring], s: 1.7 + r() * 0.5, c: ['#4A8452', '#5E9A4A', '#3F7A4A'][i % 3] });
    }
    return out;
  }, [branches]);
  return (
    <group position={[x, 0, z]}>
      {/* the mound: a low step ring, then the grassy top */}
      <RigidBody type="fixed" colliders={false} userData={{ surface: 'stone' }}>
        <CylinderCollider args={[moundH / 4, mound + 0.55]} position={[0, moundH / 4, 0]} />
        <CylinderCollider args={[moundH / 2, mound]} position={[0, moundH / 2, 0]} />
        <CylinderCollider args={[0.6, trunk * 1.45]} position={[0, moundH + 0.6, 0]} />
        <CylinderCollider args={[3.5, trunk * 1.05]} position={[0, moundH + 3.5, 0]} />
      </RigidBody>
      <mesh position={[0, moundH / 4, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[mound + 0.55, mound + 0.7, moundH / 2, 36]} />
        <Toon color="#8E877C" />
      </mesh>
      <mesh position={[0, moundH / 2, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[mound, mound + 0.1, moundH, 36]} />
        <Toon color="#7A6A50" />
      </mesh>
      <mesh position={[0, moundH + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[mound - 0.05, 36]} />
        <Toon color="#6FA350" />
      </mesh>
      <group position={[0, moundH, 0]}>
        <mesh geometry={trunkGeo} castShadow receiveShadow>
          <Toon color="#7A5A44" vertexColors />
          <Ink thickness={0.03} />
        </mesh>
        {roots.map((rt, i) => (
          <mesh key={i} position={[Math.cos(rt.a) * (trunk + rt.len * 0.35), 0.12, -Math.sin(rt.a) * (trunk + rt.len * 0.35)]} rotation={[0, rt.a, 0.18]} scale={[rt.len, 0.38, 0.42]} castShadow receiveShadow>
            <sphereGeometry args={[0.7, 12, 8]} />
            <Toon color="#6A4E3C" />
          </mesh>
        ))}
        {branches.map((b, i) => (
          <group key={i} position={[0, b.y, 0]} rotation={[0, b.a, 0]}>
            <mesh position={[Math.sin(b.tilt) * b.len * 0.5, Math.cos(b.tilt) * b.len * 0.5, 0]} rotation={[0, 0, -b.tilt]} castShadow>
              <cylinderGeometry args={[0.14, 0.36, b.len, 8]} />
              <Toon color="#6A4E3C" tex="bark" />
            </mesh>
          </group>
        ))}
        {crown.map((c, i) => (
          <mesh key={i} position={c.p} scale={[c.s, c.s * 0.7, c.s]} rotation={[0, i * 1.7, 0]} geometry={getPuffGeometry(i, 'low')} dispose={null} castShadow>
            <Toon color={c.c} wind vertexColors />
          </mesh>
        ))}
        {/* moss on the north side of the foot, a little hollow, and the sacred rope with paper streamers */}
        <mesh position={[0.2, 0.7, -trunk * 1.05]} scale={[0.9, 0.5, 0.25]}>
          <sphereGeometry args={[1, 12, 8]} />
          <Toon color={MOSS} />
        </mesh>
        <mesh position={[trunk * 0.98, 1.0, 0.25]} rotation={[0, Math.PI / 2, 0]} scale={[0.32, 0.46, 0.1]}>
          <sphereGeometry args={[1, 10, 8]} />
          <Toon color="#2A1D16" />
        </mesh>
        <mesh position={[0, 1.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[trunk * 1.02, 0.1, 8, 40]} />
          <Toon color="#E8D9A8" />
        </mesh>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <group key={i} position={[Math.cos(a) * (trunk * 1.06), 1.62, Math.sin(a) * (trunk * 1.06)]} rotation={[0, -a + Math.PI / 2, 0]}>
              {/* shide: a zigzag of three paper steps */}
              {[0, 1, 2].map((k) => (
                <mesh key={k} position={[(k % 2) * 0.05, -k * 0.13, 0]}>
                  <planeGeometry args={[0.1, 0.14]} />
                  <Toon color="#FFFFFF" side={THREE.DoubleSide} />
                </mesh>
              ))}
            </group>
          );
        })}
      </group>
      {/* perched near the end of a branch */}
      <DistanceCull center={[x, 0, z]} far={30}>
        <Owl position={[Math.cos(branches[1].a) * 2.6, moundH + branches[1].y + 1.1, -Math.sin(branches[1].a) * 2.6]} />
      </DistanceCull>
      <StoneLantern position={[-2.4, moundH, -2.9]} />
      <StoneLantern position={[2.6, moundH, -2.7]} />
    </group>
  );
}

function Owl({ position }: { position: [number, number, number] }) {
  const head = useRef<THREE.Group>(null);
  const lids = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = windTime.value;
    if (head.current) head.current.rotation.y = Math.sin(t * 0.4) * 0.9;
    if (lids.current) lids.current.scale.y = (t % 4) > 3.85 ? 1 : 0.01;
  });
  return (
    <group position={position} userData={{ dynamic: true }}>
      <mesh position={[0, 0.2, 0]} scale={[1, 1.2, 0.9]} castShadow>
        <sphereGeometry args={[0.2, 12, 10]} />
        <Toon color="#8C6A4A" />
        <Ink thickness={0.012} />
      </mesh>
      <group ref={head} position={[0, 0.5, 0]}>
        <mesh scale={[1.1, 0.95, 1]}>
          <sphereGeometry args={[0.17, 12, 10]} />
          <Toon color="#9C7A58" />
        </mesh>
        {[-0.07, 0.07].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.02, 0.14]}>
              <sphereGeometry args={[0.05, 10, 8]} />
              <Toon color="#F2C14E" />
            </mesh>
            <mesh position={[x, 0.02, 0.18]}>
              <sphereGeometry args={[0.022, 8, 6]} />
              <Toon color="#1E1A16" />
            </mesh>
            <mesh position={[x, 0.17, 0]} rotation={[0, 0, x > 0 ? -0.3 : 0.3]}>
              <coneGeometry args={[0.04, 0.12, 5]} />
              <Toon color="#7A5A3E" />
            </mesh>
          </group>
        ))}
        <group ref={lids}>
          {[-0.07, 0.07].map((x) => (
            <mesh key={x} position={[x, 0.02, 0.16]}>
              <sphereGeometry args={[0.055, 10, 8]} />
              <Toon color="#8C6A4A" />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

// ── Meadow, deer, ledges ────────────────────────────────────────────────────

function FairyRing() {
  const shrooms = useMemo(() => {
    const r = seeded(6161);
    return Array.from({ length: 15 }).map((_, i) => {
      const a = (i / 15) * Math.PI * 2 + r() * 0.2;
      const rr = 2.2 + r() * 0.3;
      return { p: [MEADOW.x + Math.cos(a) * rr, 0, MEADOW.z + Math.sin(a) * rr] as [number, number, number], s: 0.7 + r() * 0.6 };
    });
  }, []);
  return (
    <>
      {shrooms.map((m, i) => (
        <group key={i} position={m.p} scale={m.s}>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.035, 0.045, 0.18, 6]} />
            <Toon color="#F4EEDF" />
          </mesh>
          <mesh position={[0, 0.19, 0]} scale={[1, 0.6, 1]}>
            <sphereGeometry args={[0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Toon color={i % 4 ? '#D2402F' : '#E8A03A'} emissive="#FF7A4A" emissiveIntensity={0.18} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** A small family of sika deer: they graze (head down), look up, and graze again. */
function Deer() {
  const group = useRef<THREE.Group>(null);
  const herd = useMemo(() => [
    { x: MEADOW.x - 1.0, z: MEADOW.z + 0.6, rot: 0.6, s: 1, phase: 0 },
    { x: MEADOW.x + 1.2, z: MEADOW.z + 1.2, rot: 2.4, s: 0.92, phase: 1.7 },
    { x: MEADOW.x + 0.2, z: MEADOW.z - 1.1, rot: -1.0, s: 0.6, phase: 3.1 },
  ], []);
  useFrame(() => {
    group.current?.children.forEach((d, i) => {
      const h = herd[i];
      const t = (windTime.value * 0.25 + h.phase) % 3;
      const neck = d.children[1];
      if (neck) neck.rotation.z = t < 2 ? -0.9 + Math.sin(windTime.value * 3 + i) * 0.05 : -0.9 + Math.min(1, (t - 2) * 3) * 0.9 * Math.sin((t - 2) * Math.PI);
    });
  });
  return (
    <group ref={group} userData={{ dynamic: true }}>
      {herd.map((h, i) => (
        <group key={i} position={[h.x, 0, h.z]} rotation={[0, h.rot, 0]} scale={h.s}>
          {/* body and legs */}
          <group>
            <mesh position={[0, 0.62, 0]} scale={[1.5, 0.82, 0.8]} castShadow>
              <sphereGeometry args={[0.3, 12, 9]} />
              <Toon color="#B07A4A" />
              <Ink thickness={0.012} />
            </mesh>
            {[[-0.26, -0.11], [-0.26, 0.11], [0.28, -0.11], [0.28, 0.11]].map(([lx, lz], k) => (
              <mesh key={k} position={[lx, 0.22, lz]}>
                <cylinderGeometry args={[0.05, 0.035, 0.46, 6]} />
                <Toon color="#8C5E3A" />
              </mesh>
            ))}
            {/* white spots and tail */}
            {[[-0.1, 0.84, 0.12], [0.1, 0.86, -0.1], [0.05, 0.87, 0.08], [-0.2, 0.82, -0.08]].map((p, k) => (
              <mesh key={k} position={p as [number, number, number]}>
                <sphereGeometry args={[0.035, 6, 4]} />
                <Toon color="#F4EEDF" />
              </mesh>
            ))}
            <mesh position={[-0.44, 0.72, 0]}>
              <sphereGeometry args={[0.06, 8, 6]} />
              <Toon color="#F4EEDF" />
            </mesh>
          </group>
          {/* neck + head, pivoting at the shoulder */}
          <group position={[0.34, 0.78, 0]} rotation={[0, 0, -0.9]}>
            <mesh position={[0.14, 0.12, 0]} rotation={[0, 0, -0.9]}>
              <cylinderGeometry args={[0.06, 0.09, 0.36, 6]} />
              <Toon color="#B07A4A" />
            </mesh>
            <mesh position={[0.3, 0.26, 0]} scale={[1.4, 0.9, 0.85]}>
              <sphereGeometry args={[0.1, 10, 8]} />
              <Toon color="#B07A4A" />
            </mesh>
            <mesh position={[0.43, 0.24, 0]}>
              <sphereGeometry args={[0.03, 6, 4]} />
              <Toon color="#2A2228" />
            </mesh>
            {[-0.06, 0.06].map((ez) => (
              <mesh key={ez} position={[0.24, 0.36, ez * 1.4]} rotation={[ez * 8, 0, 0.3]}>
                <coneGeometry args={[0.035, 0.12, 5]} />
                <Toon color="#9C6A42" />
              </mesh>
            ))}
            {i === 0 && [-0.05, 0.05].map((ez) => (
              <mesh key={`a${ez}`} position={[0.26, 0.48, ez]} rotation={[ez * 6, 0, -0.2]}>
                <cylinderGeometry args={[0.012, 0.018, 0.26, 4]} />
                <Toon color="#D9C9A8" />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}

function Ledges() {
  return (
    <>
      {LEDGES.map((l, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[l.x, 0, l.z]} userData={{ surface: 'stone' }}>
          <CylinderCollider args={[l.h / 2, l.r]} position={[0, l.h / 2, 0]} />
          {/* two faceted rock blocks stacked (the collider is the plain cylinder under them) */}
          <Rock variant={i * 2} position={[0, l.h * 0.3, 0]} rotation={[0.1, i * 1.3, 0.05]} scale={[l.r * 1.12, l.h * 0.5, l.r * 1.05]} color={i % 2 ? '#86867C' : '#7A7B72'} ink={0.025} castShadow receiveShadow />
          <Rock variant={i * 2 + 1} moss position={[0, l.h * 0.68, 0]} rotation={[0, i * 2.1 + 0.6, 0]} scale={[l.r * 1.0, l.h * 0.4, l.r * 0.98]} color={i % 2 ? '#7E7F76' : '#8A8A80'} ink={0.025} castShadow receiveShadow />
          {/* fallen rocks at the foot, so the pillar reads as a rock outcrop and not a cut stump */}
          {[0.4, 2.5, 4.4].map((ang, k) => (
            <Rock key={k} variant={k + i * 3} kind="pebble" position={[Math.cos(ang + i) * l.r * 1.05, 0.16 + k * 0.03, Math.sin(ang + i) * l.r * 1.05]} rotation={[0, ang, 0.15]} scale={[0.42 - k * 0.06, 0.36, 0.36]} color={k % 2 ? '#8E8E84' : '#76776E'} castShadow />
          ))}
          <mesh position={[0, l.h * 0.93, 0]} scale={[l.r * 0.9, 0.16, l.r * 0.9]}>
            <sphereGeometry args={[1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Toon color={MOSS} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}

/** A soft mossy tint over the grass under the canopy, so the forest floor reads darker than the village lawn. */
function ForestTint() {
  return (
    <mesh position={[0, 0.012, (40 + SOUTH_FENCE.maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[SOUTH_FENCE.maxX - SOUTH_FENCE.minX, SOUTH_FENCE.maxZ - 40]} />
      <meshToonMaterial color="#4E7E3E" transparent opacity={0.5} depthWrite={false} />
    </mesh>
  );
}

export function AncientGrove() {
  return (
    <group>
      <ForestTint />
      <FenceLine a={[SOUTH_FENCE.minX, 39.8]} b={[SOUTH_FENCE.minX, SOUTH_FENCE.maxZ]} />
      <FenceLine a={[SOUTH_FENCE.maxX, 39.8]} b={[SOUTH_FENCE.maxX, SOUTH_FENCE.maxZ]} />
      <FenceLine a={[SOUTH_FENCE.minX, SOUTH_FENCE.maxZ]} b={[SOUTH_FENCE.maxX, SOUTH_FENCE.maxZ]} />
      <DistrictGate x={SOUTH_GATE.x} z={SOUTH_GATE.z} halfWidth={SOUTH_GATE.halfWidth} roof="#3F6B4A" lantern="#E8B33A" alongX />
      <Cedars />
      <ForestFloor />
      <Stream />
      <AncientTree />
      <Torii position={GROVE_TORII} />
      <FairyRing />
      <Ledges />
      <StoneLantern position={[-0.6, 0, 44.6]} />
      <StoneLantern position={[3.6, 0, 45.2]} />
      <DistanceCull center={[MEADOW.x, 0, MEADOW.z]} far={26}>
        <Deer />
        <Sparkles count={40} scale={[14, 2.5, 10]} position={[MEADOW.x + 3, 1.2, MEADOW.z - 2]} size={3} speed={0.3} color="#F6F0A0" opacity={0.7} />
      </DistanceCull>
    </group>
  );
}
