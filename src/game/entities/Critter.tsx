import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { NPCLook } from '../../types';
import { Toon, Ink } from '../materials';
import { StaticMerge } from '../StaticMerge';

/**
 * Procedural chibi villager.
 * Mould: pear-shaped robe body (lathe) with crossed collar and obi, bell sleeves ending
 * in paws, little feet under the hem, a species tail and big anime eyes.
 * `accessory` picks the outfit colors plus a silhouette prop (hat, staff, backpack...).
 */

type Outfit = { robe: string; trim: string; obi: string; iris: string };

const OUTFITS: Record<NonNullable<NPCLook['accessory']> | 'none', Outfit> = {
  chef: { robe: '#F7F4EE', trim: '#E8553B', obi: '#E8553B', iris: '#4FA3E0' },
  happi: { robe: '#3E6FB0', trim: '#F2E6CF', obi: '#F2E6CF', iris: '#9A6233' },
  scarf: { robe: '#F4A8C4', trim: '#FFFFFF', obi: '#C2477A', iris: '#7A5BC8' },
  leaf: { robe: '#6E9E4A', trim: '#E9D9C3', obi: '#8C6440', iris: '#D9932B' },
  monk: { robe: '#3D3550', trim: '#C9A35B', obi: '#C9A35B', iris: '#7A5232' },
  sage: { robe: '#5B3E86', trim: '#F2C14E', obi: '#F2C14E', iris: '#8E6BD8' },
  rival: { robe: '#2E2A36', trim: '#D9473A', obi: '#D9473A', iris: '#E39B2B' },
  inventor: { robe: '#8C6440', trim: '#F2C14E', obi: '#5A4032', iris: '#2BB3A8' },
  guard: { robe: '#6E7380', trim: '#C9A36B', obi: '#7A5536', iris: '#8A5A2B' },
  explorer: { robe: '#5DAA4A', trim: '#F2C14E', obi: '#8C6440', iris: '#3FA34D' },
  sleeper: { robe: '#7FA6D9', trim: '#FFFFFF', obi: '#5B7FB8', iris: '#5B7FB8' },
  mystery: { robe: '#1E1B24', trim: '#C0392B', obi: '#C0392B', iris: '#E8C547' },
  vendor: { robe: '#F2E6CF', trim: '#3E6FB0', obi: '#3E6FB0', iris: '#4FA3E0' },
  granny: { robe: '#8A5BB0', trim: '#E9D9F2', obi: '#C9A35B', iris: '#8A5BB0' },
  kid: { robe: '#E8553B', trim: '#FFFFFF', obi: '#3E6FB0', iris: '#3FA34D' },
  tinker: { robe: '#3E8C8C', trim: '#F2E6D8', obi: '#7A5236', iris: '#E0A23A' },
  parkour: { robe: '#2F4A3A', trim: '#E8643A', obi: '#E8643A', iris: '#3FA0E0' },
  shrine: { robe: '#FBF7F2', trim: '#C8302C', obi: '#C8302C', iris: '#E8B33A' },
  none: { robe: '#C9A36B', trim: '#FFFFFF', obi: '#8C6440', iris: '#6B4A30' },
};

function outfitOf(look: NPCLook): Outfit {
  const o = OUTFITS[look.accessory ?? 'none'];
  return look.outfit ? { ...o, robe: look.outfit } : o;
}

const shade = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const tint = (hex: string, k: number) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#FFFFFF'), k).getHexString();

