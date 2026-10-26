import { useMemo } from 'react';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Toon, Ink, enhanceToon, getGradient } from '../materials';
import { useGameStore } from '../../store/gameStore';
import { useEffectiveQuality, useUiSettings } from '../../store/uiSettings';

/**
 * The village market (references 11, 18 and 19): striped canopies with scalloped valances,
 * painted signs, paw lanterns, fish on ice, fruit baskets, a fish cart and a lantern string
 * over the market street. A crate stack leads to a secret chest on the fruit stall's canopy.
 */

const WOOD = '#7A5236';
const WOOD_DARK = '#4A2F20';
const WOOD_LIGHT = '#A57A50';

// ── Painted textures ─────────────────────────────────────────────────────────
function canvasTexture(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function drawPaw(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.25, s * 0.42, s * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy] of [[-0.42, -0.2], [-0.15, -0.48], [0.15, -0.48], [0.42, -0.2]]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s, s * 0.15, s * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

const lanternTextures = new Map<string, THREE.CanvasTexture>();
/** Paper lantern skin: ribbed paper with a cream paw print (reference 18 'Lanterna de papel'). */
function lanternTexture(color: string) {
  let t = lanternTextures.get(color);
  if (!t) {
    t = canvasTexture(256, 128, (ctx) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = 'rgba(80,20,10,0.35)';
      ctx.lineWidth = 2;
      for (let y = 10; y < 128; y += 14) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }
      drawPaw(ctx, 64, 66, 52, '#FFF2D6');
      drawPaw(ctx, 192, 66, 52, '#FFF2D6');
    });
    lanternTextures.set(color, t);
  }
  return t;
}

function stripeTexture(a: string, b: string) {
  const t = canvasTexture(256, 16, (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? a : b;
      ctx.fillRect(i * 32, 0, 32, 16);
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function signTexture(text: string, icon: 'fish' | 'fruit') {
  return canvasTexture(512, 192, (ctx) => {
    ctx.fillStyle = '#5A3A24';
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = '#3A2416';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 502, 182);
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = 'rgba(30,15,8,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 30 + i * 28);
      ctx.lineTo(502, 34 + i * 28);
      ctx.stroke();
    }
    ctx.fillStyle = '#FFF0D2';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 300, 98);
    if (icon === 'fish') {
      ctx.fillStyle = '#8FC7EE';
      ctx.beginPath();
      ctx.ellipse(78, 98, 46, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(30, 98);
      ctx.lineTo(8, 74);
      ctx.lineTo(8, 122);
      ctx.fill();
      ctx.fillStyle = '#1C2430';
      ctx.beginPath();
      ctx.arc(104, 92, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      for (const [x, y, c] of [[60, 108, '#E8553B'], [96, 108, '#F2B33D'], [78, 78, '#8BC34A']] as const) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawPaw(ctx, 470, 150, 28, 'rgba(255,240,210,0.6)');
  });
}

// ── Small pieces ─────────────────────────────────────────────────────────────
/** Glowing paper lantern with paw prints. */
export function PawLantern({ position, color = '#E0483A', scale = 1 }: { position: [number, number, number]; color?: string; scale?: number }) {
  const mat = useMemo(() => {
    const tex = lanternTexture(color);
    const m = new THREE.MeshToonMaterial({ map: tex, emissive: new THREE.Color('#FFB86B'), emissiveMap: tex, emissiveIntensity: 0.95, gradientMap: getGradient() });
    enhanceToon(m, false);
    return m;
  }, [color]);
  const body = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(new THREE.Vector2(0.06 + Math.sin(t * Math.PI) * 0.13, (t - 0.5) * 0.38));
    }
    return new THREE.LatheGeometry(pts, 18);
  }, []);
  return (
    <group position={position} scale={scale}>
      <mesh geometry={body} material={mat} />
      {[0.2, -0.2].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.045, 12]} />
          <Toon color="#1F1A22" />
        </mesh>
      ))}
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.012, 0.004, 0.14, 5]} />
        <Toon color="#E0483A" />
      </mesh>
    </group>
  );
}

