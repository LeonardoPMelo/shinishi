import type { Challenge, Condition, Item, Mission, NPCDefinition, Vec3 } from '../types';
import type { WorldObject } from './world';
import type { Rect } from './regions';

/**
 * Houses you can walk into (Etapa 4 da expansão). Each interior is a real room in the same physics world,
 * built far east of the map (x ≥ 200, beyond the fog), with an open top so the camera can look in from
 * above. A door on the house outside and one inside take the cat between them (game/systems/zone.ts); the
 * outdoor world is hidden while inside.
 *
 * Everything an interior needs is data here: the house outside (to place the door), the room, its furniture,
 * and its interactive objects, which are ordinary world objects (examine, chests, clues) placed in the room,
 * so missions, chests and the save treat them like any other.
 */

export type PropKind =
  | 'balcao' | 'fogao' | 'mesa_baixa' | 'almofada' | 'prateleira' | 'barril' | 'aquario' | 'lanterna'
  | 'relogio' | 'bancada' | 'estante' | 'movel_coberto' | 'tapete' | 'teia' | 'janela' | 'quadro_receitas'
  // Etapa 5: the academy and Mikage's residence (game/world/interiorProps.tsx)
  | 'plataforma' | 'viga' | 'quadro_negro' | 'estandarte' | 'boneco' | 'suporte_bastoes' | 'vaso_bambu'
  | 'pedestal' | 'quadro_pistas' | 'dais' | 'pilar' | 'emblema' | 'biombo' | 'mesa_mapa' | 'mesa_escritorio'
  | 'lagoa' | 'lanterna_pedra' | 'bonsai' | 'rocha' | 'mesa_conselho' | 'estatua_guardia'
  // interiores aconchegantes (pós-Etapa 10): decoração
  | 'pergaminho' | 'relogio_parede' | 'planta' | 'arbusto' | 'pedra_passo' | 'banco' | 'caixas' | 'luminaria';

export interface Prop {
  kind: PropKind;
  /** Room coordinates: x across, z along (+z is the door wall); metres from the room centre. */
  at: [number, number];
  /** Turn around the vertical axis (radians). */
  rot?: number;
  /** Wall props: which wall they hang on. */
  wall?: 'n' | 's' | 'e' | 'w';
  color?: string;
  /** Footprint (x, z) in metres, for props that come in sizes (platforms, beams, rugs, ponds, cushions, shrubs). */
  size?: [number, number];
  /** Height of the top (platforms, beams, the dais); for wall decorations, the height they hang at. */
  h?: number;
}

/**
 * An inner wall, straight along x or z, from one point to another (room coordinates), with doorways cut in it.
 * Drawn lower than the room (the camera looks over it) but solid all the way up.
 */
export interface Partition {
  from: [number, number];
  to: [number, number];
  /** Doorways: centre along the wall (the x or z that varies) and width. */
  gaps?: { at: number; w: number }[];
}

/** A rectangle in room coordinates: [minX, minZ, maxX, maxZ]. */
export type RoomRect = [number, number, number, number];

/** A part of the floor with its own ground: a garden lawn, gravel, tatami, nightingale boards. */
export interface FloorPatch {
  rect: RoomRect;
  kind: 'grama' | 'cascalho' | 'tatami' | 'pedra' | 'rouxinol';
}

export interface InteriorDef {
  id: string;
  name: string;
  /** Room centre in the world (far east of the map). */
  origin: [number, number];
  /** Inner width (x), depth (z) and wall height. */
  size: { w: number; d: number; h: number };
  floor: string;
  wall: string;
  wainscot: string;
  /** Warm light colour inside. */
  light: string;
  /** The house outside: centre, turn, width and depth, as built in world/Buildings.tsx (the door is on its +z side). */
  house: { c: [number, number]; rot: number; w: number; d: number };
  props: Prop[];
  /** Inner walls (big buildings with several rooms). */
  partitions?: Partition[];
  floors?: FloorPatch[];
  /** Named parts of the building, shown in the HUD while the cat is in them. */
  areas?: { name: string; rect: RoomRect }[];
  /** Camera inside (bigger buildings need it higher and farther). */
  view?: { phi: number; distance: number };
  /** The door outside only opens while this holds; otherwise it says why. */
  lock?: { unless: Condition; label: string; text: string };
}

