import { describe, expect, it } from 'vitest';
import { INTERIORS, insideDoor, outsideDoor, interiorRect, interiorAt, reachablePosition, type InteriorDef } from '../src/data/interiors';
import { WALK_RECTS, clampToRegions } from '../src/data/regions';
import { CHALLENGES } from '../src/data/challenges';
import { MISSIONS } from '../src/data/missions';
import { OBJECTS_BY_ID } from '../src/data/world';
import { NPCS_BY_ID, NPC_DEFINITIONS, availableOffer, resolveDialogue } from '../src/data/npcs';
import { emptyProgress } from '../src/systems/progression';
import type { Progress } from '../src/types';

/** Etapa 4 da expansão: going in and out of houses must never leave the cat stuck or inside a wall. */

/** How deep (m) a point is inside the house's footprint; < 0 is outside. */
function depthInHouse(def: InteriorDef, x: number, z: number) {
  const { c, rot, w, d } = def.house;
  const dx = x - c[0];
  const dz = z - c[1];
  const lx = dx * Math.cos(rot) - dz * Math.sin(rot);
  const lz = dx * Math.sin(rot) + dz * Math.cos(rot);
  return Math.min(w / 2 - Math.abs(lx), d / 2 - Math.abs(lz));
}

/** Floor footprint (half sizes, room coordinates) of the furniture that has a collider. */
const SOLID: Partial<Record<string, [number, number]>> = {
  balcao: [1.6, 0.38], fogao: [0.65, 0.4], aquario: [0.55, 0.25], mesa_baixa: [0.6, 0.42], barril: [0.34, 0.34],
  bancada: [0.85, 0.38], estante: [0.8, 0.21], movel_coberto: [0.65, 0.43],
};

describe('portas das casas', () => {
  for (const def of INTERIORS) {
    it(`${def.name}: ao sair, o gato fica fora da casa, de frente para a rua, em área andável`, () => {
      const out = outsideDoor(def);
      // the door is on the house's front wall, the spot 1.4 m out
      expect(Math.abs(depthInHouse(def, out.door[0], out.door[2]))).toBeLessThan(0.01);
      expect(depthInHouse(def, out.spot[0], out.spot[2])).toBeLessThan(-1.2);
      expect(clampToRegions(out.spot[0], out.spot[2])).toBeNull();
    });

    it(`${def.name}: ao entrar, o gato fica dentro da sala, longe das paredes e dos móveis`, () => {
      const r = interiorRect(def);
      const [x, , z] = insideDoor(def).spot;
      const capsule = 0.4;
      expect(x - r.minX).toBeGreaterThan(capsule + 0.3);
      expect(r.maxX - x).toBeGreaterThan(capsule + 0.3);
      expect(z - r.minZ).toBeGreaterThan(capsule + 0.3);
      expect(r.maxZ - z).toBeGreaterThan(capsule + 0.3);
      expect(clampToRegions(x, z)).toBeNull();
      const lx = x - def.origin[0];
      const lz = z - def.origin[1];
      for (const p of def.props) {
        const half = SOLID[p.kind];
        if (!half) continue;
        const clear = Math.max(Math.abs(lx - p.at[0]) - half[0], Math.abs(lz - p.at[1]) - half[1]);
        expect(clear, `${p.kind} em ${p.at}`).toBeGreaterThan(capsule);
      }
    });

    it(`${def.name}: nada pendurado na parede sul (ela é desenhada baixa para a câmera ver o gato)`, () => {
      for (const p of def.props) expect(p.wall, `${p.kind} em ${p.at}`).not.toBe('s');
    });

    it(`${def.name}: a sala fica longe do mapa e de qualquer outra sala`, () => {
      const r = interiorRect(def);
      expect(r.minX).toBeGreaterThan(150); // beyond the village, its districts and the fog
      for (const other of INTERIORS) {
        if (other === def) continue;
        const o = interiorRect(other);
        const apart = r.maxX + 5 < o.minX || o.maxX + 5 < r.minX || r.maxZ + 5 < o.minZ || o.maxZ + 5 < r.minZ;
        expect(apart, `${def.id} × ${other.id}`).toBe(true);
      }
      expect(WALK_RECTS).toContainEqual(r);
    });
  }
});