function Fish({ position, rotY = 0, color = '#8FB3D9', size = 1 }: { position: [number, number, number]; rotY?: number; color?: string; size?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]} scale={size}>
      <mesh scale={[1, 0.42, 0.32]}>
        <sphereGeometry args={[0.13, 12, 8]} />
        <Toon color={color} />
      </mesh>
      <mesh position={[0, 0.01, 0]} scale={[0.95, 0.3, 0.33]}>
        <sphereGeometry args={[0.13, 12, 8]} />
        <Toon color="#EAF4FB" />
      </mesh>
      <mesh position={[-0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.3]}>
        <coneGeometry args={[0.075, 0.11, 4]} />
        <Toon color={color} />
      </mesh>
      <mesh position={[0.095, 0.02, 0.04]}>
        <sphereGeometry args={[0.012, 6, 6]} />
        <meshBasicMaterial color="#1C2430" />
      </mesh>
    </group>
  );
}

function Crate({ position, rotY = 0, size = 0.7 }: { position: [number, number, number]; rotY?: number; size?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[size, size, size]} />
        <Toon color="#B98A5A" tex="planks" />
        <Ink thickness={0.02} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0, s * (size / 2 + 0.006)]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[size * 1.25, 0.07, 0.02]} />
          <Toon color={WOOD} />
        </mesh>
      ))}
    </group>
  );
}

function Barrel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.75, 16]} />
        <Toon color="#9A6A42" tex="planks" />
        <Ink thickness={0.02} />
      </mesh>
      {[-0.26, 0.26].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.315, 0.315, 0.05, 16]} />
          <Toon color="#5E5A5E" />
        </mesh>
      ))}
    </group>
  );
}

function Basket({ position, fruit }: { position: [number, number, number]; fruit: string }) {
  const pile = [[0, 0.1, 0], [0.09, 0.09, 0.07], [-0.09, 0.09, -0.04], [0.07, 0.1, -0.09], [-0.06, 0.1, 0.09], [0.0, 0.18, 0.0], [0.04, 0.17, -0.05]];
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.24, 0.18, 0.15, 14]} />
        <Toon color="#C9A16A" tex="thatch" />
      </mesh>
      {pile.map((p, j) => (
        <mesh key={j} position={p as [number, number, number]}>
          <sphereGeometry args={[0.075, 10, 8]} />
          <Toon color={fruit} />
        </mesh>
      ))}
    </group>
  );
}

// ── Stall ────────────────────────────────────────────────────────────────────
interface StallProps {
  position: [number, number, number];
  rotY?: number;
  a: string;
  b: string;
  goods: 'fish' | 'fruit';
}

