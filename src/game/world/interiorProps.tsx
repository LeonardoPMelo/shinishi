import * as THREE from 'three';
import { Toon, Ink } from '../materials';
import type { InteriorDef, Prop } from '../../data/interiors';
import { Box, Solid, Blocker, LightPool, WOOD, DARK, PAPER, INDIGO, GOLD } from './interiorParts';

/**
 * Furniture of the academy and of Mikage's residence (Etapa 5 da expansão). Same rules as the Etapa 4 rooms:
 * boxes and simple shapes with the toon material, a collider for whatever the cat should not walk through.
 */

/** Something hung on one of the room's outer walls: position and turn so its front faces the room. */
function onWall(def: InteriorDef, p: Prop, y: number, inset = 0.08): { at: [number, number, number]; turn: number } {
  const { w, d } = def.size;
  switch (p.wall ?? 'n') {
    case 'w': return { at: [-w / 2 + inset, y, p.at[1]], turn: Math.PI / 2 };
    case 'e': return { at: [w / 2 - inset, y, p.at[1]], turn: -Math.PI / 2 };
    case 's': return { at: [p.at[0], y, d / 2 - inset], turn: Math.PI };
    default: return { at: [p.at[0], y, -d / 2 + inset], turn: 0 };
  }
}

/** The village's golden paw (never a leaf or any other emblem): a pad and four toes. */
export function PawEmblem({ scale = 1, color = GOLD }: { scale?: number; color?: string }) {
  return (
    <group scale={scale}>
      <mesh position={[0, -0.06, 0]} scale={[1, 0.85, 0.3]}>
        <sphereGeometry args={[0.16, 16, 10]} />
        <Toon color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {[[-0.17, 0.12], [-0.06, 0.2], [0.06, 0.2], [0.17, 0.12]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]} scale={[1, 1.15, 0.3]}>
          <sphereGeometry args={[0.065, 12, 8]} />
          <Toon color={color} emissive={color} emissiveIntensity={0.15} />
        </mesh>
      ))}
    </group>
  );
}