export const INTERIORS: InteriorDef[] = [
  {
    id: 'cantina',
    name: 'Cantina da Chef Hana',
    origin: [200, 0],
    size: { w: 9, d: 7, h: 2.7 },
    floor: '#9B6B43',
    wall: '#F3E3C8',
    wainscot: '#8A5A36',
    light: '#FFC88A',
    house: { c: [-8.5, -8.5], rot: 0.35, w: 5, d: 3.8 },
    props: [
      { kind: 'balcao', at: [0.5, -2.6] },
      { kind: 'fogao', at: [-3.4, -2.9] },
      { kind: 'prateleira', at: [2.6, -3.3], wall: 'n' },
      { kind: 'prateleira', at: [-1.2, -3.3], wall: 'n' },
      { kind: 'quadro_receitas', at: [-4.35, -0.6], wall: 'w' },
      { kind: 'aquario', at: [4.05, -0.4], rot: -Math.PI / 2 },
      { kind: 'mesa_baixa', at: [-2.4, 0.9] },
      { kind: 'mesa_baixa', at: [0.6, 1.1] },
      { kind: 'mesa_baixa', at: [3.0, 2.1] },
      { kind: 'almofada', at: [-2.4, 0.15] }, { kind: 'almofada', at: [-2.4, 1.65] }, { kind: 'almofada', at: [-3.25, 0.9] }, { kind: 'almofada', at: [-1.55, 0.9] },
      { kind: 'almofada', at: [0.6, 0.35] }, { kind: 'almofada', at: [0.6, 1.85] }, { kind: 'almofada', at: [-0.25, 1.1] }, { kind: 'almofada', at: [1.45, 1.1] },
      { kind: 'almofada', at: [3.0, 1.35] }, { kind: 'almofada', at: [3.0, 2.85] }, { kind: 'almofada', at: [2.15, 2.1] }, { kind: 'almofada', at: [3.85, 2.1] },
      { kind: 'barril', at: [-3.9, -1.6] },
      { kind: 'barril', at: [-3.9, 2.9] },
      { kind: 'lanterna', at: [-1, 0.5] },
      { kind: 'lanterna', at: [2, 0.5] },
      { kind: 'janela', at: [-4.5, 2.0], wall: 'w' },
      { kind: 'janela', at: [4.5, 2.2], wall: 'e' },
      // cosy: a rug under each table, a plant in the free corner and a scroll over it
      { kind: 'tapete', at: [-2.4, 0.9], size: [2.3, 2.1], color: '#B5603F' },
      { kind: 'tapete', at: [0.6, 1.1], size: [2.3, 2.1], color: '#5B6E8C' },
      { kind: 'tapete', at: [3.0, 2.1], size: [2.3, 2.1], color: '#7A8C5B' },
      { kind: 'planta', at: [4.0, -2.95] },
      { kind: 'pergaminho', at: [4.5, -2.3], wall: 'e', color: '#7E3B32' },
    ],
  },
  {
    id: 'relojoeiro',
    name: 'Casa do Relojoeiro',
    origin: [230, 0],
    size: { w: 7, d: 6, h: 2.5 },
    floor: '#5E4636',
    wall: '#D9CBB2',
    wainscot: '#4D382B',
    light: '#E8C27A',
    house: { c: [-13.5, -2.5], rot: Math.PI / 2, w: 3.6, d: 3 },
    props: [
      { kind: 'relogio', at: [0, -2.75] },
      { kind: 'bancada', at: [-2.3, -2.4] },
      { kind: 'estante', at: [3.25, -1.2], rot: -Math.PI / 2 },
      { kind: 'movel_coberto', at: [2.3, 1.7] },
      { kind: 'movel_coberto', at: [-2.6, 1.4], color: '#CFC6B6' },
      { kind: 'tapete', at: [0, 0.4], color: '#7E3B32' },
      { kind: 'teia', at: [-3.4, -2.9] },
      { kind: 'teia', at: [3.4, -2.9] },
      { kind: 'teia', at: [3.4, 2.9] },
      { kind: 'lanterna', at: [0, 0.2] },
      { kind: 'janela', at: [-3.5, 0.2], wall: 'w' },
      // the old watchmaker's things: small clocks (all stopped), crates of parts, a faded scroll
      { kind: 'relogio_parede', at: [-1.3, -3], wall: 'n', h: 1.75 },
      { kind: 'relogio_parede', at: [1.45, -3], wall: 'n', h: 1.95, color: '#5A3B28' },
      { kind: 'relogio_parede', at: [2.55, -3], wall: 'n', h: 1.55, color: '#8A5A36' },
      { kind: 'caixas', at: [2.55, -2.5] },
      { kind: 'pergaminho', at: [-3.5, -1.55], wall: 'w', color: '#8C8478' },
    ],
  },
  // ── Etapa 5: the Ninja Academy, inside the dojo on the plaza's north-east ──
  {
    id: 'academia',
    name: 'Academia Ninja',
    origin: [260, 0],
    size: { w: 17, d: 13, h: 3.0 },
    floor: '#A8794E',
    wall: '#F4EBDD',
    wainscot: '#6E4A33',
    light: '#FFE2B0',
    house: { c: [9.5, -10], rot: -0.35, w: 4.8, d: 4 },
    view: { phi: 0.86, distance: 7.4 },
    partitions: [
      // hall | numbers room
      { from: [-3, 0], to: [-3, 6.5], gaps: [{ at: 4.0, w: 1.6 }] },
      // numbers room | logic room
      { from: [-8.5, 0], to: [-1.2, 0], gaps: [{ at: -5.75, w: 1.4 }] },
      // the nightingale corridor, between the logic room and the yard
      { from: [-1.2, -6.5], to: [-1.2, 0] },
      { from: [1.2, -6.5], to: [1.2, 0] },
    ],
    floors: [
      { rect: [-8.5, 0, -3, 6.5], kind: 'tatami' },
      { rect: [-1.2, -5.4, 1.2, -0.4], kind: 'rouxinol' },
      { rect: [1.2, -6.5, 8.5, 6.5], kind: 'cascalho' },
    ],
    areas: [
      { name: 'Sala dos Números', rect: [-8.5, 0, -3, 6.5] },
      { name: 'Sala da Lógica', rect: [-8.5, -6.5, -1.2, 0] },
      { name: 'Corredor do Rouxinol', rect: [-1.2, -6.5, 1.2, 0] },
      { name: 'Circuito das Patas', rect: [1.2, -6.5, 8.5, 6.5] },
      { name: 'Entrada da Academia', rect: [-3, 0, 1.2, 6.5] },
    ],
    props: [
      // circuit (rules and checkpoints in data/academy.ts)
      { kind: 'plataforma', at: [7.0, 3.0], size: [1.6, 1.6], h: 0.6, color: '#C98A4B' },
      { kind: 'plataforma', at: [7.0, 0.0], size: [1.6, 1.6], h: 1.2, color: '#B5763E' },
      { kind: 'viga', at: [7.0, -2.5], size: [0.4, 3.4], h: 1.2 },
      { kind: 'plataforma', at: [7.0, -5.1], size: [1.4, 1.4], h: 1.2, color: '#B5763E' },
      // steps sized for a walking jump (~2 m of flight): narrow gaps, wide landings (a 0.8 m step was overshot in play)
      { kind: 'plataforma', at: [5.2, -5.2], size: [1.4, 1.2], h: 1.5, color: '#9E6534' },
      { kind: 'plataforma', at: [2.9, -5.2], size: [1.8, 1.6], h: 1.8, color: '#8A5530' },
      { kind: 'plataforma', at: [4.6, -2.0], size: [1.2, 1.2], h: 2.9, color: '#6E4A33' },
      { kind: 'boneco', at: [8.0, -6.0] },
      { kind: 'suporte_bastoes', at: [8.1, 5.6], rot: -Math.PI / 2 },
      // numbers room
      { kind: 'quadro_negro', at: [-8.5, 3.2], wall: 'w' },
      { kind: 'mesa_baixa', at: [-5.2, 2.6] },
      { kind: 'mesa_baixa', at: [-5.2, 4.9] },
      { kind: 'almofada', at: [-5.2, 3.3] }, { kind: 'almofada', at: [-5.2, 5.6] },
      { kind: 'vaso_bambu', at: [-3.6, 6.0] },
      // logic room
      { kind: 'quadro_pistas', at: [-8.5, -3.2], wall: 'w' },
      { kind: 'vaso_bambu', at: [-8.0, -0.6] },
      // corridor: the scroll at its end
      { kind: 'pedestal', at: [0, -5.95] },
      // hall
      { kind: 'vaso_bambu', at: [-2.5, 0.6] },
      { kind: 'lanterna', at: [-1, 3.5] },
      { kind: 'lanterna', at: [-6, 3] },
      { kind: 'lanterna', at: [-5, -3] },
      { kind: 'lanterna', at: [5, 1] },
      { kind: 'janela', at: [-8.5, 5.2], wall: 'w' },
      { kind: 'janela', at: [8.5, -1.5], wall: 'e' },
      // cosy: a bench and plants at the entrance, scrolls in the classrooms, a bench to watch the circuit
      { kind: 'banco', at: [-2.55, 2.0], rot: Math.PI / 2 },
      { kind: 'planta', at: [-2.45, 5.95] },
      { kind: 'planta', at: [1.65, 6.0], color: '#3F5277' },
      { kind: 'pergaminho', at: [-8.5, 0.95], wall: 'w', color: '#3F5277' },
      { kind: 'pergaminho', at: [-2.1, -6.5], wall: 'n', color: '#4F6B52' },
      { kind: 'banco', at: [2.25, 5.75] },
    ],
  },
  // ── Etapa 5: the residence and seat of Mikage, behind the great gate at the far (south) end of the Training Forest ──
  {
    id: 'sede',
    name: 'Sede de Mikage',
    origin: [300, 0],
    size: { w: 22, d: 20, h: 3.2 },
    floor: '#8E6542',
    wall: '#F1E6D2',
    wainscot: '#3D3552',
    light: '#FFE6B8',
    house: { c: [-9, 62.6], rot: Math.PI, w: 3, d: 1.6 },
    view: { phi: 0.9, distance: 8.2 },
    lock: {
      unless: { flag: 'acesso_sede' },
      label: 'Portão da Sede (fechado)',
      text: 'O portão está fechado. O Guarda Toshi deixa entrar quem se formou na Academia Ninja (no dojô, perto da praça).',
    },
    partitions: [
      // front of the main building: the hall in the middle, a door to each wing
      { from: [-11, 0], to: [11, 0], gaps: [{ at: 0, w: 2.2 }, { at: -7.5, w: 1.4 }, { at: 7.5, w: 1.4 }] },
      { from: [-4, -10], to: [-4, 0], gaps: [{ at: -2.5, w: 1.4 }, { at: -7.5, w: 1.4 }] },
      { from: [4, -10], to: [4, 0], gaps: [{ at: -2.5, w: 1.4 }, { at: -7.5, w: 1.4 }] },
      { from: [-11, -5], to: [-4, -5] },
      // library | map room and the reserved room: the secret doorway hides behind a bookcase
      { from: [4, -5], to: [11, -5], gaps: [{ at: 9.5, w: 1.4 }] },
      { from: [8, -10], to: [8, -5] },
    ],
    floors: [
      { rect: [-11, 0, -3, 10], kind: 'grama' },
      { rect: [3, 0, 11, 10], kind: 'cascalho' },
      { rect: [-3, 0, 3, 10], kind: 'pedra' },
      { rect: [-4, -10, 4, 0], kind: 'tatami' },
      { rect: [8, -8.8, 11, -5.6], kind: 'rouxinol' },
    ],
    areas: [
      { name: 'Jardim Ornamental', rect: [-11, 0, -3, 10] },
      { name: 'Pátio de Treinamento', rect: [3, 0, 11, 10] },
      { name: 'Portão de Entrada', rect: [-3, 0, 3, 10] },
      { name: 'Salão de Audiências', rect: [-4, -10, 4, 0] },
      { name: 'Sala de Reuniões', rect: [-11, -5, -4, 0] },
      { name: 'Escritório de Mikage', rect: [-11, -10, -4, -5] },
      { name: 'Biblioteca', rect: [4, -5, 11, 0] },
      { name: 'Sala de Mapas', rect: [4, -10, 8, -5] },
      { name: 'Área Reservada', rect: [8, -10, 11, -5] },
    ],
    props: [
      // garden
      { kind: 'lagoa', at: [-7.5, 5.6], size: [3.2, 2.2] },
      { kind: 'lanterna_pedra', at: [-4.2, 8.4] },
      { kind: 'lanterna_pedra', at: [-10.2, 1.6] },
      { kind: 'bonsai', at: [-10.0, 8.8] },
      { kind: 'bonsai', at: [-4.8, 1.4] },
      { kind: 'rocha', at: [-4.6, 3.8] },
      { kind: 'vaso_bambu', at: [-10.4, 4.6] },
      // stepping stones from the gate path to the Pact stone and the pond, shrubs, a bench facing the carp
      { kind: 'pedra_passo', at: [-3.5, 6.6], rot: 0.3 },
      { kind: 'pedra_passo', at: [-4.2, 6.0], rot: 1.1 },
      { kind: 'pedra_passo', at: [-4.9, 5.4], rot: 2.0 },
      { kind: 'pedra_passo', at: [-5.3, 4.6], rot: 0.7 },
      { kind: 'pedra_passo', at: [-6.1, 4.05], rot: 1.6 },
      { kind: 'pedra_passo', at: [-6.95, 3.8], rot: 2.6 },
      { kind: 'arbusto', at: [-10.1, 2.9] },
      { kind: 'arbusto', at: [-10.3, 6.8], size: [0.8, 0.8] },
      { kind: 'arbusto', at: [-5.5, 9.2] },
      { kind: 'arbusto', at: [-8.3, 9.1], size: [1.0, 1.0] },
      { kind: 'banco', at: [-7.5, 8.0] },
      { kind: 'planta', at: [-1.9, 0.6] },
      { kind: 'planta', at: [1.9, 0.6] },
      // training yard
      { kind: 'banco', at: [4.5, 9.4] },
      { kind: 'boneco', at: [9.6, 8.6] },
      { kind: 'boneco', at: [9.6, 6.4] },
      { kind: 'suporte_bastoes', at: [10.6, 3.0], rot: -Math.PI / 2 },
      // audience hall
      { kind: 'dais', at: [0, -8.6], size: [3.4, 1.8], h: 0.35 },
      { kind: 'emblema', at: [0, -10], wall: 'n' },
      { kind: 'tapete', at: [0, -4.4], size: [2.0, 6.0], color: '#3D3552' },
      { kind: 'pilar', at: [-2.8, -2.0] }, { kind: 'pilar', at: [2.8, -2.0] },
      { kind: 'pilar', at: [-2.8, -6.6] }, { kind: 'pilar', at: [2.8, -6.6] },
      { kind: 'estandarte', at: [-2.4, -10], wall: 'n' },
      { kind: 'estandarte', at: [2.4, -10], wall: 'n' },
      { kind: 'luminaria', at: [-3.35, -9.35] },
      { kind: 'luminaria', at: [3.35, -9.35] },
      // meeting room: cushions round the council table, the big one at its head (a page hides under it), and
      // the supply crates the council counts (they were only a hint in the air)
      { kind: 'mesa_conselho', at: [-7.5, -2.6] },
      { kind: 'almofada', at: [-8.5, -1.7] }, { kind: 'almofada', at: [-7.5, -1.7] }, { kind: 'almofada', at: [-6.5, -1.7] },
      { kind: 'almofada', at: [-8.5, -3.5] }, { kind: 'almofada', at: [-7.5, -3.5] }, { kind: 'almofada', at: [-6.5, -3.5] },
      { kind: 'almofada', at: [-5.6, -2.6], size: [0.8, 0.8], color: '#3D3552' },
      { kind: 'caixas', at: [-10.0, -4.3] },
      { kind: 'biombo', at: [-10.3, -1.0], rot: Math.PI / 2 },
      // office
      { kind: 'tapete', at: [-7.5, -8.0], size: [3.0, 2.4], color: '#5A4A6E' },
      { kind: 'mesa_escritorio', at: [-7.5, -8.6] },
      { kind: 'estante', at: [-10.6, -7.4], rot: Math.PI / 2 },
      { kind: 'pergaminho', at: [-5.3, -10], wall: 'n', color: '#3D3552' },
      { kind: 'planta', at: [-4.6, -9.4] },
      // library: low bookcases against the inner wall (tall ones hid the cat in the map room behind it)
      { kind: 'estante', at: [5.2, -4.55], h: 1.2 },
      { kind: 'estante', at: [7.0, -4.55], h: 1.2 },
      { kind: 'estante', at: [10.55, -2.4], rot: -Math.PI / 2 },
      { kind: 'tapete', at: [7.0, -2.3], size: [2.4, 1.8], color: '#7E3B32' },
      // map room
      { kind: 'mesa_mapa', at: [6.0, -7.6] },
      { kind: 'pergaminho', at: [7.3, -10], wall: 'n', color: '#4F6B52' },
      // reserved room
      { kind: 'pedestal', at: [9.5, -9.35] },
      { kind: 'estatua_guardia', at: [10.4, -6.0] },
      // light
      { kind: 'lanterna', at: [0, -4] },
      { kind: 'lanterna', at: [-7.5, -7.5] },
      { kind: 'lanterna', at: [7.5, -2.5] },
      { kind: 'lanterna', at: [6, -7.5] },
    ],
  },
];