/** Canopy: sagging striped cloth, lower at the front, and a scalloped valance. */
function Canopy({ a, b }: { a: string; b: string }) {
  const tex = useMemo(() => stripeTexture(a, b), [a, b]);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(2.7, 1.7, 18, 8);
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const sag = -0.04 * Math.cos((x / 1.35) * Math.PI * 0.5) * Math.sin(((z + 0.85) / 1.7) * Math.PI);
      p.setY(i, -(z / 1.7) * 0.16 + sag); // back a little higher than the front
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const flaps = 9;
  return (
    <group position={[0, 2.22, 0.1]}>
      <mesh geometry={geo} castShadow>
        <meshToonMaterial map={tex} gradientMap={getGradient()} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: flaps }).map((_, i) => {
        const x = -1.35 + (i + 0.5) * (2.7 / flaps);
        return (
          <mesh key={i} position={[x, -0.16, 0.86]} rotation={[0.1, 0, 0]}>
            <circleGeometry args={[2.7 / flaps / 2, 12, Math.PI, Math.PI]} />
            <Toon color={i % 2 ? a : b} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

export function MarketStall({ position, rotY = 0, a, b, goods }: StallProps) {
  const sign = useMemo(() => signTexture(goods === 'fish' ? 'Peixes Frescos' : 'Frutas da Vila', goods), [goods]);
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotY, 0]}>
      <CuboidCollider args={[1.15, 0.45, 0.5]} position={[0, 0.45, 0.05]} />
      {/* canopy top is walkable (the secret route uses it) */}
      <CuboidCollider args={[1.3, 0.05, 0.8]} position={[0, 2.17, 0.1]} />
      {[-1.15, 1.15].map((x) =>
        [-0.6, 0.75].map((z) => (
          <mesh key={`${x}${z}`} position={[x, z < 0 ? 1.2 : 1.05, z]} castShadow>
            <cylinderGeometry args={[0.055, 0.065, z < 0 ? 2.4 : 2.1, 8]} />
            <Toon color={WOOD} tex="bark" />
          </mesh>
        ))
      )}
      {/* counter: plank front, dark top board */}
      <mesh position={[0, 0.42, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[2.3, 0.84, 0.9]} />
        <Toon color={WOOD_LIGHT} tex="planks" />
        <Ink thickness={0.02} />
      </mesh>
      <mesh position={[0, 0.87, 0.07]} castShadow>
        <boxGeometry args={[2.45, 0.06, 1.02]} />
        <Toon color={WOOD_DARK} tex="wood" />
      </mesh>
      {/* back shelf */}
      <mesh position={[0, 1.08, -0.3]} castShadow>
        <boxGeometry args={[2.1, 0.06, 0.32]} />
        <Toon color={WOOD} tex="wood" />
      </mesh>
      <Canopy a={a} b={b} />
      {/* painted sign hanging from the canopy */}
      <group position={[0, 1.78, 0.92]}>
        <mesh>
          <planeGeometry args={[1.3, 0.48]} />
          <meshToonMaterial map={sign} gradientMap={getGradient()} side={THREE.DoubleSide} />
        </mesh>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 0.3, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.16, 4]} />
            <Toon color="#3a2a22" />
          </mesh>
        ))}
      </group>
      <PawLantern position={[-1.15, 1.7, 0.86]} color="#E0483A" />
      <PawLantern position={[1.15, 1.7, 0.86]} color="#F2A541" />
      {goods === 'fish' ? (
        <>
          <mesh position={[-0.45, 0.94, 0.12]}>
            <boxGeometry args={[1.1, 0.08, 0.7]} />
            <Toon color="#DDEFF8" />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Fish key={i} position={[-0.85 + (i % 3) * 0.38, 1.0, -0.05 + Math.floor(i / 3) * 0.32]} rotY={0.3 + i * 0.5} color={i % 2 ? '#8FB3D9' : '#E58B6A'} />
          ))}
          <mesh position={[0.6, 0.94, 0.12]}>
            <boxGeometry args={[0.8, 0.08, 0.6]} />
            <Toon color="#CDE7F3" />
          </mesh>
          {[0, 1].map((i) => (
            <Fish key={i} position={[0.6, 1.02, -0.02 + i * 0.26]} rotY={Math.PI / 2 + 0.1 * i} color="#6E93BC" size={1.7} />
          ))}
          {[0, 1, 2].map((i) => (
            <Fish key={i} position={[-0.6 + i * 0.6, 1.16, -0.3]} rotY={0.2} color="#9BC0E0" size={1.1} />
          ))}
        </>
      ) : (
        <>
          <Basket position={[-0.75, 0.97, 0.12]} fruit="#E8553B" />
          <Basket position={[0, 0.97, 0.18]} fruit="#F2B33D" />
          <Basket position={[0.75, 0.97, 0.12]} fruit="#8BC34A" />
          {[-0.6, 0, 0.6].map((x, i) => (
            <mesh key={i} position={[x, 1.2, -0.3]} scale={[1, 0.85, 1]}>
              <sphereGeometry args={[0.13, 12, 10]} />
              <Toon color={['#7FB850', '#E8553B', '#9C6BC4'][i]} />
            </mesh>
          ))}
        </>
      )}
      {/* stock around the stall */}
      <Crate position={[1.6, 0.25, -0.35]} size={0.5} rotY={0.3} />
      <Barrel position={[-1.6, 0.375, -0.4]} />
      <mesh position={[1.55, 0.04, 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.04, 6, 16]} />
        <Toon color="#C9A16A" />
      </mesh>
    </RigidBody>
  );
}

// ── Fish cart ────────────────────────────────────────────────────────────────
export function FishCart({ position, rotY = 0 }: { position: [number, number, number]; rotY?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotY, 0]}>
      <CuboidCollider args={[0.75, 0.45, 0.5]} position={[0, 0.5, 0]} />
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.1, 0.9]} />
        <Toon color={WOOD_LIGHT} tex="planks" />
        <Ink thickness={0.02} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.78, s * 0.44]} castShadow>
          <boxGeometry args={[1.4, 0.24, 0.05]} />
          <Toon color={WOOD} tex="planks" />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[0.15, 0.36, s * 0.52]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.34, 0.045, 8, 22]} />
            <Toon color={WOOD_DARK} />
            <Ink thickness={0.015} />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} rotation={[0, 0, (k / 4) * Math.PI]}>
              <boxGeometry args={[0.66, 0.03, 0.03]} />
              <Toon color={WOOD} />
            </mesh>
          ))}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.08, 10]} />
            <Toon color="#5E5A5E" />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-1.05, 0.68, s * 0.32]} rotation={[0, 0, -0.12]}>
          <boxGeometry args={[0.8, 0.05, 0.05]} />
          <Toon color={WOOD} />
        </mesh>
      ))}
      <mesh position={[-0.55, 0.3, 0]}>
        <boxGeometry args={[0.05, 0.6, 0.05]} />
        <Toon color={WOOD} />
      </mesh>
      {[-0.32, 0.32].map((x, i) => (
        <group key={x} position={[x, 0.86, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.6, 0.3, 0.72]} />
            <Toon color="#B98A5A" tex="planks" />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <boxGeometry args={[0.54, 0.03, 0.66]} />
            <Toon color="#DDEFF8" />
          </mesh>
          {[0, 1, 2].map((k) => (
            <Fish key={k} position={[-0.12 + k * 0.12, 0.2, -0.18 + k * 0.17]} rotY={1.3 + k + i} color={k % 2 ? '#8FB3D9' : '#6E93BC'} />
          ))}
        </group>
      ))}
    </RigidBody>
  );
}

