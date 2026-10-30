import { ShopSigns } from './ShopSigns';
import { SedeGate } from './SedeGate';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Toon, Ink } from '../materials';
import { getPuffGeometry } from '../foliageGeometry';
import { createJapaneseRoof } from '../roofGeometry';
import { Asset } from '../assets/AssetModel';
import { MarketStall, FishCart, LanternString, CrateSteps, SecretGlint, LanternLights } from './Market';

const WOOD = '#6A4630';
const WOOD_DARK = '#4A2F20';
const WOOD_LIGHT = '#9B7048';
const STONE = '#B4ADA2';
const PAPER = '#F8F0DC';

/** Curved tile roof with wooden underside, ridge cap and end ornaments. */
export function JapaneseRoof({ w, d, h, color, overhang = 0.7, upturn = 0.35, tex = 'tiles' }: {
  w: number; d: number; h: number; color: string; overhang?: number; upturn?: number; tex?: 'tiles' | 'thatch';
}) {
  const roof = useMemo(() => createJapaneseRoof(w, d, h, overhang, upturn), [w, d, h, overhang, upturn]);
  const [R1, R2] = roof.ridge;
  const ridgeLen = R1.distanceTo(R2);
  const alongX = Math.abs(R2.x - R1.x) >= Math.abs(R2.z - R1.z);
  const ridgeColor = tex === 'thatch' ? '#8C6A3A' : '#2F2A36';
  return (
    <group>
      <mesh geometry={roof.geometry} castShadow receiveShadow>
        <Toon color={color} tex={tex} nativeUV />
        <Ink thickness={0.03} />
      </mesh>
      {/* Wooden underside gives the eaves thickness */}
      <mesh geometry={roof.geometry} position={[0, -0.08, 0]}>
        <Toon color={tex === 'thatch' ? '#7A5A30' : WOOD_DARK} side={THREE.BackSide} />
      </mesh>
      <mesh position={[(R1.x + R2.x) / 2, h + 0.05, (R1.z + R2.z) / 2]} rotation={alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, ridgeLen + 0.35, 8]} />
        <Toon color={ridgeColor} />
      </mesh>
      {tex === 'tiles' && [R1, R2].map((r, i) => (
        <group key={i} position={[r.x, h + 0.05, r.z]} rotation={[0, alongX ? (i ? 0 : Math.PI) : (i ? -Math.PI / 2 : Math.PI / 2), 0]}>
          <mesh position={[0.18, 0.1, 0]} rotation={[0, 0, -0.5]}>
            <boxGeometry args={[0.18, 0.3, 0.24]} />
            <Toon color={ridgeColor} />
          </mesh>
          <mesh position={[0.3, 0.3, 0]} rotation={[0, 0, -0.9]}>
            <coneGeometry args={[0.08, 0.28, 6]} />
            <Toon color="#D6B04C" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Shoji({ position, rotY = 0, w = 0.9, h = 0.7 }: { position: [number, number, number]; rotY?: number; w?: number; h?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[w + 0.12, h + 0.12, 0.04]} />
        <Toon color={WOOD_DARK} tex="wood" />
      </mesh>
      <mesh position={[0, 0, 0.025]}>
        <boxGeometry args={[w, h, 0.03]} />
        <Toon color={PAPER} emissive="#FFC877" emissiveIntensity={0.3} />
      </mesh>
      {[-w / 3, 0, w / 3].map((x, i) => (
        <mesh key={i} position={[x, 0, 0.045]}>
          <boxGeometry args={[0.025, h, 0.015]} />
          <Toon color={WOOD} />
        </mesh>
      ))}
      {[-h / 4, h / 4].map((y, i) => (
        <mesh key={i} position={[0, y, 0.045]}>
          <boxGeometry args={[w, 0.025, 0.015]} />
          <Toon color={WOOD} />
        </mesh>
      ))}
    </group>
  );
}

export function PaperLantern({ position, color = '#E0483A' }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      <mesh scale={[1, 1.25, 1]}>
        <sphereGeometry args={[0.17, 14, 10]} />
        <Toon color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>
      {[-0.06, 0.06].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.172, 0.006, 4, 18]} />
          <meshBasicMaterial color="#7A2020" />
        </mesh>
      ))}
      {[0.2, -0.2].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.05, 10]} />
          <Toon color="#1F1A22" />
        </mesh>
      ))}
    </group>
  );
}