export const INTERIORS_BY_ID: Record<string, InteriorDef> = Object.fromEntries(INTERIORS.map((i) => [i.id, i]));

// ── Geometry: where the doors are ─────────────────────────────────────────────

/** Room point → world point (rooms are not turned). */
export const toWorld = (def: InteriorDef, x: number, z: number): Vec3 => [def.origin[0] + x, 0, def.origin[1] + z];

/** The house's front door outside, the spot in front of it the cat comes out on, and the way it faces. */
export function outsideDoor(def: InteriorDef) {
  const [cx, cz] = def.house.c;
  const fx = Math.sin(def.house.rot);
  const fz = Math.cos(def.house.rot);
  const half = def.house.d / 2;
  return {
    door: [cx + fx * half, 0, cz + fz * half] as Vec3,
    /** 1.4 m out: clear of the door step and the house collider. */
    spot: [cx + fx * (half + 1.4), 0, cz + fz * (half + 1.4)] as Vec3,
    /** Heading of the cat coming out (looking away from the house). */
    heading: def.house.rot,
  };
}

/** Inside: the door on the south wall (+z), and where the cat stands after coming in (facing in, -z). */
export function insideDoor(def: InteriorDef) {
  const zWall = def.size.d / 2;
  return {
    door: toWorld(def, 0, zWall),
    spot: toWorld(def, 0, zWall - 1.3),
  };
}