function Ears({ look }: { look: NPCLook }) {
  const c = look.fur;
  if (look.species === 'cat') {
    return (
      <>
        {[1, -1].map((s) => (
          <group key={s} position={[0.2 * s, 0.28, -0.02]} rotation={[-0.1, 0, -0.38 * s]}>
            <mesh position={[0, 0.03, 0]} scale={[1, 1, 0.55]}>
              <coneGeometry args={[0.13, 0.27, 14]} />
              <Toon color={look.accessory === 'mystery' ? '#1E1B24' : look.stripes && s === 1 ? look.stripes : c} />
              <Ink thickness={0.015} />
            </mesh>
            <mesh position={[0, 0.01, 0.045]} scale={[1, 1, 0.3]}>
              <coneGeometry args={[0.08, 0.17, 10]} />
              <Toon color="#F2A7AE" />
            </mesh>
          </group>
        ))}
      </>
    );
  }
  if (look.species === 'dog') {
    // Floppy ears hanging at the sides of the head.
    return (
      <>
        {[1, -1].map((s) => (
          <group key={s} position={[0.31 * s, 0.12, -0.02]} rotation={[0, 0, 0.35 * s]}>
            <mesh position={[0, -0.12, 0]} scale={[0.55, 1, 0.35]}>
              <sphereGeometry args={[0.16, 12, 10]} />
              <Toon color={shade(c, 0.78)} />
              <Ink thickness={0.015} />
            </mesh>
          </group>
        ))}
      </>
    );
  }
  if (look.species === 'rabbit') {
    return (
      <>
        {[1, -1].map((s) => (
          <group key={s} position={[0.12 * s, 0.32, -0.02]} rotation={[-0.15, 0, -0.18 * s]}>
            <mesh position={[0, 0.25, 0]} scale={[1, 1, 0.55]}>
              <capsuleGeometry args={[0.075, 0.38, 6, 10]} />
              <Toon color={c} />
              <Ink thickness={0.015} />
            </mesh>
            <mesh position={[0, 0.25, 0.035]} scale={[0.55, 0.85, 0.3]}>
              <capsuleGeometry args={[0.075, 0.38, 6, 10]} />
              <Toon color="#F4B7C8" />
            </mesh>
          </group>
        ))}
        <group position={[0.2, 0.33, 0.08]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.06, Math.sin((i / 5) * Math.PI * 2) * 0.06, 0]}>
              <sphereGeometry args={[0.045, 8, 6]} />
              <Toon color="#F48FB1" />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.02]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <Toon color="#FFE082" />
          </mesh>
        </group>
      </>
    );
  }
  // tanuki and bear: round ears with a lighter inner disc
  return (
    <>
      {[1, -1].map((s) => (
        <group key={s} position={[0.25 * s, 0.25, -0.03]}>
          <mesh scale={[1, 1, 0.6]}>
            <sphereGeometry args={[0.1, 12, 10]} />
            <Toon color={look.species === 'tanuki' ? '#3B2C24' : c} />
            <Ink thickness={0.015} />
          </mesh>
          <mesh position={[0, 0, 0.04]} scale={[0.6, 0.6, 0.3]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <Toon color={look.belly} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Big anime eye in the same style as Shinichi's, with any iris color. */
function AnimeEye({ side, iris, sharp, slit }: { side: 1 | -1; iris: string; sharp?: boolean; slit?: boolean }) {
  return (
    <group position={[0.13 * side, -0.01, 0.315]} rotation={[0.06, 0.4 * side, 0]} scale={sharp ? [0.9, 0.72, 0.9] : 0.88}>
      <mesh scale={[0.86, 1.12, 0.3]}>
        <sphereGeometry args={[0.1, 18, 14]} />
        <meshBasicMaterial color={shade(iris, 0.32)} />
      </mesh>
      <mesh position={[0, -0.012, 0.012]} scale={[0.74, 0.95, 0.3]}>
        <sphereGeometry args={[0.1, 18, 14]} />
        <meshBasicMaterial color={iris} />
      </mesh>
      <mesh position={[0, -0.05, 0.02]} scale={[0.52, 0.36, 0.3]}>
        <sphereGeometry args={[0.1, 14, 10]} />
        <meshBasicMaterial color={tint(iris, 0.45)} />
      </mesh>
      <mesh position={[0, 0.004, 0.028]} scale={slit ? [0.22, 0.85, 0.3] : [0.42, 0.52, 0.3]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshBasicMaterial color="#0E0B13" />
      </mesh>
      <mesh position={[-0.03 * side + 0.012, 0.045, 0.04]}>
        <sphereGeometry args={[0.027, 10, 8]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0.03 * side - 0.006, -0.042, 0.038]}>
        <sphereGeometry args={[0.012, 8, 6]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0, 0.012, 0.012]} rotation={[0, 0, Math.PI * 0.1 * side]} scale={[0.95, 1.1, 0.4]}>
        <torusGeometry args={[0.098, 0.014, 6, 18, Math.PI * 0.85]} />
        <meshBasicMaterial color="#120E18" />
      </mesh>
      {sharp && (
        <mesh position={[0, 0.16, 0.01]} rotation={[0, 0, -0.38 * side]} scale={[1, 0.5, 0.5]}>
          <capsuleGeometry args={[0.024, 0.1, 4, 8]} />
          <meshBasicMaterial color="#120E18" />
        </mesh>
      )}
    </group>
  );
}

function Eyes({ look, iris }: { look: NPCLook; iris: string }) {
  const kind = look.eyes ?? 'round';
  if (kind === 'closed' || kind === 'sleepy') {
    return (
      <>
        {[1, -1].map((s) => (
          <group key={s} position={[0.13 * s, -0.01, 0.33]} rotation={[0, 0.4 * s, 0]}>
            {kind === 'closed' ? (
              <mesh rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.055, 0.014, 6, 14, Math.PI]} />
                <meshBasicMaterial color="#17121c" />
              </mesh>
            ) : (
              <>
                <mesh position={[0, -0.01, 0]} scale={[1, 0.45, 0.3]}>
                  <sphereGeometry args={[0.07, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
                  <meshBasicMaterial color={iris} />
                </mesh>
                <mesh position={[0, -0.008, 0.012]}>
                  <boxGeometry args={[0.15, 0.016, 0.01]} />
                  <meshBasicMaterial color="#17121c" />
                </mesh>
              </>
            )}
          </group>
        ))}
      </>
    );
  }
  return (
    <>
      {[1, -1].map((s) => (
        <AnimeEye key={s} side={s as 1 | -1} iris={iris} sharp={kind === 'sharp'} slit={look.species === 'cat'} />
      ))}
    </>
  );
}

function Face({ look, iris }: { look: NPCLook; iris: string }) {
  const muzzle = look.species === 'dog' || look.species === 'bear';
  return (
    <>
      {look.mask && [1, -1].map((s) => (
        <mesh key={s} position={[0.14 * s, -0.01, 0.27]} rotation={[0, 0.4 * s, -0.3 * s]} scale={[1.35, 0.95, 0.45]}>
          <sphereGeometry args={[0.1, 12, 10]} />
          <Toon color={look.mask!} />
        </mesh>
      ))}
      {look.stripes && [-0.09, 0, 0.09].map((x, i) => (
        <mesh key={i} position={[x, 0.27, 0.2]} rotation={[-0.6, 0, x * 2]}>
          <boxGeometry args={[0.035, 0.14, 0.02]} />
          <Toon color={look.stripes!} />
        </mesh>
      ))}
      <Eyes look={look} iris={iris} />
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.22 * s, -0.1, 0.26]} rotation={[0, 0.6 * s, 0]} scale={[1, 0.55, 0.3]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshBasicMaterial color="#F5A3B5" transparent opacity={0.8} />
        </mesh>
      ))}
      {/* muzzle */}
      <mesh position={[0, -0.11, 0.29]} scale={muzzle ? [1.5, 1, 1.1] : [1.3, 0.8, 0.9]}>
        <sphereGeometry args={[0.11, 14, 10]} />
        <Toon color={look.belly} />
      </mesh>
      <mesh position={[0, -0.07, 0.39 + (muzzle ? 0.03 : 0)]} scale={[1.35, 0.85, 0.8]}>
        <sphereGeometry args={[muzzle ? 0.04 : 0.028, 8, 6]} />
        <Toon color="#3B2C30" />
      </mesh>
      {/* little "w" mouth */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.022 * s, -0.125, 0.385 + (muzzle ? 0.03 : 0)]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.022, 0.006, 4, 10, Math.PI]} />
          <meshBasicMaterial color="#3B2C30" />
        </mesh>
      ))}
      {/* whiskers for cats */}
      {look.species === 'cat' &&
        [1, -1].map((s) =>
          [0.02, -0.02].map((dy) => (
            <mesh key={`${s}${dy}`} position={[0.2 * s, -0.09 + dy, 0.3]} rotation={[0, -0.5 * s, dy * 6 * s]}>
              <boxGeometry args={[0.13, 0.006, 0.004]} />
              <meshBasicMaterial color="#5A4A50" />
            </mesh>
          ))
        )}
      {/* cheek fluff */}
      {(look.species === 'cat' || look.species === 'tanuki') &&
        [1, -1].map((s) => (
          <mesh key={s} position={[0.31 * s, -0.12, 0.08]} rotation={[0, 0, (Math.PI / 2 + 0.5) * s]} scale={[1, 1, 0.6]}>
            <coneGeometry args={[0.07, 0.16, 8]} />
            <Toon color={look.fur} />
          </mesh>
        ))}
    </>
  );
}