function Noren({ width, color, y, z }: { width: number; color: string; y: number; z: number }) {
  const panels = 3;
  const pw = width / panels;
  return (
    <group position={[0, y, z]}>
      <mesh position={[0, 0.02, -0.01]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, width + 0.2, 6]} />
        <Toon color={WOOD_DARK} />
      </mesh>
      {Array.from({ length: panels }).map((_, i) => (
        <mesh key={i} position={[-width / 2 + pw * (i + 0.5), -0.3, 0]} rotation={[0.04 * (i - 1), 0, 0]}>
          <boxGeometry args={[pw - 0.03, 0.6, 0.02]} />
          <Toon color={color} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, -0.18, 0.02]}>
        <circleGeometry args={[0.13, 20]} />
        <Toon color="#F7F1E3" />
      </mesh>
      {[[-0.05, -0.12], [-0.02, -0.1], [0.02, -0.1], [0.05, -0.12]].map(([x, yy], i) => (
        <mesh key={i} position={[x, yy - 0.06, 0.025]}>
          <circleGeometry args={[0.018, 8]} />
          <Toon color={color} />
        </mesh>
      ))}
      <mesh position={[0, -0.22, 0.025]} scale={[1.3, 1, 1]}>
        <circleGeometry args={[0.04, 10]} />
        <Toon color={color} />
      </mesh>
    </group>
  );
}

function PottedPlant({ position, flower = '#F49AB8' }: { position: [number, number, number]; flower?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.2, 0.15, 0.36, 10]} />
        <Toon color="#C0573E" />
        <Ink thickness={0.012} />
      </mesh>
      <mesh position={[0, 0.48, 0]} scale={[0.3, 0.26, 0.3]} geometry={getPuffGeometry(3, 'low')} dispose={null}>
        <Toon color="#5E9E4E" wind />
      </mesh>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.17, 0.62, Math.sin(a) * 0.17]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <Toon color={flower} />
        </mesh>
      ))}
    </group>
  );
}

interface HouseProps {
  position: [number, number, number];
  rotY?: number;
  size: [number, number, number];
  wall?: string;
  roof: string;
  roofH?: number;
  noren?: string;
  lanterns?: boolean;
  /** Adds a small upper roof (two-tier look) for important buildings. */
  tiered?: boolean;
  flower?: string;
  noDeck?: boolean;
}