/** The room's floor area, for the walkable regions (data/regions.ts). */
export function interiorRect(def: InteriorDef): Rect {
  return {
    minX: def.origin[0] - def.size.w / 2,
    maxX: def.origin[0] + def.size.w / 2,
    minZ: def.origin[1] - def.size.d / 2,
    maxZ: def.origin[1] + def.size.d / 2,
  };
}

/** The wall pieces of a partition once its doorways are cut out: [x0, z0, x1, z1] each (room coordinates). */
export function partitionSegments(p: Partition): [number, number, number, number][] {
  const alongX = p.from[1] === p.to[1];
  const a0 = alongX ? Math.min(p.from[0], p.to[0]) : Math.min(p.from[1], p.to[1]);
  const a1 = alongX ? Math.max(p.from[0], p.to[0]) : Math.max(p.from[1], p.to[1]);
  const fixed = alongX ? p.from[1] : p.from[0];
  const cuts = [...(p.gaps ?? [])].sort((u, v) => u.at - v.at);
  const out: [number, number, number, number][] = [];
  let start = a0;
  for (const g of cuts) {
    const g0 = g.at - g.w / 2;
    if (g0 > start) out.push(alongX ? [start, fixed, g0, fixed] : [fixed, start, fixed, g0]);
    start = g.at + g.w / 2;
  }
  if (a1 > start) out.push(alongX ? [start, fixed, a1, fixed] : [fixed, start, fixed, a1]);
  return out;
}