describe('objetos, pessoas e alvos dentro das casas', () => {
  it('cada objeto interativo das casas fica dentro da sala certa', () => {
    for (const id of ['pilha_tigelas', 'bau_cantina', 'aquario_cantina', 'quadro_receitas']) expect(interiorAt(OBJECTS_BY_ID[id].position[0], OBJECTS_BY_ID[id].position[2])?.id).toBe('cantina');
    for (const id of ['diario_relojoeiro', 'relogio_grande', 'bau_relojoeiro', 'estante_relojoeiro']) expect(interiorAt(OBJECTS_BY_ID[id].position[0], OBJECTS_BY_ID[id].position[2])?.id).toBe('relojoeiro');
    expect(interiorAt(NPCS_BY_ID.mimi.position[0], NPCS_BY_ID.mimi.position[2])?.id).toBe('cantina');
  });

  it('de fora, um alvo dentro de uma casa aponta para a porta; de dentro, para o próprio alvo', () => {
    const target = OBJECTS_BY_ID.relogio_grande.position;
    const door = outsideDoor(INTERIORS.find((i) => i.id === 'relojoeiro')!).spot;
    expect(reachablePosition(target, { x: 0, z: 0 })).toEqual(door);
    expect(reachablePosition(target)).toEqual(door);
    expect(reachablePosition(target, { x: target[0] + 1, z: target[2] })).toEqual(target);
    // something outdoors is left alone
    expect(reachablePosition([3, 0, 4], { x: 0, z: 0 })).toEqual([3, 0, 4]);
  });
});

describe('missões e desafios dos interiores', () => {
  it('Mesa Posta: 3 mesas × 4 almofadas = 12 tigelas; já há 5; faltam 7', () => {
    expect(CHALLENGES.tigelas_mesa.answer).toBe(3 * 4 - 5);
  });

  it('O Relógio Parado: ângulo reto com o ponteiro pequeno à direita = 3 horas', () => {
    const c = CHALLENGES.relogio_angulo;
    expect(c.choices![c.answer]).toBe('3 horas');
    // at 3:00 the hands are a quarter turn apart
    expect((3 / 12) * 360).toBe(90);
  });

  it('as missões têm etapas em ordem e recompensas', () => {
    expect(MISSIONS.mesa_posta.steps.map((s) => s.id)).toEqual(['ouvir', 'contar', 'avisar']);
    expect(MISSIONS.relogio_parado.steps.map((s) => s.id)).toEqual(['ouvir', 'diario', 'relogio', 'compartimento', 'contar']);
    expect(MISSIONS.relogio_parado.rewards.badges).toContain('Detetive do Tempo');
  });
});

describe('quem oferece as missões', () => {
  /** A save with these missions done. */
  const doneWith = (...ids: string[]): Progress => {
    const p = emptyProgress();
    for (const id of ids) p.missions[id] = { status: 'done', steps: MISSIONS[id].steps.map((s) => s.id) };
    return p;
  };
  /** Every mission the NPC's dialogue right now can start. */
  const startsInDialogue = (npcId: string, p: Progress) => {
    const d = resolveDialogue(NPCS_BY_ID[npcId], p);
    if (!d) return [];
    return Object.values(d.tree).flatMap((node) => [node.onEnter, ...node.options.map((o) => o.action)])
      .flatMap((a) => (a ?? '').split(';'))
      .filter((a) => a.startsWith('START:'))
      .map((a) => a.slice(6));
  };

  it('o registro de missões só diz "disponível" o que o NPC oferece de fato ao conversar', () => {
    const saves = [doneWith(), doneWith('peixes'), doneWith('peixes', 'ponte'), doneWith('peixes', 'ponte', 'horta')];
    for (const p of saves) {
      for (const npc of NPC_DEFINITIONS) {
        const offer = availableOffer(npc, p);
        if (offer && MISSIONS[offer].giver === npc.id) expect(startsInDialogue(npc.id, p), `${npc.id} oferece ${offer}`).toContain(offer);
      }
    }
  });

  it('a Vovó Mochi oferece uma coisa de cada vez: a ponte, a horta e só então o relógio', () => {
    expect(availableOffer(NPCS_BY_ID.mochi, doneWith('peixes'))).toBe('ponte');
    expect(availableOffer(NPCS_BY_ID.mochi, doneWith('peixes', 'ponte'))).toBe('horta');
    expect(availableOffer(NPCS_BY_ID.mochi, doneWith('peixes', 'ponte', 'horta'))).toBe('relogio_parado');
    expect(startsInDialogue('mochi', doneWith('peixes', 'ponte', 'horta'))).toContain('relogio_parado');
  });
});