export function House({ position, rotY = 0, size, wall = '#F1E6D2', roof, roofH, noren, lanterns, tiered, flower, noDeck }: HouseProps) {
  const [w, h, d] = size;
  const base = 0.35;
  const top = base + h;
  const deck = noDeck ? 0 : 0.75;
  const wainscot = Math.min(0.9, h * 0.35);
  const posts: [number, number][] = [[-w / 2, d / 2], [w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2], [-0.65, d / 2], [0.65, d / 2]];
  const rh = roofH ?? h * 0.62;
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotY, 0]}>
      <CuboidCollider args={[w / 2 + 0.1, (top + 0.2) / 2, d / 2 + 0.1]} position={[0, (top + 0.2) / 2, 0]} />
      {/* the roof and its eaves: a sensor, so it stops the follow camera (which used to end up inside
          the roof, filling the screen) but never the cat; Shinichi's own rays ignore sensors */}
      <CuboidCollider sensor args={[w / 2 + 0.75, rh / 2 + 0.15, d / 2 + 0.75]} position={[0, top + rh / 2, 0]} />
      {deck > 0 && <CuboidCollider args={[w / 2 + 0.15, base / 2, deck / 2]} position={[0, base / 2, d / 2 + deck / 2 + 0.1]} />}

      {/* Stone foundation */}
      <mesh position={[0, base / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w + 0.35, base, d + 0.35]} />
        <Toon color={STONE} tex="stone" />
      </mesh>
      {/* Veranda (engawa) */}
      {deck > 0 && <>
      <mesh position={[0, base - 0.04, d / 2 + deck / 2 + 0.1]} receiveShadow castShadow>
        <boxGeometry args={[w + 0.3, 0.1, deck]} />
        <Toon color={WOOD_LIGHT} tex="planks" />
        <Ink thickness={0.02} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + 0.05), (top + 0.1) / 2, d / 2 + deck + 0.02]} castShadow>
          <boxGeometry args={[0.14, top + 0.1, 0.14]} />
          <Toon color={WOOD} tex="wood" />
        </mesh>
      ))}
      <mesh position={[0, 0.12, d / 2 + deck + 0.25]}>
        <boxGeometry args={[1.0, 0.24, 0.35]} />
        <Toon color={STONE} tex="stone" />
      </mesh>
      </>}

      {/* Walls: wooden wainscot below, plaster above */}
      <mesh position={[0, base + wainscot / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, wainscot, d]} />
        <Toon color={WOOD_LIGHT} tex="planks" />
      </mesh>
      <mesh position={[0, base + wainscot + (h - wainscot) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w - 0.02, h - wainscot, d - 0.02]} />
        <Toon color={wall} tex="plaster" />
        <Ink thickness={0.03} />
      </mesh>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, base + h / 2, z]} castShadow>
          <boxGeometry args={[0.18, h, 0.18]} />
          <Toon color={WOOD} tex="wood" />
        </mesh>
      ))}
      {[top - 0.1, base + wainscot].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[w + 0.06, i ? 0.08 : 0.2, d + 0.06]} />
          <Toon color={WOOD} tex="wood" />
        </mesh>
      ))}

      {/* Sliding door + noren + sign */}
      <mesh position={[0, base + 0.78, d / 2 + 0.015]}>
        <boxGeometry args={[1.1, 1.56, 0.03]} />
        <Toon color="#2A1D16" />
      </mesh>
      <mesh position={[0.28, base + 0.78, d / 2 + 0.035]}>
        <boxGeometry args={[0.55, 1.5, 0.03]} />
        <Toon color={WOOD_LIGHT} tex="planks" />
      </mesh>
      {noren && <Noren width={1.15} color={noren} y={base + 1.62} z={d / 2 + 0.07} />}
      <group position={[0, top - 0.35, d / 2 + 0.06]}>
        <mesh>
          <boxGeometry args={[0.9, 0.34, 0.05]} />
          <Toon color={WOOD} tex="wood" />
          <Ink thickness={0.015} />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <circleGeometry args={[0.11, 16]} />
          <Toon color="#F2C14E" />
        </mesh>
      </group>
      {w > 3 && (
        <>
          <Shoji position={[-w / 2 + 0.85, base + h * 0.6, d / 2 + 0.03]} />
          <Shoji position={[w / 2 - 0.85, base + h * 0.6, d / 2 + 0.03]} />
        </>
      )}
      <Shoji position={[w / 2 + 0.03, base + h * 0.6, 0]} rotY={Math.PI / 2} w={1.1} />
      <Shoji position={[-w / 2 - 0.03, base + h * 0.6, 0]} rotY={-Math.PI / 2} w={1.1} />

      <PottedPlant position={[-w / 2 + 0.35, base, d / 2 + deck - 0.15]} flower={flower} />
      <PottedPlant position={[w / 2 - 0.35, base, d / 2 + deck - 0.15]} flower={flower ?? '#FFF59D'} />
      {lanterns && (
        <>
          <PaperLantern position={[-0.95, base + 1.55, d / 2 + deck - 0.05]} />
          <PaperLantern position={[0.95, base + 1.55, d / 2 + deck - 0.05]} />
        </>
      )}

      <group position={[0, top, 0]}>
        <JapaneseRoof w={w} d={d + deck * 0.9} h={rh} color={roof} overhang={0.65} />
        {tiered && (
          <group position={[0, rh * 0.62, 0]}>
            <mesh position={[0, 0.3, 0]}>
              <boxGeometry args={[w * 0.45, 0.6, d * 0.45]} />
              <Toon color={wall} tex="plaster" />
            </mesh>
            <group position={[0, 0.6, 0]}>
              <JapaneseRoof w={w * 0.45} d={d * 0.45} h={rh * 0.55} color={roof} overhang={0.45} upturn={0.28} />
            </group>
          </group>
        )}
      </group>
    </RigidBody>
  );
}