/** Half widths of the things hung on walls: posts keep clear of them. */
const WALL_SPAN: Partial<Record<PropKind, number>> = {
  janela: 0.6, prateleira: 0.9, quadro_receitas: 0.65, quadro_negro: 1.1, quadro_pistas: 0.75, estandarte: 0.45,
  emblema: 0.6, pergaminho: 0.28, relogio_parede: 0.2,
};

/** Where along a wall a hung thing sits, and its half width (null if it does not hang on that wall). */
export function wallSpan(p: Prop, wall: 'n' | 'e' | 'w'): [number, number] | null {
  const span = WALL_SPAN[p.kind];
  if (span === undefined || p.wall !== wall) return null;
  return [wall === 'n' ? p.at[0] : p.at[1], span];
}

/**
 * The timber posts of the room's three standing walls (the south one is drawn low for the camera): one at each
 * corner, and between them about every 2.4 m, skipping any spot behind something hung on the wall or where an
 * inner wall meets it (that one has its own post). `at` runs along the wall (x on the north one, z on the others).
 */
export function wallPosts(def: InteriorDef): { wall: 'n' | 'e' | 'w'; at: number }[] {
  const { w, d } = def.size;
  const out: { wall: 'n' | 'e' | 'w'; at: number }[] = [];
  const ends = (def.partitions ?? []).flatMap((p) => [p.from, p.to]);
  const walls = [
    { wall: 'n' as const, from: -w / 2, to: w / 2, first: 0 },
    // the north corners are the north wall's
    { wall: 'w' as const, from: -d / 2, to: d / 2, first: 1 },
    { wall: 'e' as const, from: -d / 2, to: d / 2, first: 1 },
  ];
  for (const wl of walls) {
    const len = wl.to - wl.from;
    const n = Math.max(1, Math.ceil(len / 2.4));
    for (let i = wl.first; i <= n; i++) {
      const at = wl.from + (len * i) / n;
      const corner = i === 0 || i === n;
      if (!corner) {
        const behind = def.props.some((p) => {
          const s = wallSpan(p, wl.wall);
          return !!s && Math.abs(s[0] - at) < s[1] + 0.2;
        });
        const meets = ends.some(([x, z]) =>
          wl.wall === 'n' ? Math.abs(z + d / 2) < 0.01 && Math.abs(x - at) < 0.6
            : Math.abs(x - (wl.wall === 'w' ? -w / 2 : w / 2)) < 0.01 && Math.abs(z - at) < 0.6);
        if (behind || meets) continue;
      }
      out.push({ wall: wl.wall, at });
    }
  }
  return out;
}

