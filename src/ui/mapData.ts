import type { MissionStep, Vec3 } from '../types';
import { NPCS_BY_ID } from '../data/npcs';
import { OBJECTS_BY_ID, RIVER, GARDEN, KIKO_HOUSE, SHED_POS, PILLARS, TALL_ROCK } from '../data/world';
import { TEMPLE, GATE, SHRINE, FRACTION_DOOR } from '../systems/temple';
import { EAST_FENCE, EAST_GATE, EAST_HOUSES, EAST_PLAZA, POND, TEA, RIDGE, RIDGE_Z1, LOOKOUT } from '../data/east';
import { WEST, WEST_FENCE, WEST_GATE, WEST_HOUSES, HILL, ONSEN, BOARDWALK, PIER, CLEARING } from '../data/west';
import { SOUTH_FENCE, SOUTH_GATE, STREAM, ANCIENT, MEADOW, LEDGES, LOG_BRIDGE } from '../data/south';

// minZ reaches the Templo dos Enigmas courtyard north of the fence, maxX the Bairro das Glicínias
export const MAP_BOUNDS = { minX: -42, maxX: 42, minZ: -38, maxZ: 64.5 };
/** The village rectangle itself (inside the fence). */
export const VILLAGE_RECT = { minX: -20, maxX: 20, minZ: -20, maxZ: 40.5 };

/** Footprints of structures for the 2D map: [x, z, width, depth, rotation, color]. */
export const MAP_BUILDINGS: [number, number, number, number, number, string][] = [
  [-8.5, -8.5, 5, 3.8, 0.35, '#C0573E'],
  [9.5, -10, 4.8, 4, -0.35, '#3F5277'],
  [11.5, -1.5, 3.2, 4, 0, '#4F6B52'],
  [6.5, 12, 4, 3.2, 0.3, '#B04A5A'],
  [-13.5, -2.5, 3, 3.6, 0, '#3F5277'],
  [13.5, 7, 3, 3.4, -0.2, '#C0573E'],
  [-3, 14, 3.8, 3, 0, '#4F6B52'],
  [0, -15, 4.4, 4.4, 0, '#C8463A'],
  [-13, 9, 2.5, 3, -0.3, '#CDAA5F'],
  [KIKO_HOUSE[0], KIKO_HOUSE[2], 2.6, 3.2, 0, '#5A6E8C'],
  [SHED_POS[0], SHED_POS[2], 2.4, 2, 0.2, '#7E6450'],
  [8.6, 0.7, 1, 2.2, 0, '#E8553B'],
  [8.6, -3.8, 1, 2.2, 0, '#3E7CC4'],
  [15.7, -16.1, 6.2, 5.4, 0, '#A79E90'],
  [10.4, -16.6, 4.4, 1.8, 0, '#9B6744'],
  // Templo dos Enigmas: shrine and the fraction-door wall
  [SHRINE[0], SHRINE[2], 4.4, 3.0, 0, '#3F5277'],
  [FRACTION_DOOR[0], FRACTION_DOOR[2], 5.2, 0.6, 0, '#C8B79A'],
  // Bairro das Glicínias: the houses (w and d swap with the quarter turn) and the lookout
  ...EAST_HOUSES.map((h): [number, number, number, number, number, string] => [h.pos[0], h.pos[2], h.size[2], h.size[0], 0, h.roof]),
  [(LOOKOUT.x0 + LOOKOUT.x1) / 2, (LOOKOUT.z0 + LOOKOUT.z1) / 2, LOOKOUT.x1 - LOOKOUT.x0, LOOKOUT.z1 - LOOKOUT.z0, 0, '#B5523E'],
  // Bambuzal: bathhouse and fisherman's hut (rotY 0 keeps w × d), boardwalk and pier
  ...WEST_HOUSES.map((h): [number, number, number, number, number, string] => (h.rotY === 0 ? [h.pos[0], h.pos[2], h.size[0], h.size[2], 0, h.roof] : [h.pos[0], h.pos[2], h.size[2], h.size[0], 0, h.roof])),
  [(BOARDWALK.x0 + BOARDWALK.x1) / 2, (BOARDWALK.z0 + BOARDWALK.z1) / 2, BOARDWALK.x1 - BOARDWALK.x0, BOARDWALK.z1 - BOARDWALK.z0, 0, '#9B7048'],
  [(PIER.x0 + PIER.x1) / 2, (PIER.z0 + PIER.z1) / 2, PIER.x1 - PIER.x0, PIER.z1 - PIER.z0, 0, '#9B7048'],
];

/** Shapes of the Bairro das Glicínias for the 2D map. */
export const MAP_EAST = { fence: EAST_FENCE, gate: EAST_GATE, plaza: EAST_PLAZA, pond: POND, tea: TEA, ridge: RIDGE, ridgeZ1: RIDGE_Z1 };
/** Shapes of the Bambuzal and the Bosque Antigo for the 2D map. */
export const MAP_WEST = { area: WEST, fence: WEST_FENCE, gate: WEST_GATE, hill: HILL, onsen: ONSEN, clearing: CLEARING };
export const MAP_SOUTH = { fence: SOUTH_FENCE, gate: SOUTH_GATE, stream: STREAM, ancient: ANCIENT, meadow: MEADOW, ledges: LEDGES, log: LOG_BRIDGE };

export const MAP_LABELS: { text: string; x: number; z: number }[] = [
  { text: 'Praça', x: 0, z: 2.5 },
  { text: 'Cantina', x: -8.5, z: -5.6 },
  { text: 'Templo', x: 0, z: -18 },
  { text: 'Mercado', x: 10, z: 2.2 },
  { text: 'Rio', x: -15, z: 23 },
  { text: 'Floresta do Treinamento', x: 0, z: 33.5 },
  { text: 'Oficina', x: 15, z: 19.4 },
  { text: 'Mirante', x: 15.7, z: -12.2 },
  { text: 'Gol', x: 6, z: 37.4 },
  { text: 'Templo dos Enigmas', x: 0, z: -27.5 },
  { text: 'Bairro das Glicínias', x: 30, z: -1.2 },
  { text: 'Lago', x: 31, z: 13.2 },
  { text: 'Terraços de Chá', x: 37.6, z: 7.4 },
  { text: 'Bambuzal', x: -29, z: -3 },
  { text: 'Fonte termal', x: -31.8, z: 11.4 },
  { text: 'Colina dos Jizō', x: -38, z: -12.8 },
  { text: 'Bosque Antigo', x: -2, z: 44.4 },
  { text: 'Árvore Anciã', x: 5, z: 62.4 },
  { text: 'Clareira dos Cervos', x: -11.6, z: 60.6 },
];

export { RIVER, GARDEN, PILLARS, TALL_ROCK, TEMPLE, GATE };

export function npcPosition(id: string): Vec3 | null {
  return NPCS_BY_ID[id]?.position ?? null;
}

export function stepTargetPosition(step: MissionStep): Vec3 | null {
  const t = step.target;
  if (!t) return null;
  if ('npc' in t) return npcPosition(t.npc);
  if ('object' in t) return OBJECTS_BY_ID[t.object]?.position ?? null;
  return t.position;
}