function Pagoda({ position }: { position: [number, number, number] }) {
  const tiers = [
    { w: 3.6, h: 1.8, roof: 0.85 },
    { w: 2.8, h: 1.2, roof: 0.72 },
    { w: 2.1, h: 1.0, roof: 1.1 },
  ];
  let y = 0.4;
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[2, 3, 2]} position={[0, 3, 0]} />
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.4, 4.6]} />
        <Toon color={STONE} tex="stone" />
      </mesh>
      {tiers.map((t, i) => {
        const y0 = y;
        y += t.h + t.roof * 0.4;
        return (
          <group key={i} position={[0, y0, 0]}>
            <mesh position={[0, t.h / 2, 0]} castShadow>
              <boxGeometry args={[t.w, t.h, t.w]} />
              <Toon color={i === 0 ? '#F3EADA' : '#F1E6D2'} tex="plaster" />
              <Ink thickness={0.03} />
            </mesh>
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], k) => (
              <mesh key={k} position={[(sx * t.w) / 2, t.h / 2, (sz * t.w) / 2]}>
                <boxGeometry args={[0.2, t.h, 0.2]} />
                <Toon color="#C8463A" tex="wood" />
              </mesh>
            ))}
            <mesh position={[0, t.h - 0.08, 0]}>
              <boxGeometry args={[t.w + 0.08, 0.16, t.w + 0.08]} />
              <Toon color="#C8463A" tex="wood" />
            </mesh>
            {i > 0 && (
              <>
                <mesh position={[0, 0.05, 0]}>
                  <boxGeometry args={[t.w + 0.7, 0.08, t.w + 0.7]} />
                  <Toon color={WOOD_LIGHT} tex="planks" />
                </mesh>
                {[-1, 1].map((s) => (
                  <mesh key={s} position={[0, 0.3, (s * (t.w + 0.66)) / 2]}>
                    <boxGeometry args={[t.w + 0.7, 0.06, 0.06]} />
                    <Toon color="#C8463A" />
                  </mesh>
                ))}
              </>
            )}
            {i === 0 && <Noren width={1.2} color="#2F3F6B" y={1.62} z={t.w / 2 + 0.05} />}
            {i > 0 && <Shoji position={[0, t.h / 2, t.w / 2 + 0.03]} w={0.8} h={0.55} />}
            <group position={[0, t.h, 0]}>
              <JapaneseRoof w={t.w} d={t.w} h={t.roof} color="#3F5277" overhang={0.8} upturn={0.5} />
            </group>
          </group>
        );
      })}
      <mesh position={[0, y + 0.45, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 1.6, 8]} />
        <Toon color="#D6B04C" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, y + 0.15 + i * 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.14 - i * 0.015, 0.03, 6, 14]} />
          <Toon color="#D6B04C" />
        </mesh>
      ))}
      <mesh position={[0, y + 1.35, 0]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <Toon color="#F2C14E" emissive="#F2C14E" emissiveIntensity={0.3} />
      </mesh>
    </RigidBody>
  );
}

function StrawHut({ position, rotY = 0 }: { position: [number, number, number]; rotY?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotY, 0]}>
      <CuboidCollider args={[1.6, 1.3, 1.4]} position={[0, 1.3, 0]} />
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[3.2, 0.24, 2.7]} />
        <Toon color={STONE} tex="stone" />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[3, 1.7, 2.5]} />
        <Toon color="#A07650" tex="planks" />
        <Ink thickness={0.03} />
      </mesh>
      {[[-1.5, 1.25], [1.5, 1.25], [-1.5, -1.25], [1.5, -1.25]].map(([x, z], i) => (
        <mesh key={i} position={[x, 1.05, z]}>
          <cylinderGeometry args={[0.1, 0.12, 1.75, 8]} />
          <Toon color="#6A4A32" tex="bark" />
        </mesh>
      ))}
      <mesh position={[0, 0.75, 1.27]}>
        <boxGeometry args={[0.85, 1.3, 0.03]} />
        <Toon color="#2A1D16" />
      </mesh>
      <group position={[0, 1.9, 0]}>
        <JapaneseRoof w={3} d={2.5} h={1.5} color="#D9BE84" overhang={0.55} upturn={0.06} tex="thatch" />
      </group>
      <PaperLantern position={[0.75, 1.55, 1.5]} color="#F2A541" />
      <PottedPlant position={[-1.1, 0.24, 1.6]} flower="#FFAB91" />
    </RigidBody>
  );
}