/**
 * The roof's tie beams, across the room (along x): one over each row of hanging lanterns. Only in one-room
 * houses: across a big building with inner walls they cut over every room and the circuit, and read as clutter
 * from above (seen in play); there the lanterns hang from the ceiling by their cords.
 */
export function roofBeams(def: InteriorDef): number[] {
  if (def.partitions?.length) return [];
  const zs: number[] = [];
  for (const p of def.props) {
    if (p.kind === 'lanterna' && !zs.some((z) => Math.abs(z - p.at[1]) < 0.6)) zs.push(p.at[1]);
  }
  return zs;
}

/** The named part of a building at a world point (HUD label), or null. */
export function areaAt(def: InteriorDef, x: number, z: number): string | null {
  const lx = x - def.origin[0];
  const lz = z - def.origin[1];
  for (const a of def.areas ?? []) {
    if (lx >= a.rect[0] && lx <= a.rect[2] && lz >= a.rect[1] && lz <= a.rect[3]) return a.name;
  }
  return null;
}

export function interiorAt(x: number, z: number): InteriorDef | null {
  for (const def of INTERIORS) {
    const r = interiorRect(def);
    if (x >= r.minX - 0.5 && x <= r.maxX + 0.5 && z >= r.minZ - 0.5 && z <= r.maxZ + 0.5) return def;
  }
  return null;
}

/**
 * Where to point the player for something at `pos`: inside a room they are not in, its door outside (the
 * map, the objective card's trail and the faro all lead to the door). Elsewhere, the point itself.
 */
export function reachablePosition(pos: Vec3, from?: { x: number; z: number }): Vec3 {
  const room = interiorAt(pos[0], pos[2]);
  if (!room) return pos;
  if (from && interiorAt(from.x, from.z)?.id === room.id) return pos;
  return outsideDoor(room).spot;
}

// ── People, missions, challenges and things inside ────────────────────────────

const C = INTERIORS_BY_ID.cantina;
const R = INTERIORS_BY_ID.relojoeiro;

export const INTERIOR_ITEMS: Item[] = [
  {
    id: 'engrenagem_dourada', name: 'Engrenagem Dourada', icon: '⚙️', category: 'colecionavel', rarity: 'raro',
    description: 'Estava escondida no relógio do velho Tique. Gravado nela: "O tempo ensina quem presta atenção."',
  },
];

export const INTERIOR_CHALLENGES: Challenge[] = [
  {
    id: 'tigelas_mesa',
    skill: 'multiplicacao',
    title: 'Mesa Posta',
    kind: 'number',
    story: 'São 3 mesas, cada uma com 4 almofadas. Cada almofada precisa de uma tigela. A Mimi já colocou 5 tigelas.',
    question: 'Quantas tigelas ainda faltam?',
    answer: 7,
    observe: 'Primeiro descubra quantas tigelas são no total; depois tire as que já estão na mesa.',
    hint: 'Total: 3 mesas × 4 almofadas. Depois subtraia as 5 que já estão lá.',
    example: 'Parecido: 2 mesas com 3 almofadas = 2 × 3 = 6 tigelas. Se já tem 2, faltam 6 − 2 = 4.',
    successText: '🍚 7 tigelas! 3 × 4 = 12, e 12 − 5 = 7. A cantina está pronta para o almoço.',
    onSuccess: 'STEP:mesa_posta.contar',
  },
  {
    id: 'relogio_angulo',
    skill: 'geometria',
    title: 'O Relógio Parado',
    kind: 'choice',
    story: 'O diário do relojoeiro diz: "Os ponteiros formam um ângulo reto, e o pequeno aponta para a direita. Nessa hora, o relógio se abre."',
    question: 'Para que hora você gira os ponteiros?',
    choices: ['3 horas', '6 horas', '12 horas', '9 horas'],
    answer: 0,
    observe: 'Ângulo reto é 90°, como o canto de um caderno. No relógio, "direita" é o lado do número 3.',
    hint: 'O ponteiro grande fica no 12. Qual número, à direita, faz um canto reto com o 12?',
    example: 'Parecido: às 6 horas os ponteiros ficam em linha reta, 180°, meia volta. Às 12, os dois juntos: 0°.',
    successText: '🕒 3 horas! O ponteiro grande no 12 e o pequeno no 3 fazem um quarto de volta: 90°. Clique!',
    onSuccess: 'STEP:relogio_parado.relogio;FLAG:relogio_aberto;SFX:mechanism',
  },
];