// ── Lantern string over the market street ─────────────────────────────────────
export function LanternString({ from, to, sag = 0.35, count = 7 }: { from: [number, number, number]; to: [number, number, number]; sag?: number; count?: number }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const point = (t: number) => a.clone().lerp(b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0));
  const rope = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => point(i / 8)));
    return new THREE.TubeGeometry(curve, 24, 0.012, 4, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.join(), to.join(), sag]);
  const colors = ['#E0483A', '#F2A541', '#F4E1C1', '#E0483A', '#E8A0BF'];
  return (
    <group>
      {[a, b].map((p, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[p.x, 0, p.z]}>
          <CylinderCollider args={[p.y / 2, 0.07]} position={[0, p.y / 2, 0]} />
          <mesh position={[0, p.y / 2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, p.y, 8]} />
            <Toon color={WOOD} tex="bark" />
          </mesh>
        </RigidBody>
      ))}
      <mesh geometry={rope}>
        <meshBasicMaterial color="#3a2a22" />
      </mesh>
      {Array.from({ length: count }).map((_, i) => {
        const p = point((i + 1) / (count + 1));
        return <PawLantern key={i} position={[p.x, p.y - 0.28, p.z]} color={colors[i % colors.length]} scale={0.9} />;
      })}
    </group>
  );
}

// ── Secret route: crate stack → fruit stall canopy → chest ────────────────────
export function CrateSteps() {
  // Wide, continuous steps so a jump at full speed still lands on the next level:
  // ground → 0.6 m (two crates side by side) → 1.2 m (2 × 2 crates) → canopy edge at 2.2 m.
  const low: [number, number, number][] = [[8.15, 0.3, -6.7], [8.75, 0.3, -6.7]];
  const high: [number, number, number][] = [[8.15, 0.3, -6.1], [8.75, 0.3, -6.1], [8.15, 0.9, -6.1], [8.75, 0.9, -6.1]];
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[0.6, 0.3, 0.3]} position={[8.45, 0.3, -6.7]} />
      <CuboidCollider args={[0.6, 0.6, 0.3]} position={[8.45, 0.6, -6.1]} />
      {[...low, ...high].map((p, i) => (
        <Crate key={i} position={p} size={0.6} rotY={(i % 3) * 0.06 - 0.05} />
      ))}
    </RigidBody>
  );
}

/** A soft golden shimmer above the hidden chest until it is opened. */
export function SecretGlint({ position, flag }: { position: [number, number, number]; flag: string }) {
  const opened = useGameStore((s) => !!s.progress.flags[flag]);
  if (opened) return null;
  return <Sparkles position={position} count={14} scale={[0.9, 0.7, 0.9]} size={4} speed={0.4} color="#FFD76A" />;
}

/**
 * Warm light pools from the lanterns at sunset. Real point lights cost every lit pixel,
 * so they only exist on high quality and at sunset; elsewhere the lanterns just glow.
 */
export function LanternLights() {
  const quality = useEffectiveQuality();
  const time = useUiSettings((s) => s.timeOfDay);
  if (quality !== 'alta' || time !== 'entardecer') return null;
  return (
    <group>
      <pointLight position={[7.2, 2.0, -1.5]} color="#FFB062" intensity={2.2} distance={6} decay={2} />
      <pointLight position={[7.6, 1.9, 1.6]} color="#FF9F55" intensity={1.6} distance={5} decay={2} />
      <pointLight position={[0, 2.6, 0]} color="#FFC27A" intensity={2.4} distance={7} decay={2} />
    </group>
  );
}