export function Torii({ position, rotY = 0 }: { position: [number, number, number]; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {[-1.5, 1.5].map((x) => (
        <RigidBody key={x} type="fixed" colliders={false} position={[x, 0, 0]}>
          <CylinderCollider args={[1.7, 0.2]} position={[0, 1.7, 0]} />
          <mesh position={[0, 1.7, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.18, 3.4, 12]} />
            <Toon color="#D2402F" />
            <Ink thickness={0.025} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.24, 12]} />
            <Toon color="#2A2228" />
          </mesh>
        </RigidBody>
      ))}
      <mesh position={[0, 2.75, 0]} castShadow>
        <boxGeometry args={[3.8, 0.2, 0.22]} />
        <Toon color="#D2402F" />
        <Ink thickness={0.02} />
      </mesh>
      <mesh position={[0, 3.45, 0]} castShadow>
        <boxGeometry args={[4.6, 0.26, 0.34]} />
        <Toon color="#D2402F" />
        <Ink thickness={0.02} />
      </mesh>
      <mesh position={[0, 3.66, 0]}>
        <boxGeometry args={[4.9, 0.16, 0.4]} />
        <Toon color="#2A2228" />
      </mesh>
      <mesh position={[0, 3.1, 0.12]}>
        <boxGeometry args={[0.5, 0.55, 0.06]} />
        <Toon color="#2A2228" />
      </mesh>
      <mesh position={[0, 3.1, 0.16]}>
        <circleGeometry args={[0.13, 16]} />
        <Toon color="#F2C14E" emissive="#F2C14E" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

/** Animated ripples spreading in the basin (dynamic, outside the static merge). */
function Ripples() {
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((s) => {
    rings.current.forEach((m, i) => {
      if (!m) return;
      const t = (s.clock.elapsedTime * 0.45 + i / 3) % 1;
      const r = 0.35 + t * 0.85;
      m.scale.set(r, r, 1);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t);
    });
  });
  return (
    <group userData={{ dynamic: true }} position={[0, 0.57, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)}>
          <ringGeometry args={[0.95, 1, 40]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Water arcs from the four koi heads on the rim into the basin. */
function useJetGeometry() {
  return useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(1.32, 0.72, 0), new THREE.Vector3(1.0, 1.25, 0), new THREE.Vector3(0.55, 0.57, 0));
    return new THREE.TubeGeometry(curve, 16, 0.035, 6, false);
  }, []);
}

function CatStatueFountain() {
  const jet = useJetGeometry();
  return (
    <RigidBody type="fixed" colliders={false} position={[0, 0, 0]}>
      <CylinderCollider args={[0.4, 1.45]} position={[0, 0.4, 0]} />
      {/* stepped stone base */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[1.75, 1.8, 0.12, 32]} />
        <Toon color="#A89E8E" tex="stone" />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.55, 0.42, 32]} />
        <Toon color="#C9C0B0" tex="stone" />
        <Ink thickness={0.03} />
      </mesh>
      <mesh position={[0, 0.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.42, 0.1, 8, 40]} />
        <Toon color="#D8D0C2" />
      </mesh>
      {/* water: above the stone top (y 0.51), tucked under the rim lip */}
      <mesh position={[0, 0.56, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.4, 48]} />
        <Toon color="#5FC3E8" emissive="#2E8FC0" emissiveIntensity={0.3} />
      </mesh>
      <Ripples />
      {/* koi spouts on the rim */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, (i / 4) * Math.PI * 2 + Math.PI / 4, 0]}>
          <mesh position={[1.4, 0.68, 0]} rotation={[0, 0, 0.5]} scale={[1.3, 0.8, 0.8]}>
            <sphereGeometry args={[0.12, 12, 10]} />
            <Toon color={i % 2 ? '#F28B50' : '#F4F1EA'} />
            <Ink thickness={0.012} />
          </mesh>
          <mesh position={[1.55, 0.74, 0]} rotation={[0, 0, -0.6]}>
            <coneGeometry args={[0.08, 0.14, 8]} />
            <Toon color={i % 2 ? '#F28B50' : '#F4F1EA'} />
          </mesh>
          <mesh geometry={jet}>
            <meshBasicMaterial color="#CFF2FF" transparent opacity={0.75} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {/* pedestal with lotus */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.42, 0.5, 20]} />
        <Toon color="#C9C0B0" tex="stone" />
        <Ink thickness={0.015} />
      </mesh>
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.36, 1.0, Math.sin(a) * 0.36]} rotation={[0, -a, -0.9]} scale={[0.35, 1, 0.6]}>
            <sphereGeometry args={[0.18, 10, 8]} />
            <Toon color={i % 2 ? '#F7B6CB' : '#F49AB8'} />
          </mesh>
        );
      })}
      {/* sitting stone cat, the village guardian */}
      <group position={[0, 1.02, 0]}>
        <mesh position={[0, 0.3, 0]} scale={[1, 1.15, 0.9]} castShadow>
          <sphereGeometry args={[0.3, 20, 16]} />
          <Toon color="#DCD4C6" />
          <Ink thickness={0.02} />
        </mesh>
        <mesh position={[0, 0.78, 0.04]} scale={[1.1, 0.95, 1]} castShadow>
          <sphereGeometry args={[0.24, 20, 16]} />
          <Toon color="#DCD4C6" />
          <Ink thickness={0.02} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[0.15 * s, 1.0, 0.02]} rotation={[0, 0, -0.35 * s]} scale={[1, 1, 0.55]}>
            <coneGeometry args={[0.09, 0.2, 10]} />
            <Toon color="#DCD4C6" />
            <Ink thickness={0.012} />
          </mesh>
        ))}
        {[1, -1].map((s) => (
          <mesh key={s} position={[0.09 * s, 0.8, 0.24]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.04, 0.012, 4, 10, Math.PI]} />
            <meshBasicMaterial color="#6E6558" />
          </mesh>
        ))}
        {/* raised paw, maneki-neko style */}
        <mesh position={[0.24, 0.66, 0.12]} rotation={[0, 0, -0.3]}>
          <capsuleGeometry args={[0.06, 0.18, 4, 8]} />
          <Toon color="#DCD4C6" />
          <Ink thickness={0.012} />
        </mesh>
        <mesh position={[0, 0.58, 0.22]} rotation={[0.3, 0, 0]}>
          <torusGeometry args={[0.16, 0.025, 6, 20, Math.PI]} />
          <Toon color="#D9473A" />
        </mesh>
        <mesh position={[0, 0.47, 0.27]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <Toon color="#F2C14E" emissive="#FFC107" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0.05, 0.12, -0.32]} rotation={[0.3, 0, Math.PI / 2]}>
          <torusGeometry args={[0.2, 0.045, 6, 16, Math.PI]} />
          <Toon color="#DCD4C6" />
        </mesh>
      </group>
    </RigidBody>
  );
}