export function MorePropView({ p, def }: { p: Prop; def: InteriorDef }) {
  const rot = p.rot ?? 0;
  const pos: [number, number, number] = [p.at[0], 0, p.at[1]];
  switch (p.kind) {
    case 'plataforma': {
      const [sx, sz] = p.size ?? [1.4, 1.4];
      const h = p.h ?? 1;
      return (
        <group position={pos}>
          <Solid size={[sx, h, sz]} color={p.color ?? '#B5763E'} tex="planks" />
          {/* a lighter top so the landing reads from above */}
          <Box size={[sx + 0.06, 0.06, sz + 0.06]} at={[0, h + 0.03, 0]} color="#E6C79A" tex="wood" ink={0.015} />
        </group>
      );
    }
    case 'viga': {
      const [sx, sz] = p.size ?? [0.4, 3];
      const h = p.h ?? 1.2;
      return (
        <group position={pos}>
          <Solid size={[sx, 0.14, sz]} color="#8A5A36" tex="wood" y={h - 0.14} />
          {[-sz / 2 + 0.3, 0, sz / 2 - 0.3].map((z) => (
            <Box key={z} size={[0.16, h - 0.14, 0.16]} at={[0, (h - 0.14) / 2, z]} color={DARK} tex="wood" />
          ))}
        </group>
      );
    }
    case 'quadro_negro': {
      const { at, turn } = onWall(def, p, 1.55);
      return (
        <group position={at} rotation={[0, turn, 0]}>
          <Box size={[2.2, 1.2, 0.06]} at={[0, 0, 0]} color={WOOD} tex="wood" />
          <mesh position={[0, 0, 0.035]}>
            <planeGeometry args={[2.0, 1.02]} />
            <Toon color="#2F4A3A" />
          </mesh>
          {/* chalk: a row of numbers and an arrow */}
          {[-0.7, -0.35, 0, 0.35].map((x, i) => (
            <mesh key={x} position={[x, 0.22 - (i % 2) * 0.05, 0.04]}>
              <planeGeometry args={[0.18, 0.2]} />
              <Toon color="#E9EFE6" emissive="#E9EFE6" emissiveIntensity={0.2} />
            </mesh>
          ))}
          <mesh position={[0.62, 0.2, 0.04]}>
            <planeGeometry args={[0.24, 0.24]} />
            <Toon color="#F2D36B" emissive="#F2D36B" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, -0.22, 0.04]}>
            <planeGeometry args={[1.4, 0.04]} />
            <Toon color="#E9EFE6" />
          </mesh>
        </group>
      );
    }
    case 'quadro_pistas': {
      const { at, turn } = onWall(def, p, 1.5);
      return (
        <group position={at} rotation={[0, turn, 0]}>
          <Box size={[1.5, 1.0, 0.05]} at={[0, 0, 0]} color="#B08A5A" tex="wood" />
          {[[-0.35, 0.2], [0.35, 0.2], [-0.35, -0.22], [0.35, -0.22]].map(([x, y], i) => (
            <mesh key={i} position={[x, y, 0.032]} rotation={[0, 0, (i - 1.5) * 0.06]}>
              <planeGeometry args={[0.55, 0.34]} />
              <Toon color={PAPER} />
            </mesh>
          ))}
        </group>
      );
    }
    case 'estandarte': {
      const { at, turn } = onWall(def, p, 1.7, 0.06);
      return (
        <group position={at} rotation={[0, turn, 0]}>
          <Box size={[0.9, 0.05, 0.05]} at={[0, 0.8, 0.02]} color={DARK} tex="wood" />
          <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[0.7, 1.55]} />
            <Toon color={INDIGO} side={THREE.DoubleSide} />
          </mesh>
          <group position={[0, 0.25, 0.05]}>
            <PawEmblem scale={0.9} />
          </group>
        </group>
      );
    }
    case 'emblema': {
      const { at, turn } = onWall(def, p, 2.0, 0.07);
      return (
        <group position={at} rotation={[0, turn, 0]}>
          <mesh>
            <circleGeometry args={[0.62, 32]} />
            <Toon color={INDIGO} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <ringGeometry args={[0.56, 0.62, 32]} />
            <Toon color={GOLD} emissive={GOLD} emissiveIntensity={0.2} />
          </mesh>
          <group position={[0, 0.02, 0.03]}>
            <PawEmblem scale={1.9} />
          </group>
        </group>
      );
    }
    case 'boneco':
      // a straw training dummy on a post (a target to practise on, nothing more)
      return (
        <group position={pos}>
          <Blocker size={[0.5, 1.6, 0.5]} at={[0, 0.8, 0]} />
          <Box size={[0.12, 1.0, 0.12]} at={[0, 0.5, 0]} color={DARK} tex="wood" />
          <mesh position={[0, 1.15, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.26, 0.6, 12]} />
            <Toon color="#D8C27A" tex="thatch" />
            <Ink thickness={0.012} />
          </mesh>
          <mesh position={[0, 1.6, 0]} castShadow>
            <sphereGeometry args={[0.18, 12, 10]} />
            <Toon color="#E3CF8C" tex="thatch" />
          </mesh>
          <Box size={[0.8, 0.1, 0.1]} at={[0, 1.25, 0]} color={DARK} tex="wood" />
          <mesh position={[0, 1.6, 0.17]}>
            <circleGeometry args={[0.06, 12]} />
            <Toon color="#C0573E" />
          </mesh>
        </group>
      );
    case 'suporte_bastoes':
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <Solid size={[1.4, 0.12, 0.35]} color={WOOD} tex="wood" y={0.25} />
          <Box size={[1.4, 0.1, 0.1]} at={[0, 1.25, -0.12]} color={WOOD} tex="wood" />
          {[-0.5, -0.25, 0, 0.25, 0.5].map((x) => (
            <mesh key={x} position={[x, 0.9, -0.05]} rotation={[0.08, 0, 0]} castShadow>
              <cylinderGeometry args={[0.03, 0.03, 1.6, 6]} />
              <Toon color="#C9A26A" tex="wood" />
            </mesh>
          ))}
        </group>
      );
    case 'vaso_bambu':
      return (
        <group position={pos}>
          <Solid size={[0.5, 0.5, 0.5]} color="#7E6A5A" tex="stone" />
          {[[-0.1, 0.05, 1.8], [0.08, -0.08, 2.1], [0.05, 0.1, 1.6]].map(([x, z, h], i) => (
            <group key={i}>
              <mesh position={[x, 0.5 + h / 2, z]} castShadow>
                <cylinderGeometry args={[0.035, 0.04, h, 6]} />
                <Toon color="#6E9E4A" />
              </mesh>
              <mesh position={[x + 0.12, 0.5 + h - 0.15, z]} rotation={[0, i, 0.9]} scale={[0.25, 0.04, 0.08]}>
                <sphereGeometry args={[1, 8, 4]} />
                <Toon color="#7FB55A" />
              </mesh>
            </group>
          ))}
        </group>
      );
    case 'pedestal':
      return (
        <group position={pos}>
          <Solid size={[0.6, 0.85, 0.6]} color="#9C8F82" tex="stone" ink={0.015} />
          <Box size={[0.75, 0.08, 0.75]} at={[0, 0.89, 0]} color="#B5A898" tex="stone" />
        </group>
      );
    case 'dais': {
      const [sx, sz] = p.size ?? [3, 1.6];
      const h = p.h ?? 0.35;
      return (
        <group position={pos}>
          <Solid size={[sx, h, sz]} color="#5A3B28" tex="wood" />
          <Box size={[sx - 0.3, 0.04, sz - 0.3]} at={[0, h + 0.02, 0]} color="#D8CC8F" tex="planks" />
          {/* Mikage's cushion */}
          <mesh position={[0, h + 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.55, 0.6, 0.14, 18]} />
            <Toon color="#7A4FB0" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (sx / 2 - 0.25), h + 0.55, -sz / 2 + 0.2]} castShadow>
              <cylinderGeometry args={[0.12, 0.14, 1.1, 10]} />
              <Toon color={DARK} tex="wood" />
            </mesh>
          ))}
        </group>
      );
    }
    case 'pilar':
      return (
        <group position={pos}>
          <Blocker size={[0.4, def.size.h, 0.4]} at={[0, def.size.h / 2, 0]} />
          <mesh position={[0, def.size.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.2, def.size.h, 12]} />
            <Toon color="#7E3B32" tex="wood" />
            <Ink thickness={0.012} />
          </mesh>
          <Box size={[0.5, 0.18, 0.5]} at={[0, 0.09, 0]} color="#9C8F82" tex="stone" />
        </group>
      );
    case 'biombo':
      // a folding screen: four paper panels at alternating angles
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <Blocker size={[2.0, 1.6, 0.3]} at={[0, 0.8, 0]} />
          {[-0.75, -0.25, 0.25, 0.75].map((x, i) => (
            <group key={x} position={[x, 0.82, 0]} rotation={[0, i % 2 ? 0.35 : -0.35, 0]}>
              <Box size={[0.52, 1.6, 0.04]} at={[0, 0, 0]} color={DARK} tex="wood" />
              <mesh position={[0, 0, 0.025]}>
                <planeGeometry args={[0.44, 1.45]} />
                <Toon color={PAPER} side={THREE.DoubleSide} />
              </mesh>
              {i === 1 && (
                <mesh position={[0, 0.2, 0.03]} rotation={[0, 0, 0.6]} scale={[1, 0.25, 1]}>
                  <circleGeometry args={[0.18, 16]} />
                  <Toon color="#E8A0BF" />
                </mesh>
              )}
            </group>
          ))}
        </group>
      );
    case 'mesa_mapa':
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <Solid size={[2.4, 0.8, 1.4]} color="#5A3B28" tex="wood" />
          {/* the map: land, a river, mountains and the grid */}
          <mesh position={[0, 0.81, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.2, 1.25]} />
            <Toon color="#E9D9AE" />
          </mesh>
          <mesh position={[-0.2, 0.815, 0.05]} rotation={[-Math.PI / 2, 0, 0.5]}>
            <planeGeometry args={[1.8, 0.07]} />
            <Toon color="#5AA0C8" />
          </mesh>
          {[[0.6, -0.3], [0.8, -0.1], [0.45, -0.05]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.86, z]}>
              <coneGeometry args={[0.1, 0.12, 4]} />
              <Toon color="#8D939C" />
            </mesh>
          ))}
          {[-0.66, -0.22, 0.22, 0.66].map((x) => (
            <mesh key={x} position={[x, 0.816, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.01, 1.25]} />
              <Toon color="#8A6A3A" />
            </mesh>
          ))}
          {/* the inkwell (one of the missing pages hides under it) */}
          <mesh position={[-0.95, 0.88, -0.45]} castShadow>
            <cylinderGeometry args={[0.07, 0.08, 0.14, 10]} />
            <Toon color="#22222A" />
          </mesh>
        </group>
      );
    case 'mesa_escritorio':
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <Solid size={[2.0, 0.8, 0.9]} color="#5A3B28" tex="wood" />
          <Box size={[0.5, 0.06, 0.36]} at={[-0.45, 0.83, 0.05]} color={PAPER} />
          <Box size={[0.4, 0.1, 0.3]} at={[-0.1, 0.85, -0.1]} color={PAPER} />
          {[0.45, 0.65, 0.82].map((x, i) => (
            <mesh key={x} position={[x, 0.86, 0.12 - i * 0.12]} castShadow>
              <cylinderGeometry args={[0.06, 0.05, 0.1, 10]} />
              <Toon color="#F4EFE6" />
            </mesh>
          ))}
        </group>
      );
    case 'mesa_conselho':
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <Solid size={[3.0, 0.4, 1.1]} color="#6A4630" tex="wood" />
          <Box size={[3.1, 0.06, 1.2]} at={[0, 0.43, 0]} color="#8A5A36" tex="wood" ink={0.015} />
          {[[-1.0, 0.9], [0, 0.9], [1.0, 0.9], [-1.0, -0.9], [0, -0.9], [1.0, -0.9]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.06, z]} castShadow>
              <cylinderGeometry args={[i === 4 ? 0.36 : 0.28, i === 4 ? 0.38 : 0.3, i === 4 ? 0.16 : 0.11, 14]} />
              <Toon color={['#C0573E', '#3F5277', '#E8A33D', '#4F6B52', '#7A4FB0', '#C0573E'][i]} />
            </mesh>
          ))}
          <Box size={[0.5, 0.04, 0.35]} at={[0.6, 0.47, 0]} color={PAPER} />
        </group>
      );
    case 'lagoa': {
      const [sx, sz] = p.size ?? [3, 2];
      return (
        <group position={pos}>
          {/* a low stone rim keeps the cat out of the water */}
          <Blocker size={[sx + 0.3, 0.5, sz + 0.3]} at={[0, 0.25, 0]} />
          <mesh position={[0, 0.03, 0]} scale={[sx / 2, 1, sz / 2]}>
            <cylinderGeometry args={[1, 1, 0.05, 28]} />
            <Toon color="#3E8FB0" emissive="#2A6F90" emissiveIntensity={0.25} />
          </mesh>
          {Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * sx / 2, 0.12, Math.sin(a) * sz / 2]} scale={[1, 0.6, 1]} castShadow>
                <dodecahedronGeometry args={[0.2, 0]} />
                <Toon color="#9C958A" tex="stone" />
              </mesh>
            );
          })}
          {[['#F4F2EE', -0.5, 0.2], ['#F08A3A', 0.4, -0.2], ['#E9D9C3', 0.1, 0.45]].map(([c, x, z], i) => (
            <mesh key={i} position={[x as number, 0.07, z as number]} rotation={[0, i * 1.7, 0]} scale={[0.22, 0.05, 0.08]}>
              <sphereGeometry args={[1, 10, 6]} />
              <Toon color={c as string} />
            </mesh>
          ))}
        </group>
      );
    }
    case 'lanterna_pedra':
      return (
        <group position={pos}>
          <Blocker size={[0.5, 1.3, 0.5]} at={[0, 0.65, 0]} />
          <Box size={[0.45, 0.14, 0.45]} at={[0, 0.07, 0]} color="#9C958A" tex="stone" />
          <Box size={[0.16, 0.6, 0.16]} at={[0, 0.44, 0]} color="#9C958A" tex="stone" />
          <Box size={[0.4, 0.3, 0.4]} at={[0, 0.88, 0]} color="#A8A196" tex="stone" ink={0.012} />
          <mesh position={[0, 0.88, 0]}>
            <boxGeometry args={[0.24, 0.18, 0.42]} />
            <Toon color="#FFD27A" emissive="#FFB347" emissiveIntensity={1.1} />
          </mesh>
          <mesh position={[0, 1.13, 0]} castShadow>
            <coneGeometry args={[0.36, 0.22, 4]} />
            <Toon color="#8D877C" tex="stone" />
          </mesh>
        </group>
      );
    case 'bonsai':
      return (
        <group position={pos}>
          <Blocker size={[0.6, 0.9, 0.6]} at={[0, 0.45, 0]} />
          <Box size={[0.6, 0.25, 0.42]} at={[0, 0.125, 0]} color="#3D3552" tex="tiles" ink={0.012} />
          <mesh position={[0.05, 0.45, 0]} rotation={[0, 0, -0.4]} castShadow>
            <cylinderGeometry args={[0.04, 0.07, 0.5, 6]} />
            <Toon color="#6A4630" tex="bark" />
          </mesh>
          {[[0.18, 0.72, 0.05, 0.22], [-0.12, 0.8, -0.04, 0.18], [0.02, 0.92, 0.02, 0.16]].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]} scale={[1, 0.55, 1]} castShadow>
              <sphereGeometry args={[r, 10, 8]} />
              <Toon color={i === 2 ? '#6E9E4A' : '#5E8E3E'} />
            </mesh>
          ))}
        </group>
      );
    case 'rocha':
      return (
        <group position={pos}>
          <Blocker size={[1.1, 0.9, 0.8]} at={[0, 0.45, 0]} />
          <mesh position={[0, 0.42, 0]} scale={[1.1, 0.85, 0.8]} castShadow>
            <dodecahedronGeometry args={[0.55, 0]} />
            <Toon color="#8E887E" tex="stone" />
            <Ink thickness={0.015} />
          </mesh>
          {[0.15, 0, -0.15].map((y) => (
            <mesh key={y} position={[0, 0.48 + y, 0.43]} rotation={[-0.2, 0, 0]}>
              <planeGeometry args={[0.5, 0.05]} />
              <Toon color="#5E584E" />
            </mesh>
          ))}
        </group>
      );
    // ── decoration (cosy interiors, after Etapa 10) ──
    case 'pergaminho': {
      // a hanging scroll: a red sun over brush-painted mountains, on paper in a cloth mount
      const { at, turn } = onWall(def, p, p.h ?? 1.55, 0.05);
      return (
        <group position={at} rotation={[0, turn, 0]}>
          <Box size={[0.56, 1.2, 0.02]} at={[0, 0, 0]} color={p.color ?? '#4F6B52'} />
          <mesh position={[0, 0.03, 0.012]}>
            <planeGeometry args={[0.42, 0.92]} />
            <Toon color={PAPER} />
          </mesh>
          <mesh position={[0.09, 0.24, 0.014]}>
            <circleGeometry args={[0.065, 16]} />
            <Toon color="#C0573E" />
          </mesh>
          {[[-0.07, -0.12, 0.17], [0.1, -0.17, 0.12]].map(([x, y, r], i) => (
            <mesh key={i} position={[x, y, 0.015 + i * 0.001]} rotation={[0, 0, Math.PI / 2]}>
              <circleGeometry args={[r, 3]} />
              <Toon color={i ? '#6E7A86' : '#3F4650'} />
            </mesh>
          ))}
          {[0.62, -0.62].map((y) => (
            <mesh key={y} position={[0, y, 0.02]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.022, 0.022, y > 0 ? 0.62 : 0.68, 8]} />
              <Toon color={DARK} />
            </mesh>
          ))}
        </group>
      );
    }
    case 'relogio_parede': {
      // a small wall clock; like everything in the watchmaker's house, stopped
      const { at, turn } = onWall(def, p, p.h ?? 1.8, 0.05);
      const a = p.at[0] * 2.1;
      return (
        <group position={at} rotation={[0, turn, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.06, 20]} />
            <Toon color={p.color ?? '#7A5236'} tex="wood" />
            <Ink thickness={0.012} />
          </mesh>
          <mesh position={[0, 0, 0.032]}>
            <circleGeometry args={[0.155, 24]} />
            <Toon color="#F4EAD2" />
          </mesh>
          {[[a, 0.09, 0.022], [a * 3.3, 0.13, 0.014]].map(([turnTo, len, wd], i) => (
            <group key={i} position={[0, 0, 0.036 + i * 0.002]} rotation={[0, 0, turnTo]}>
              <mesh position={[0, len / 2, 0]}>
                <boxGeometry args={[wd, len, 0.004]} />
                <Toon color={DARK} />
              </mesh>
            </group>
          ))}
        </group>
      );
    }
    case 'planta': {
      // a potted plant: glazed pot, round leafy crown
      return (
        <group position={pos}>
          <Blocker size={[0.5, 0.9, 0.5]} at={[0, 0.45, 0]} />
          <mesh position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.18, 0.4, 14]} />
            <Toon color={p.color ?? '#A65A3A'} />
            <Ink thickness={0.012} />
          </mesh>
          <mesh position={[0, 0.405, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.02, 14]} />
            <Toon color="#4A3426" />
          </mesh>
          {[[0, 0.62, 0, 0.26], [0.14, 0.8, 0.05, 0.18], [-0.13, 0.82, -0.05, 0.17], [0.02, 0.97, -0.02, 0.14]].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]} castShadow>
              <icosahedronGeometry args={[r, 1]} />
              <Toon color={i % 2 ? '#6FA05A' : '#5E8C4A'} />
            </mesh>
          ))}
        </group>
      );
    }
    case 'arbusto': {
      // a clipped round shrub in the garden
      const s = p.size?.[0] ?? 0.9;
      return (
        <group position={pos}>
          <Blocker size={[s * 0.9, 0.8, s * 0.9]} at={[0, 0.4, 0]} />
          {[[0, 0.36, 0, 0.5], [0.22, 0.3, 0.12, 0.34], [-0.2, 0.32, -0.1, 0.36]].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x * s, y * s, z * s]} castShadow>
              <icosahedronGeometry args={[r * s, 1]} />
              <Toon color={['#557F45', '#6A9852', '#4C7340'][i]} />
            </mesh>
          ))}
        </group>
      );
    }
    case 'pedra_passo':
      // a flat stepping stone, flush with the lawn (walked over, no collider)
      return (
        <mesh position={[p.at[0], 0.03, p.at[1]]} rotation={[0, rot, 0]} scale={[1, 1, 0.78]} receiveShadow>
          <cylinderGeometry args={[0.3, 0.32, 0.06, 7]} />
          <Toon color="#A8A196" tex="stone" />
        </mesh>
      );
    case 'banco':
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <Blocker size={[1.4, 0.46, 0.42]} at={[0, 0.23, 0]} />
          <Box size={[1.4, 0.08, 0.42]} at={[0, 0.42, 0]} color="#8A5A36" tex="wood" ink={0.015} />
          {[-0.56, 0.56].map((x) => (
            <Box key={x} size={[0.09, 0.38, 0.36]} at={[x, 0.19, 0]} color={DARK} tex="wood" />
          ))}
        </group>
      );
    case 'caixas':
      // stacked wooden crates
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <Blocker size={[1.0, 0.92, 0.6]} at={[0, 0.46, 0]} />
          <Box size={[0.5, 0.45, 0.5]} at={[-0.24, 0.225, 0]} color="#B98A52" tex="planks" ink={0.015} />
          <Box size={[0.46, 0.4, 0.46]} at={[0.26, 0.2, 0.03]} color="#A87A45" tex="planks" ink={0.015} />
          <Box size={[0.42, 0.42, 0.42]} at={[-0.1, 0.66, -0.02]} color="#C49A62" tex="planks" ink={0.015} rot={0.25} />
        </group>
      );
    case 'luminaria':
      // a standing paper lamp (andon), with its warm light on the floor
      return (
        <group position={pos}>
          <Blocker size={[0.42, 0.9, 0.42]} at={[0, 0.45, 0]} />
          {[[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].map(([x, z]) => (
            <Box key={`${x}${z}`} size={[0.04, 0.9, 0.04]} at={[x, 0.45, z]} color={DARK} />
          ))}
          <mesh position={[0, 0.56, 0]}>
            <boxGeometry args={[0.32, 0.5, 0.32]} />
            <Toon color="#FFF1D2" emissive="#FFD9A0" emissiveIntensity={0.9} />
          </mesh>
          <Box size={[0.38, 0.04, 0.38]} at={[0, 0.84, 0]} color={DARK} />
          <Box size={[0.38, 0.04, 0.38]} at={[0, 0.3, 0]} color={DARK} />
          <LightPool at={[0, 0]} size={[2.2, 2.2]} color="#FFC27A" opacity={0.3} />
        </group>
      );
    case 'estatua_guardia':
      // a stone cat guardian, asleep (it never wakes; the floor is what listens)
      return (
        <group position={pos}>
          <Blocker size={[0.8, 1.3, 0.8]} at={[0, 0.65, 0]} />
          <Box size={[0.8, 0.3, 0.8]} at={[0, 0.15, 0]} color="#9C958A" tex="stone" />
          <mesh position={[0, 0.62, 0]} scale={[1, 0.85, 1.1]} castShadow>
            <sphereGeometry args={[0.32, 14, 10]} />
            <Toon color="#B0AAA0" tex="stone" />
            <Ink thickness={0.012} />
          </mesh>
          <mesh position={[0, 1.0, 0.1]} castShadow>
            <sphereGeometry args={[0.22, 14, 10]} />
            <Toon color="#B0AAA0" tex="stone" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.12, 1.2, 0.1]} rotation={[0, 0, s * -0.3]}>
              <coneGeometry args={[0.07, 0.14, 4]} />
              <Toon color="#B0AAA0" tex="stone" />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.08, 1.02, 0.31]} rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[0.008, 0.06, 2, 4]} />
              <Toon color="#5E584E" />
            </mesh>
          ))}
        </group>
      );
  }
  return null;
}