/** Eyelids drawn only while blinking: fur-colored caps with a dark closed-eye line. */
function Lids({ look, lidsRef }: { look: NPCLook; lidsRef: MutableRefObject<THREE.Group | null> }) {
  return (
    <group ref={lidsRef} visible={false} userData={{ dynamic: true }}>
      {[1, -1].map((s) => (
        <group key={s} position={[0.13 * s, -0.01, 0.325]} rotation={[0.06, 0.4 * s, 0]} scale={look.eyes === 'sharp' ? [0.9, 0.72, 0.9] : 0.88}>
          <mesh scale={[0.95, 1.2, 0.32]} position={[0, 0, 0.02]}>
            <sphereGeometry args={[0.1, 12, 10]} />
            <Toon color={look.fur} />
          </mesh>
          <mesh position={[0, -0.01, 0.055]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.07, 0.014, 4, 12, Math.PI]} />
            <meshBasicMaterial color="#17121c" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Tail({ look }: { look: NPCLook }) {
  const geo = useMemo(() => {
    if (look.species !== 'cat') return null;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.22, -0.28),
      new THREE.Vector3(0.02, 0.2, -0.46),
      new THREE.Vector3(0.1, 0.36, -0.6),
      new THREE.Vector3(0.14, 0.6, -0.58),
      new THREE.Vector3(0.08, 0.74, -0.48),
    ]);
    return new THREE.TubeGeometry(curve, 20, 0.05, 7, false);
  }, [look.species]);

  if (look.accessory === 'sleeper') return null;
  if (geo) {
    return (
      <>
        <mesh geometry={geo} castShadow>
          <Toon color={look.accessory === 'mystery' ? '#1E1B24' : look.fur} />
          <Ink thickness={0.015} />
        </mesh>
        <mesh position={[0.08, 0.74, -0.48]}>
          <sphereGeometry args={[0.055, 10, 8]} />
          <Toon color={look.stripes ?? (look.accessory === 'mystery' ? '#1E1B24' : look.fur)} />
        </mesh>
      </>
    );
  }
  if (look.species === 'tanuki') {
    return (
      <group position={[0, 0.25, -0.32]} rotation={[0.95, 0, 0.2]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, i * 0.13, 0]} scale={[1, 0.9, 1]}>
            <sphereGeometry args={[0.15 - i * 0.012, 12, 10]} />
            <Toon color={i % 2 ? '#3B2C24' : '#9A7A5C'} />
            {i === 0 && <Ink thickness={0.015} />}
          </mesh>
        ))}
      </group>
    );
  }
  if (look.species === 'dog') {
    return (
      <mesh position={[0, 0.4, -0.34]} rotation={[-0.7, 0, 0]}>
        <capsuleGeometry args={[0.05, 0.22, 4, 8]} />
        <Toon color={look.fur} />
        <Ink thickness={0.015} />
      </mesh>
    );
  }
  return (
    <mesh position={[0, 0.25, -0.33]}>
      <sphereGeometry args={[look.species === 'rabbit' ? 0.1 : 0.08, 12, 10]} />
      <Toon color={look.species === 'rabbit' ? '#FFFFFF' : look.fur} />
    </mesh>
  );
}