function Planter({ position, rotY }: { position: [number, number, number]; rotY: number }) {
  const flowers = ['#F48FB1', '#FFF59D', '#CE93D8', '#FFAB91', '#F48FB1', '#FFFFFF'];
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotY, 0]}>
      <CuboidCollider args={[1.4, 0.3, 0.35]} position={[0, 0.3, 0]} />
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.5, 0.7]} />
        <Toon color="#9C8F7C" />
        <Ink thickness={0.02} />
      </mesh>
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[2.6, 0.06, 0.55]} />
        <Toon color="#5A8F3C" />
      </mesh>
      {/* real little flowers: a stem, two leaves, five petals around a golden center */}
      {flowers.map((c, i) => (
        <group key={i} position={[-1.1 + i * 0.44, 0.55, (i % 2) * 0.16 - 0.08]} rotation={[0, i * 1.3, 0]}>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.012, 0.016, 0.18, 5]} />
            <Toon color="#4E8A36" />
          </mesh>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * 0.05, 0.05, 0]} rotation={[0, 0, sd * -0.9]} scale={[0.07, 0.018, 0.035]}>
              <sphereGeometry args={[1, 8, 5]} />
              <Toon color="#5E9E40" />
            </mesh>
          ))}
          {Array.from({ length: 5 }, (_, k) => (
            <mesh key={k} position={[Math.cos((k / 5) * Math.PI * 2) * 0.055, 0.19, Math.sin((k / 5) * Math.PI * 2) * 0.055]} rotation={[0, -(k / 5) * Math.PI * 2, 0.35]} scale={[0.055, 0.02, 0.04]}>
              <sphereGeometry args={[1, 8, 5]} />
              <Toon color={c} />
            </mesh>
          ))}
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.03, 8, 6]} />
            <Toon color="#F2C24A" />
          </mesh>
        </group>
      ))}
    </RigidBody>
  );
}