/** A patch of floor with its own ground, laid over the room's planks. */
export function FloorPatchView({ rect, kind }: { rect: [number, number, number, number]; kind: 'grama' | 'cascalho' | 'tatami' | 'pedra' | 'rouxinol' }) {
  const [x0, z0, x1, z1] = rect;
  const w = x1 - x0;
  const d = z1 - z0;
  const c: [number, number, number] = [(x0 + x1) / 2, 0.006, (z0 + z1) / 2];
  if (kind === 'tatami') {
    // mats of 1.8 × 0.9 m with dark borders, the way real tatami rooms are measured
    const cols = Math.max(1, Math.round(w / 1.8));
    const rows = Math.max(1, Math.round(d / 0.9));
    return (
      <group position={c}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <Toon color="#D6C98C" tex="planks" />
        </mesh>
        {Array.from({ length: cols + 1 }, (_, i) => (
          <mesh key={`c${i}`} position={[-w / 2 + (i * w) / cols, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.05, d]} />
            <Toon color="#3B4A3A" />
          </mesh>
        ))}
        {Array.from({ length: rows + 1 }, (_, i) => (
          <mesh key={`r${i}`} position={[0, 0.002, -d / 2 + (i * d) / rows]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w, 0.05]} />
            <Toon color="#3B4A3A" />
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === 'cascalho') {
    // raked sand, as in a Japanese garden: one colour and fine lines (the cobble texture read as big blotches)
    return (
      <group position={c}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <Toon color="#DCD2BC" />
        </mesh>
        {Array.from({ length: Math.floor(d / 0.45) }, (_, i) => (
          <mesh key={i} position={[0, 0.002, -d / 2 + 0.22 + i * 0.45]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w - 0.3, 0.035]} />
            <Toon color="#C4B89E" />
          </mesh>
        ))}
      </group>
    );
  }
  const look = {
    grama: { color: '#7FA65A', tex: undefined },
    pedra: { color: '#B8B0A2', tex: 'tiles' as const },
    rouxinol: { color: '#5E3F2C', tex: 'planks' as const },
  }[kind];
  return (
    <group position={c}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <Toon color={look.color} tex={look.tex} />
      </mesh>
      {kind === 'rouxinol' && (
        // polished boards with brass nail heads: the nightingale floor looks different on purpose
        Array.from({ length: Math.floor(d / 0.6) }, (_, i) => (
          <group key={i}>
            <mesh position={[0, 0.003, -d / 2 + 0.3 + i * 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w, 0.03]} />
              <Toon color="#2E1E14" />
            </mesh>
            {[-w / 2 + 0.2, w / 2 - 0.2].map((x) => (
              <mesh key={x} position={[x, 0.004, -d / 2 + 0.3 + i * 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.03, 8]} />
                <Toon color="#C9A04A" emissive="#C9A04A" emissiveIntensity={0.2} />
              </mesh>
            ))}
          </group>
        ))
      )}
    </group>
  );
}