/** Pear-shaped robe body. Points are (radius, height). */
function useRobeGeometry() {
  return useMemo(() => {
    const pts = [
      [0.0, 0.1], [0.3, 0.1], [0.345, 0.18], [0.345, 0.3], [0.325, 0.44], [0.29, 0.56], [0.235, 0.68], [0.17, 0.78], [0.1, 0.84], [0.0, 0.86],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(pts, 24);
  }, []);
}

function Body({ look, o, wide, armsRef }: { look: NPCLook; o: Outfit; wide: number; armsRef: MutableRefObject<(THREE.Group | null)[]> }) {
  const robe = useRobeGeometry();
  const zs = 0.9;
  return (
    <>
      {/* feet peeking from the hem */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.13 * s, 0.07, 0.14]} scale={[1, 0.65, 1.35]} castShadow>
          <sphereGeometry args={[0.095, 10, 8]} />
          <Toon color={look.fur} />
          <Ink thickness={0.015} />
        </mesh>
      ))}
      <mesh geometry={robe} scale={[wide, 1, zs]} castShadow>
        <Toon color={o.robe} />
        <Ink thickness={0.015} />
      </mesh>
      {/* hem trim */}
      <mesh position={[0, 0.135, 0]} scale={[wide, 1, zs]}>
        <cylinderGeometry args={[0.35, 0.305, 0.07, 24]} />
        <Toon color={o.trim} />
      </mesh>
      {/* chest: fur showing in the V of the collar */}
      <mesh position={[0, 0.66, 0.15 * zs]} scale={[0.85, 1, 0.55]}>
        <sphereGeometry args={[0.15, 12, 10]} />
        <Toon color={look.belly} />
      </mesh>
      {/* crossed collar (left over right) */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0.075 * s, 0.6, 0.255 * zs]} rotation={[-0.42, 0, 0.5 * s]}>
          <boxGeometry args={[0.07, 0.34, 0.03]} />
          <Toon color={o.trim} />
        </mesh>
      ))}
      {/* obi */}
      <mesh position={[0, 0.44, 0]} scale={[wide, 1, zs]}>
        <cylinderGeometry args={[0.33, 0.335, 0.12, 24]} />
        <Toon color={o.obi} />
        <Ink thickness={0.015} />
      </mesh>
      <mesh position={[0, 0.44, -0.3 * zs]} scale={[1, 0.8, 0.6]}>
        <boxGeometry args={[0.24, 0.16, 0.1]} />
        <Toon color={o.obi} />
      </mesh>
      <mesh position={[0, 0.44, 0.31 * zs]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.06, 0.06, 0.03]} />
        <Toon color={o.trim} />
      </mesh>
      {/* bell sleeves with paws; pivot at the shoulder for waving */}
      {[1, -1].map((s, i) => (
        <group key={s} ref={(el) => (armsRef.current[i] = el)} position={[0.25 * wide * s, 0.66, 0.02]} rotation={[0, 0, 0.35 * s]} userData={{ dynamic: true }}>
          <StaticMerge chunk={0} castAll>
          <mesh position={[0, -0.13, 0]} castShadow>
            <cylinderGeometry args={[0.065, 0.11, 0.26, 12]} />
            <Toon color={o.robe} />
            <Ink thickness={0.015} />
          </mesh>
          <mesh position={[0, -0.255, 0]}>
            <cylinderGeometry args={[0.112, 0.112, 0.035, 12]} />
            <Toon color={o.trim} />
          </mesh>
          <mesh position={[0, -0.29, 0]} scale={[1, 0.9, 1]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            <Toon color={look.fur} />
            <Ink thickness={0.015} />
          </mesh>
          </StaticMerge>
        </group>
      ))}
    </>
  );
}