export const INTERIOR_MISSIONS: Mission[] = [
  {
    id: 'mesa_posta',
    chapter: 1,
    title: 'Mesa Posta',
    category: 'educativa',
    giver: 'mimi',
    description: 'A Mimi, ajudante da cantina, precisa pôr as mesas antes do almoço. Quantas tigelas faltam?',
    steps: [
      { id: 'ouvir', description: 'Fale com a Mimi dentro da cantina', target: { npc: 'mimi' } },
      { id: 'contar', description: 'Conte as tigelas que faltam (pilha de tigelas no balcão)', after: ['ouvir'], target: { object: 'pilha_tigelas' } },
      { id: 'avisar', description: 'Conte à Mimi', after: ['contar'], target: { npc: 'mimi' } },
    ],
    rewards: { xp: 30, coins: 12, gems: 1, items: { onigiri: 2 } },
    lesson: 'Para achar o que falta: calcule o total (multiplicação) e tire o que já existe (subtração).',
  },
  {
    id: 'relogio_parado',
    chapter: 1,
    title: 'O Relógio Parado',
    category: 'investigação',
    giver: 'mochi',
    description: 'A casa do velho relojoeiro Tique está fechada há anos. Dizem que o relógio dele guarda um segredo.',
    steps: [
      { id: 'ouvir', description: 'Ouça a história da Vovó Mochi', target: { npc: 'mochi' } },
      { id: 'diario', description: 'Procure pistas na Casa do Relojoeiro', after: ['ouvir'], target: { object: 'diario_relojoeiro' } },
      { id: 'relogio', description: 'Acerte a hora do relógio parado', after: ['diario'], target: { object: 'relogio_grande' } },
      { id: 'compartimento', description: 'Abra o compartimento secreto', after: ['relogio'], target: { object: 'bau_relojoeiro' } },
      { id: 'contar', description: 'Conte à Vovó Mochi o que encontrou', after: ['compartimento'], target: { npc: 'mochi' } },
    ],
    rewards: { xp: 60, coins: 20, gems: 2, badges: ['Detetive do Tempo'] },
    lesson: 'Um ângulo reto é um quarto de volta (90°). Ler com atenção (o diário) e observar (o relógio) resolveu o mistério.',
  },
];

const say = (speaker: string, text: string, onEnter?: string, label = 'Ok') => ({
  start: { id: 'start', speaker, text, onEnter, options: [{ label, nextNodeId: null }] },
});

export const INTERIOR_OBJECTS: WorldObject[] = [
  // ── Cantina ──
  {
    id: 'pilha_tigelas', kind: 'examine', position: toWorld(C, 1.6, -2.35), label: 'Contar as tigelas', name: 'Pilha de tigelas',
    usableWhen: { active: 'mesa_posta', step: 'mesa_posta.ouvir', notStep: 'mesa_posta.contar' },
    actions: 'CHALLENGE:tigelas_mesa', radius: 1.6,
  },
  {
    id: 'bau_cantina', kind: 'chest', position: toWorld(C, -0.9, -3.0), label: 'Abrir o baú atrás do balcão',
    hideWhen: { flag: 'bau_cantina' }, actions: 'FLAG:bau_cantina;COINS:15;GIVE:onigiri;SFX:chest', radius: 1.4,
  },
  {
    id: 'aquario_cantina', kind: 'examine', position: toWorld(C, 3.5, -0.4), label: 'Olhar o aquário', name: 'Aquário',
    dialogue: say('Aquário', 'Um peixinho dourado nada em círculos. Ele olha para você...\n...e você tem certeza de que ele está julgando seus bigodes.'), radius: 1.5,
  },
  {
    id: 'quadro_receitas', kind: 'examine', position: toWorld(C, -3.8, -0.6), label: 'Ler o quadro de receitas', name: 'Quadro de receitas',
    dialogue: say('Quadro de receitas', 'Receitas da Chef Hana, com desenhos de peixe por todo lado.\nUma está riscada: "Bolinho de Peixe Explosivo — NUNCA MAIS."'), radius: 1.5,
  },
  // ── Casa do Relojoeiro ──
  {
    id: 'diario_relojoeiro', kind: 'clue', position: toWorld(R, -2.3, -2.0), label: 'Ler o diário empoeirado', name: 'Diário do relojoeiro',
    usableWhen: { active: 'relogio_parado', step: 'relogio_parado.ouvir' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Diário do relojoeiro',
        text: '"Guardei minha melhor peça onde só quem entende o tempo vai achar.\nOs ponteiros formam um ângulo reto, e o pequeno aponta para a direita. Nessa hora, o relógio se abre."',
        onEnter: 'STEP:relogio_parado.diario',
        options: [{ label: 'Um ângulo reto... e para a direita.', nextNodeId: null }],
      },
    },
    radius: 1.5,
  },
  {
    id: 'relogio_grande', kind: 'examine', position: toWorld(R, 0, -2.25), label: 'Girar os ponteiros do relógio', name: 'Relógio parado',
    usableWhen: { active: 'relogio_parado', step: 'relogio_parado.diario', notStep: 'relogio_parado.relogio' },
    actions: 'CHALLENGE:relogio_angulo', radius: 1.6,
  },
  {
    id: 'bau_relojoeiro', kind: 'chest', position: toWorld(R, 0.9, -2.6), label: 'Abrir o compartimento do relógio',
    when: { flag: 'relogio_aberto' }, hideWhen: { flag: 'bau_relojoeiro' },
    actions: 'FLAG:bau_relojoeiro;GIVE:engrenagem_dourada;STEP:relogio_parado.compartimento;SFX:chest', radius: 1.4,
  },
  {
    id: 'estante_relojoeiro', kind: 'examine', position: toWorld(R, 2.75, -1.2), label: 'Olhar a estante', name: 'Estante',
    dialogue: say('Estante', 'Livros sobre engrenagens, molas e pêndulos. Um deles se chama "Como Consertar Relógios Sem Chorar".\nA página 1 está cheia de marcas de lágrimas.'), radius: 1.5,
  },
];

