import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { treeLineSpots, distanceToWalkable } from '../src/game/world/TreeLine';
import { pickInteractable, type Interactable } from '../src/game/systems/interaction';
import { WORLD_OBJECTS, OBJECTS_BY_ID } from '../src/data/world';
import { NPC_DEFINITIONS } from '../src/data/npcs';
import { TEMPLE, SHRINE, FRACTION_LEVER, FRACTION_DOOR, gongSpot } from '../src/systems/temple';
import { WEST_TREES, WEST_PATHS } from '../src/data/west';
import { TRAIL_GATE, WILD_TRAILS, inWall } from '../src/data/wild';
import { STELES } from '../src/data/story';
import { MIRANTE } from '../src/data/world2';

/**
 * Etapa 10: things in the way. The user saw, on a phone, the tree band growing all over the temple's puzzles;
 * a review then found trees on paths, over mission objects and inside the trail gate, and an everyday object
 * stealing the interact button from a mission one. These keep it from coming back.
 */

const segDist = (x: number, z: number, line: [number, number][]) => {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i];
    const [bx, bz] = line[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
};

describe('o cinturão de árvores não invade lugar nenhum', () => {
  const spots = treeLineSpots();

  it('nenhuma árvore dentro do pátio do templo, nem a menos de 4 m dele', () => {
    const outside = (x: number, z: number) => Math.hypot(Math.max(TEMPLE.minX - x, 0, x - TEMPLE.maxX), Math.max(TEMPLE.minZ - z, 0, z - TEMPLE.maxZ));
    expect(spots.filter((s) => outside(s.x, s.z) < 4)).toEqual([]);
    expect(distanceToWalkable(0, -30)).toBe(0);
  });

  it('nenhuma árvore a menos de 3 m de um objeto ou morador', () => {
    const things = [
      ...WORLD_OBJECTS.filter((o) => o.position[0] < 150).map((o) => ({ id: o.id, x: o.position[0], z: o.position[2] })),
      ...NPC_DEFINITIONS.filter((n) => n.position[0] < 150).map((n) => ({ id: n.id, x: n.position[0], z: n.position[2] })),
    ];
    const close = spots.flatMap((s) => things.filter((t) => Math.hypot(t.x - s.x, t.z - s.z) < 3).map((t) => `${t.id} @ ${s.x.toFixed(1)},${s.z.toFixed(1)}`));
    expect(close).toEqual([]);
  });
});

describe('árvores e objetos colocados à mão', () => {
  it('as árvores do Bambuzal ficam fora das trilhas e do portão da Trilha da Expedição', () => {
    for (const t of WEST_TREES) {
      const [x, , z] = t.pos;
      expect(Math.min(...WEST_PATHS.map((l) => segDist(x, z, l))), `${x},${z}`).toBeGreaterThan(1.2);
      expect(Math.hypot(x - TRAIL_GATE.at[0], z - TRAIL_GATE.at[2]), `${x},${z} × portão`).toBeGreaterThan(2.4);
    }
  });

  it('o pedestal do Sol fica no santuário, longe da alavanca das frações e dos gongos', () => {
    const p = OBJECTS_BY_ID.pedestal_sol.position;
    expect(Math.abs(p[0] - SHRINE[0])).toBeLessThan(0.5);
    expect(Math.hypot(p[0] - FRACTION_LEVER[0], p[2] - FRACTION_LEVER[2])).toBeGreaterThan(3);
    expect(Math.hypot(p[0] - FRACTION_DOOR[0], p[2] - FRACTION_DOOR[2])).toBeGreaterThan(3);
    for (let k = 0; k < 5; k++) {
      const [gx, gz] = gongSpot(k, 5);
      expect(Math.hypot(p[0] - gx, p[2] - gz), `gongo ${k}`).toBeGreaterThan(1.8);
    }
  });

  it('a estela do Salto fica em cima do Mirante, no canto livre', () => {
    const s = STELES.find((x) => x.id === 'estela_salto')!.at;
    expect(s[1]).toBe(MIRANTE.h);
    expect(s[0] > MIRANTE.x0 && s[0] < MIRANTE.x1 && s[2] > MIRANTE.z0 && s[2] < MIRANTE.z1).toBe(true);
  });
});

describe('as trilhas das terras selvagens', () => {
  it('nenhuma passa por dentro de um paredão (uma passava pelo do desfiladeiro)', () => {
    const inside: string[] = [];
    WILD_TRAILS.forEach((line, ti) => {
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = line[i];
        const [bx, bz] = line[i + 1];
        const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25);
        for (let k = 0; k <= n; k++) {
          const x = ax + ((bx - ax) * k) / n;
          const z = az + ((bz - az) * k) / n;
          if (inWall(x, z, 0.35)) inside.push(`trilha ${ti}: ${x.toFixed(1)},${z.toFixed(1)}`);
        }
      }
    });
    expect(inside).toEqual([]);
  });
});

describe('o botão de interagir vai para o que importa', () => {
  const item = (id: string, x: number, priority?: number): Interactable => ({
    id, position: new THREE.Vector3(x, 0, 0), radius: 2, label: () => id, onInteract: () => {}, priority,
  });

  it('um objeto de missão ganha de um comum no mesmo lugar, mesmo um pouco mais longe', () => {
    const picked = pickInteractable([item('fonte', 0.1), item('lanterna', 0.4, 1)], { x: 0, y: 0, z: 0 }, 'playing');
    expect(picked?.item.id).toBe('lanterna');
    // without priority the nearest still wins
    expect(pickInteractable([item('a', 1), item('b', 0.5)], { x: 0, y: 0, z: 0 }, 'playing')?.item.id).toBe('b');
  });

  it('a Lanterna da Memória e o sino dos pilares têm prioridade sobre a fonte e o baú do mesmo lugar', () => {
    expect(OBJECTS_BY_ID.lanterna_memoria.priority ?? 0).toBeGreaterThan(OBJECTS_BY_ID.fonte.priority ?? 0);
    expect(OBJECTS_BY_ID.sino_pilar.priority ?? 0).toBeGreaterThan(OBJECTS_BY_ID.bau_floresta.priority ?? 0);
  });
});