export function Buildings() {
  return (
    <>
      {/* Cantina (Chef Hana) */}
      <Asset name="casa_vila" position={[-8.5, 0, -8.5]} rotation={[0, 0.35, 0]} fitWidth={6.6} fallback={<House position={[-8.5, 0, -8.5]} rotY={0.35} size={[5, 2.6, 3.8]} roof="#C0573E" noren="#2F3F6B" lanterns tiered />} />
      {/* Dojo */}
      <Asset name="casa_vila" position={[9.5, 0, -10]} rotation={[0, -0.35, 0]} fitWidth={6.4} fallback={<House position={[9.5, 0, -10]} rotY={-0.35} size={[4.8, 2.8, 4]} wall="#F3EBDD" roof="#3F5277" noren="#B23A2E" lanterns tiered />} />
      {/* Market house (Boku) */}
      <Asset name="casa_vila" position={[11.5, 0, -1.5]} rotation={[0, -Math.PI / 2, 0]} fitWidth={5.6} fallback={<House position={[11.5, 0, -1.5]} rotY={-Math.PI / 2} size={[4, 2.3, 3.2]} wall="#EBD9B4" roof="#4F6B52" noren="#E07B39" noDeck />} />
      <Asset name="mercado_vila" position={[8.6, 0, 0.7]} rotation={[0, -Math.PI / 2, 0]} fitWidth={2.7} fallback={<MarketStall position={[8.6, 0, 0.7]} rotY={-Math.PI / 2} a="#E8553B" b="#FFF4E0" goods="fish" />} />
      <Asset name="mercado_vila" position={[8.6, 0, -3.8]} rotation={[0, -Math.PI / 2, 0]} fitWidth={2.7} fallback={<MarketStall position={[8.6, 0, -3.8]} rotY={-Math.PI / 2} a="#3E7CC4" b="#FFF4E0" goods="fruit" />} />
      {/* Market street: fish cart, lantern string, and the crate route to the hidden canopy chest */}
      <FishCart position={[11.4, 0, 2.9]} rotY={0.45} />
      <LanternString from={[7.2, 2.7, 2.4]} to={[7.2, 2.7, -5.4]} sag={0.4} count={8} />
      <CrateSteps />
      {/* the shops at the market stalls (Etapa 6) */}
      <ShopSigns />
      <LanternLights />
      <SecretGlint position={[8.6, 2.6, -3.8]} flag="bau_toldo" />
      {/* Luna's family house */}
      <Asset name="casa_vila" position={[6.5, 0, 12]} rotation={[0, Math.PI + 0.3, 0]} fitWidth={5.6} fallback={<House position={[6.5, 0, 12]} rotY={Math.PI + 0.3} size={[4, 2.3, 3.2]} wall="#F4E4D4" roof="#B04A5A" noren="#E8A0BF" />} />
      {/* Extra village houses */}
      <Asset name="casa_vila" position={[-13.5, 0, -2.5]} rotation={[0, Math.PI / 2, 0]} fitWidth={5.2} fallback={<House position={[-13.5, 0, -2.5]} rotY={Math.PI / 2} size={[3.6, 2.2, 3]} roof="#3F5277" />} />
      <Asset name="casa_vila" position={[13.5, 0, 7]} rotation={[0, -Math.PI / 2 - 0.2, 0]} fitWidth={5.0} fallback={<House position={[13.5, 0, 7]} rotY={-Math.PI / 2 - 0.2} size={[3.4, 2.2, 3]} roof="#C0573E" />} />
      <Asset name="casa_vila" position={[-3, 0, 14]} rotation={[0, Math.PI, 0]} fitWidth={5.4} fallback={<House position={[-3, 0, 14]} rotY={Math.PI} size={[3.8, 2.2, 3]} roof="#4F6B52" lanterns />} />

      {/* the great gate of Mikage's residence (Etapa 5), at the south end of the Training Forest */}
      <SedeGate />

      {/* Mestre Kuma's pagoda */}
      <Pagoda position={[0, 0, -15]} />
      <Asset name="templo_enigmas" position={[0, 0, -7.6]} fitWidth={4} fallback={<Torii position={[0, 0, -7.6]} />} />

      {/* Tanuki's hut */}
      <StrawHut position={[-13, 0, 9]} rotY={Math.PI / 2 - 0.3} />

      <CatStatueFountain />
      {/* Etapa 10: the third planter stood on the path to the cantina (at 1.25 pi); now between the paths */}
      {[Math.PI / 4, Math.PI * 0.89, Math.PI * 1.12].map((angle) => (
        <Planter key={angle} position={[Math.cos(angle) * 5.6, 0, Math.sin(angle) * 5.6]} rotY={-angle + Math.PI / 2} />
      ))}
    </>
  );
}