function Accessory({ look }: { look: NPCLook }) {
  switch (look.accessory) {
    case 'chef':
      return (
        <>
          <group position={[0, 1.42, 0]}>
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.22, 0.22, 0.22, 16]} />
              <Toon color="#FFFFFF" />
              <Ink thickness={0.015} />
            </mesh>
            {[[0, 0.3, 0], [0.13, 0.27, 0.05], [-0.13, 0.27, 0.03], [0.02, 0.28, -0.12]].map((p, i) => (
              <mesh key={i} position={p as [number, number, number]}>
                <sphereGeometry args={[0.16, 12, 10]} />
                <Toon color="#FFFFFF" />
                <Ink thickness={0.015} />
              </mesh>
            ))}
          </group>
          <mesh position={[0, 0.78, 0.04]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
            <torusGeometry args={[0.24, 0.05, 8, 20]} />
            <Toon color="#E8553B" />
          </mesh>
          <mesh position={[0, 0.42, 0.3]} rotation={[-0.15, 0, 0]}>
            <boxGeometry args={[0.38, 0.42, 0.03]} />
            <Toon color="#FFFFFF" />
          </mesh>
        </>
      );
    case 'happi':
      return (
        <>
          <mesh position={[0, 1.18, 0]} rotation={[Math.PI / 2 + 0.15, 0, 0]}>
            <torusGeometry args={[0.38, 0.035, 8, 24]} />
            <Toon color="#FFFFFF" />
          </mesh>
        </>
      );
    case 'scarf':
      return (
        <>
          <mesh position={[0, 0.78, 0.03]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
            <torusGeometry args={[0.23, 0.055, 8, 20]} />
            <Toon color="#E8A0BF" />
          </mesh>
          <mesh position={[0.12, 0.6, 0.24]} rotation={[0.2, 0, 0.3]}>
            <boxGeometry args={[0.1, 0.3, 0.02]} />
            <Toon color="#E8A0BF" />
          </mesh>
        </>
      );
    case 'leaf':
      return (
        <>
          <group position={[0, 1.45, 0.02]} rotation={[0.3, 0, 0.4]}>
            <mesh scale={[0.6, 1, 0.12]}>
              <sphereGeometry args={[0.16, 10, 8]} />
              <Toon color="#5DAA4A" />
              <Ink thickness={0.015} />
            </mesh>
          </group>
        </>
      );
    case 'monk':
      return (
        <>
          <mesh position={[0, 0.52, 0.06]} rotation={[0.2, 0, 0.65]}>
            <torusGeometry args={[0.3, 0.035, 6, 20]} />
            <Toon color="#C9A35B" />
          </mesh>
          <mesh position={[0, 0.83, 0.3]} scale={[1, 1.3, 0.6]}>
            <coneGeometry args={[0.13, 0.32, 10]} />
            <Toon color="#D7D2CC" />
            <Ink thickness={0.015} />
          </mesh>
          <group position={[0, 1.44, 0]}>
            <mesh>
              <coneGeometry args={[0.62, 0.3, 20]} />
              <Toon color="#D9B567" />
              <Ink thickness={0.015} />
            </mesh>
          </group>
          <Staff color="#6B4A30" ring="#D6B04C" />
        </>
      );
    case 'sage':
      return (
        <>
          <group position={[0, 1.38, 0]} rotation={[0.08, 0, -0.06]}>
            <mesh>
              <cylinderGeometry args={[0.72, 0.72, 0.05, 24]} />
              <Toon color="#4A3270" />
              <Ink thickness={0.015} />
            </mesh>
            <mesh position={[0, 0.16, 0]}>
              <coneGeometry args={[0.32, 0.36, 18]} />
              <Toon color="#5B3E86" />
              <Ink thickness={0.015} />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.33, 0.33, 0.06, 18]} />
              <Toon color="#F2C14E" />
            </mesh>
          </group>
          <Staff color="#E8E2D2" ring="#B9A6FF" />
        </>
      );
    case 'rival':
      return (
        <>
          <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2 + 0.2, 0, 0]}>
            <torusGeometry args={[0.37, 0.04, 8, 24]} />
            <Toon color="#D9473A" />
          </mesh>
          {[0, 1].map((i) => (
            <mesh key={i} position={[0.06 * (i ? 1 : -1), 1.12, -0.42]} rotation={[0.6, 0, i ? 0.4 : -0.4]}>
              <boxGeometry args={[0.07, 0.36, 0.01]} />
              <Toon color="#D9473A" side={THREE.DoubleSide} />
            </mesh>
          ))}
        </>
      );
    case 'inventor':
      return (
        <>
          <group position={[0, 1.27, 0.24]} rotation={[-0.4, 0, 0]}>
            {[-0.1, 0.1].map((x) => (
              <mesh key={x} position={[x, 0, 0]}>
                <torusGeometry args={[0.075, 0.025, 8, 16]} />
                <Toon color="#B07A3A" />
              </mesh>
            ))}
            {[-0.1, 0.1].map((x) => (
              <mesh key={x} position={[x, 0, -0.005]}>
                <circleGeometry args={[0.07, 14]} />
                <meshBasicMaterial color="#9FE3FF" transparent opacity={0.8} />
              </mesh>
            ))}
          </group>
          <mesh position={[0, 1.18, 0]} rotation={[Math.PI / 2 + 0.3, 0, 0]}>
            <torusGeometry args={[0.37, 0.025, 6, 24]} />
            <Toon color="#5A4032" />
          </mesh>
          <mesh position={[0, 0.55, -0.33]} castShadow>
            <boxGeometry args={[0.36, 0.42, 0.18]} />
            <Toon color="#8C6440" />
            <Ink thickness={0.015} />
          </mesh>
          <mesh position={[0.12, 0.95, -0.38]}>
            <cylinderGeometry args={[0.01, 0.01, 0.4, 4]} />
            <Toon color="#3A3340" />
          </mesh>
          <mesh position={[0.12, 1.16, -0.38]}>
            <sphereGeometry args={[0.04, 8, 6]} />
            <Toon color="#E8453B" emissive="#E8453B" emissiveIntensity={0.6} />
          </mesh>
        </>
      );
    case 'guard':
      return (
        <>
          <mesh position={[0, 0.5, 0.02]} scale={[1.12, 1, 1.05]}>
            <sphereGeometry args={[0.33, 16, 12, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.5]} />
            <Toon color="#B98A52" side={THREE.DoubleSide} />
            <Ink thickness={0.015} />
          </mesh>
          {[-0.12, 0, 0.12].map((y) => (
            <mesh key={y} position={[0, 0.5 + y, 0.33]} rotation={[0.1, 0, 0]}>
              <boxGeometry args={[0.4, 0.025, 0.02]} />
              <Toon color="#7A5536" />
            </mesh>
          ))}
          <group position={[0, 1.36, 0]}>
            <mesh scale={[1, 0.6, 1]}>
              <sphereGeometry args={[0.36, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <Toon color="#6E7380" />
              <Ink thickness={0.015} />
            </mesh>
            <mesh position={[0, 0.02, 0.3]} rotation={[0.3, 0, 0]}>
              <coneGeometry args={[0.07, 0.2, 4]} />
              <Toon color="#D6B04C" />
            </mesh>
          </group>
          <group position={[-0.45, 0.8, 0.05]}>
            <mesh>
              <cylinderGeometry args={[0.03, 0.03, 1.7, 6]} />
              <Toon color="#8C6440" />
            </mesh>
            <mesh position={[0, 0.9, 0]}>
              <sphereGeometry args={[0.07, 8, 6]} />
              <Toon color="#E6E2D8" />
            </mesh>
          </group>
        </>
      );
    case 'explorer':
      return (
        <>
          <group position={[0, 1.36, 0]} rotation={[0.1, 0, 0.1]}>
            <mesh>
              <cylinderGeometry args={[0.5, 0.5, 0.04, 20]} />
              <Toon color="#C9A36B" />
              <Ink thickness={0.015} />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <cylinderGeometry args={[0.24, 0.27, 0.22, 16]} />
              <Toon color="#C9A36B" />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.275, 0.275, 0.05, 16]} />
              <Toon color="#5DAA4A" />
            </mesh>
          </group>
          <mesh position={[0, 0.55, -0.36]} castShadow>
            <boxGeometry args={[0.45, 0.55, 0.26]} />
            <Toon color="#5DAA4A" />
            <Ink thickness={0.015} />
          </mesh>
          <mesh position={[0, 0.88, -0.36]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.5, 10]} />
            <Toon color="#B07A3A" />
          </mesh>
          <mesh position={[0, 0.78, 0.03]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
            <torusGeometry args={[0.23, 0.045, 8, 20]} />
            <Toon color="#F2C14E" />
          </mesh>
        </>
      );
    case 'sleeper':
      return (
        <mesh position={[0, 0.52, 0.05]} scale={[1.25, 0.7, 1.1]}>
          <sphereGeometry args={[0.36, 16, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65]} />
          <Toon color="#7FA6D9" side={THREE.DoubleSide} />
        </mesh>
      );
    case 'mystery':
      return (
        <>
          <mesh position={[0, 0.8, 0.03]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
            <torusGeometry args={[0.25, 0.07, 8, 20]} />
            <Toon color="#C0392B" />
          </mesh>
          <group position={[-0.18, 0.78, -0.25]} rotation={[0.9, 0.3, -0.2]}>
            <mesh position={[0, -0.25, 0]}>
              <boxGeometry args={[0.12, 0.55, 0.015]} />
              <Toon color="#C0392B" side={THREE.DoubleSide} />
            </mesh>
          </group>
          <mesh position={[0, 0.96, 0.27]} scale={[1.25, 0.55, 0.6]}>
            <sphereGeometry args={[0.2, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55]} />
            <Toon color="#C0392B" side={THREE.DoubleSide} />
          </mesh>
        </>
      );
    case 'vendor':
      return (
        <>
          {[1, -1].map((s) => (
            <mesh key={s} position={[0.11 * s, 0.95, 0.36]} rotation={[0, 0, (Math.PI / 2 - 0.35) * s]} scale={[1, 1, 0.5]}>
              <capsuleGeometry args={[0.035, 0.16, 4, 8]} />
              <Toon color="#3B2C24" />
            </mesh>
          ))}
          <mesh position={[0, 0.42, 0.27]} rotation={[-0.12, 0, 0]}>
            <boxGeometry args={[0.46, 0.5, 0.03]} />
            <Toon color="#3E6FB0" />
          </mesh>
          <mesh position={[0, 0.5, 0.29]}>
            <boxGeometry args={[0.2, 0.12, 0.01]} />
            <Toon color="#FFFFFF" />
          </mesh>
          <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2 + 0.15, 0, 0]}>
            <torusGeometry args={[0.38, 0.035, 8, 24]} />
            <Toon color="#3E6FB0" />
          </mesh>
        </>
      );
    case 'granny':
      return (
        <>
          <mesh position={[0, 0.66, 0]} rotation={[0.1, 0, 0]} scale={[1.15, 0.55, 1.05]}>
            <sphereGeometry args={[0.36, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <Toon color="#8A5BB0" side={THREE.DoubleSide} />
          </mesh>
          {[1, -1].map((s) => (
            <mesh key={s} position={[0.12 * s, 1.07, 0.33]}>
              <torusGeometry args={[0.06, 0.012, 6, 16]} />
              <meshBasicMaterial color="#5A4A3A" />
            </mesh>
          ))}
          <mesh position={[0, 1.07, 0.34]}>
            <boxGeometry args={[0.06, 0.012, 0.01]} />
            <meshBasicMaterial color="#5A4A3A" />
          </mesh>
          <mesh position={[0, 1.4, -0.08]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <Toon color="#D9D4E8" />
          </mesh>
          <group position={[0.42, 0.45, 0.15]} rotation={[0, 0, -0.1]}>
            <mesh>
              <cylinderGeometry args={[0.03, 0.03, 0.9, 6]} />
              <Toon color="#7A5536" />
            </mesh>
            <mesh position={[-0.06, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.06, 0.025, 6, 10, Math.PI]} />
              <Toon color="#7A5536" />
            </mesh>
          </group>
        </>
      );
    case 'kid':
      return (
        <group position={[0, 1.36, 0]} rotation={[0.1, 0.4, 0]}>
          <mesh scale={[1, 0.55, 1]}>
            <sphereGeometry args={[0.33, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Toon color="#E8553B" />
            <Ink thickness={0.015} />
          </mesh>
          <mesh position={[0, 0.0, 0.3]} rotation={[-0.15, 0, 0]} scale={[1, 0.15, 1]}>
            <cylinderGeometry args={[0.2, 0.2, 0.1, 14, 1, false, -Math.PI / 2, Math.PI]} />
            <Toon color="#E8553B" />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

function Staff({ color, ring }: { color: string; ring: string }) {
  return (
    <group position={[0.45, 0.75, 0.12]} rotation={[0, 0, -0.08]}>
      <mesh>
        <cylinderGeometry args={[0.035, 0.035, 1.6, 8]} />
        <Toon color={color} />
      </mesh>
      <mesh position={[0, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.02, 6, 14]} />
        <Toon color={ring} />
      </mesh>
    </group>
  );
}

export function Critter({ look, armsRef }: { look: NPCLook; armsRef: MutableRefObject<(THREE.Group | null)[]> }) {
  const wide = look.wide ?? 1;
  const o = outfitOf(look);
  const lids = useRef<THREE.Group | null>(null);
  const blink = useRef({ next: 1 + Math.random() * 4, until: 0, t: 0 });
  const canBlink = (look.eyes ?? 'round') === 'round' || look.eyes === 'sharp';

  useFrame((_s, delta) => {
    if (!canBlink || !lids.current) return;
    const b = blink.current;
    b.t += delta;
    if (b.t > b.next) {
      b.until = b.t + 0.13;
      // sometimes a quick double blink
      b.next = b.t + (Math.random() < 0.2 ? 0.3 : 2.5 + Math.random() * 3.5);
    }
    lids.current.visible = b.t < b.until;
  });

  return (
    <StaticMerge chunk={0} castAll>
      <group scale={look.scale}>
        <Body look={look} o={o} wide={wide} armsRef={armsRef} />
        <Tail look={look} />
        <group position={[0, 1.05, 0]}>
          <mesh scale={[1.08, 0.97, 1]} castShadow>
            <sphereGeometry args={[0.36, 24, 18]} />
            <Toon color={look.fur} />
            <Ink thickness={0.015} />
          </mesh>
          <Ears look={look} />
          <Face look={look} iris={o.iris} />
          {canBlink && <Lids look={look} lidsRef={lids} />}
        </group>
        <Accessory look={look} />
      </group>
    </StaticMerge>
  );
}
