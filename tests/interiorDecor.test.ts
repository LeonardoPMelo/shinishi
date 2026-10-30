import { describe, expect, it } from 'vitest';
import { INTERIORS, INTERIORS_BY_ID, insideDoor, interiorAt, partitionSegments, roofBeams, wallPosts, wallSpan, type Prop } from '../src/data/interiors';
import { WORLD_OBJECTS, OBJECTS_BY_ID } from '../src/data/world';
import { NPC_DEFINITIONS } from '../src/data/npcs';
import { LEVER_SPOTS, CIRCUIT } from '../src/data/academy';
import { YARD_TARGETS, BOOK_SHELF, SECRET_CASE } from '../src/data/mikage';

/**
 * Cosy interiors (after Etapa 10): the new furniture and decoration must never stand in the way of a mission,
 * a villager, a doorway or a puzzle, and the timber frame must never cover something hung on a wall.
 */

/** Floor footprint (half sizes) of the new furniture that has a collider. */
function half(p: Prop): [number, number] | null {
  const turn = (hx: number, hz: number): [number, number] => (Math.abs(Math.sin(p.rot ?? 0)) > 0.7 ? [hz, hx] : [hx, hz]);
  switch (p.kind) {
    case 'planta': return [0.25, 0.25];
    case 'arbusto': { const s = (p.size?.[0] ?? 0.9) * 0.45; return [s, s]; }
    case 'banco': return turn(0.7, 0.21);
    case 'caixas': return turn(0.5, 0.3);
    case 'luminaria': return [0.21, 0.21];
    default: return null;
  }
}

/** How far a point is from the edge of a footprint (0 inside). */
const gapTo = (p: Prop, h: [number, number], x: number, z: number) =>
  Math.hypot(Math.max(Math.abs(x - p.at[0]) - h[0], 0), Math.max(Math.abs(z - p.at[1]) - h[1], 0));