export const MIMI: NPCDefinition = {
  id: 'mimi',
  name: 'Mimi',
  role: 'Ajudante da cantina',
  // clear of the chest behind the counter (at 1.3 m, E talked to her instead of opening it)
  position: toWorld(C, -2.0, -1.2),
  faceRotation: 0,
  look: { species: 'cat', fur: '#F2C38B', belly: '#FFF3E0', scale: 0.85, mask: '#C97C3D', eyes: 'round' },
  voice: 'meow_high',
  offers: [{ mission: 'mesa_posta' }],
  barks: ['Bem-vindo à cantina! Cuidado, o chão está encerado!', 'A Chef Hana diz que peixe feliz dá bolinho feliz.'],
  routes: [
    { when: { active: 'mesa_posta', step: 'mesa_posta.contar' }, tree: {
      start: {
        id: 'start', speaker: 'Mimi', mood: 'happy',
        text: 'Faltam 7? Então são 12 no total... e eu já tinha posto 5. Faz sentido!\nObrigada, Shinichi! Leva uns onigiris, são os primeiros do dia.',
        options: [{ label: '🍙 Valeu, Mimi!', nextNodeId: null, action: 'STEP:mesa_posta.avisar' }],
      },
    } },
    { when: { active: 'mesa_posta' }, tree: say('Mimi', 'As tigelas estão empilhadas no balcão. Conta quantas faltam pra mim?') },
    { when: { notStarted: 'mesa_posta' }, tree: {
      start: {
        id: 'start', speaker: 'Mimi',
        text: 'Oi! Eu sou a Mimi, ajudo a Chef Hana aqui na cantina.\nO almoço é já já e eu me perdi contando as tigelas... me ajuda?',
        options: [
          { label: '🍚 Ajudo, sim!', nextNodeId: null, action: 'START:mesa_posta;STEP:mesa_posta.ouvir' },
          { label: 'Agora não', nextNodeId: null },
        ],
      },
    } },
    { tree: say('Mimi', 'A cantina fica cheia no almoço. Volta mais tarde pra provar o bolinho!') },
  ],
};

/**
 * Vovó Mochi's lines for the clockmaker mystery (data/npcs2.ts adds them before her small talk). She offers one
 * thing at a time, first match wins: the bridge (ponte), then the garden (horta, Capítulo 3), then this. The offer in
 * npcs2.ts has the same condition, so the mission log never lists it as available while she talks about something else.
 */
export const MOCHI_CLOCK_ROUTES: NPCDefinition['routes'] = [
  { when: { active: 'relogio_parado', step: 'relogio_parado.compartimento' }, tree: {
    start: {
      id: 'start', speaker: 'Vovó Mochi', mood: 'happy',
      text: 'Uma engrenagem dourada! O Tique dizia que era a peça mais bonita que ele já fez.\nEle ia gostar de saber que foi você que achou. Guarde com carinho, querido.',
      options: [{ label: '⚙️ Pode deixar, vovó!', nextNodeId: null, action: 'STEP:relogio_parado.contar' }],
    },
  } },
  { when: { active: 'relogio_parado' }, tree: say('Vovó Mochi', 'A casa do Tique fica no lado oeste da vila, a porta está destrancada.\nProcure pistas... ele escrevia tudo num diário.') },
  { when: { notStarted: 'relogio_parado', done: 'horta' }, tree: {
    start: {
      id: 'start', speaker: 'Vovó Mochi',
      text: 'Sabia que naquela casa do oeste morava o Tique, o relojoeiro?\nQuando ele se mudou para a montanha, o relógio dele parou... e ninguém nunca descobriu o segredo.',
      options: [
        { label: '🔍 Eu descubro!', nextNodeId: null, action: 'START:relogio_parado;STEP:relogio_parado.ouvir' },
        { label: 'Que mistério...', nextNodeId: null },
      ],
    },
  } },
];