describe('a decoração nova não atrapalha', () => {
  for (const def of INTERIORS) {
    const local = (pos: number[]) => [pos[0] - def.origin[0], pos[2] - def.origin[1]];
    const objects = WORLD_OBJECTS.filter((o) => interiorAt(o.position[0], o.position[2])?.id === def.id);
    const people = NPC_DEFINITIONS.filter((n) => interiorAt(n.position[0], n.position[2])?.id === def.id);
    const solids = def.props.filter((p) => half(p));

    it(`${def.name}: móveis novos dentro da sala, longe da porta, dos objetos e dos moradores`, () => {
      const { w, d } = def.size;
      const [dx, dz] = local(insideDoor(def).spot);
      for (const p of solids) {
        const h = half(p)!;
        const tag = `${p.kind} em ${p.at}`;
        expect(Math.abs(p.at[0]) + h[0], tag).toBeLessThan(w / 2);
        expect(Math.abs(p.at[1]) + h[1], tag).toBeLessThan(d / 2);
        expect(gapTo(p, h, dx, dz), `${tag} × porta`).toBeGreaterThan(1.0);
        for (const o of objects) {
          // the supply crates are what the council counts: that one stands by its own object
          if (p.kind === 'caixas' && o.id.startsWith('caixas_')) continue;
          const [ox, oz] = local(o.position);
          expect(gapTo(p, h, ox, oz), `${tag} × ${o.id}`).toBeGreaterThan(0.7);
        }
        for (const n of people) {
          const [nx, nz] = local(n.position);
          expect(gapTo(p, h, nx, nz), `${tag} × ${n.id}`).toBeGreaterThan(0.8);
        }
      }
    });

    it(`${def.name}: nenhum móvel novo numa passagem entre salas`, () => {
      for (const part of def.partitions ?? []) {
        const alongX = part.from[1] === part.to[1];
        for (const g of part.gaps ?? []) {
          const [gx, gz] = alongX ? [g.at, part.from[1]] : [part.from[0], g.at];
          for (const p of solids) expect(gapTo(p, half(p)!, gx, gz), `${p.kind} em ${p.at} × passagem`).toBeGreaterThan(0.8);
        }
      }
      // and none inside an inner wall
      for (const [x0, z0, x1, z1] of (def.partitions ?? []).flatMap(partitionSegments)) {
        for (const p of solids) {
          const h = half(p)!;
          const apart = p.at[0] + h[0] < Math.min(x0, x1) - 0.1 || p.at[0] - h[0] > Math.max(x0, x1) + 0.1
            || p.at[1] + h[1] < Math.min(z0, z1) - 0.1 || p.at[1] - h[1] > Math.max(z0, z1) + 0.1;
          expect(apart, `${p.kind} em ${p.at}`).toBe(true);
        }
      }
    });

    it(`${def.name}: as colunas nunca cobrem janela, quadro ou pergaminho, e o que se pendura não se sobrepõe`, () => {
      for (const post of wallPosts(def)) {
        for (const p of def.props) {
          const s = wallSpan(p, post.wall);
          if (s) expect(Math.abs(s[0] - post.at), `coluna ${post.wall} ${post.at} × ${p.kind}`).toBeGreaterThan(s[1]);
        }
      }
      for (const wall of ['n', 'e', 'w'] as const) {
        const hung = def.props.map((p) => wallSpan(p, wall)).filter((s): s is [number, number] => !!s);
        hung.forEach((a, i) => hung.slice(i + 1).forEach((b) => expect(Math.abs(a[0] - b[0]), `${wall}: ${a} × ${b}`).toBeGreaterThan(a[1] + b[1])));
      }
    });
  }

  it('nada novo nos enigmas: alavancas, circuito, alvos, estante dos livros e porta secreta', () => {
    const academy = INTERIORS_BY_ID.academia.props.filter((p) => half(p));
    const spots: [number, number][] = [
      ...Object.values(LEVER_SPOTS),
      CIRCUIT.start.at,
      ...CIRCUIT.checkpoints.flatMap((c) => c.options.map((o) => o.at)),
    ];
    for (const p of academy) for (const [x, z] of spots) expect(gapTo(p, half(p)!, x, z), `${p.kind} em ${p.at}`).toBeGreaterThan(0.9);
    const sede = INTERIORS_BY_ID.sede.props.filter((p) => half(p));
    const sedeSpots: [number, number][] = [...YARD_TARGETS.map((t) => t.at), BOOK_SHELF.at, SECRET_CASE.at, [SECRET_CASE.openX, SECRET_CASE.at[1]]];
    for (const p of sede) for (const [x, z] of sedeSpots) expect(gapTo(p, half(p)!, x, z), `${p.kind} em ${p.at}`).toBeGreaterThan(1.2);
  });

  it('o que as missões citam agora aparece: as caixas de suprimentos e a almofada grande da Sede', () => {
    const S = INTERIORS_BY_ID.sede;
    const at = (id: string) => [OBJECTS_BY_ID[id].position[0] - S.origin[0], OBJECTS_BY_ID[id].position[2] - S.origin[1]];
    const near = (kind: string, [x, z]: number[], r: number) => S.props.some((p) => p.kind === kind && Math.hypot(p.at[0] - x, p.at[1] - z) < r);
    expect(near('caixas', at('caixas_rio'), 0.8)).toBe(true);
    expect(near('almofada', at('pagina_reunioes'), 0.6)).toBe(true);
  });

  it('as vigas do telhado só nas casas de um cômodo, uma por fileira de lanternas', () => {
    expect(roofBeams(INTERIORS_BY_ID.cantina)).toEqual([0.5]);
    expect(roofBeams(INTERIORS_BY_ID.relojoeiro)).toEqual([0.2]);
    expect(roofBeams(INTERIORS_BY_ID.academia)).toEqual([]);
    expect(roofBeams(INTERIORS_BY_ID.sede)).toEqual([]);
  });

  it('a Mesa Posta continua com 3 mesas e 12 almofadas na cantina', () => {
    const c = INTERIORS_BY_ID.cantina.props;
    expect(c.filter((p) => p.kind === 'mesa_baixa')).toHaveLength(3);
    expect(c.filter((p) => p.kind === 'almofada')).toHaveLength(12);
  });
});
