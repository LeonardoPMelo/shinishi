import { describe, expect, it } from 'vitest';
import { solutions } from '../src/systems/orderPuzzle';
import {
  LANTERN_PUZZLE, GUARDIANS, GUARDIAN_LANTERNS, PRECINCT, TERRACE, RESIDENCE, RESIDENCE_FRONT, TOWER, JADE_PAWS, BELL,
  ARCHIVE, STAIRS, GREAT_GATE, PRECINCT_OBJECTS,
} from '../src/data/precinct';
import { EXIT_GATE, EXIT_TRAIL, EXIT_TRIGGER_Z, FAWNS, CLEARING_DEER, CLEARING_CHALLENGES } from '../src/data/clearing';
import { TRAIL_GATE } from '../src/data/wild';
import { SOUTH } from '../src/data/south';
import { EAST, EAST_PATHS } from '../src/data/east';
import { INTERIORS_BY_ID, outsideDoor } from '../src/data/interiors';
import { WALK_RECTS, clampToRegions } from '../src/data/regions';
import { NPCS_BY_ID } from '../src/data/npcs';
import { WORLD_OBJECTS } from '../src/data/world';
import { MISSIONS } from '../src/data/missions';
import { CHALLENGES } from '../src/data/challenges';

/**
 * The Templo de Mikage moved to the Bairro das Glicínias, and the Clareira dos Cervos became the way out to the
 * wild lands (after Etapa 10). These pin the new geography, its puzzles and what no longer lives where.
 */

describe('o Templo de Mikage, ao norte do Bairro das Glicínias', () => {
  it('a rua das glicínias segue reta até o grande portão, e o recinto é área andável', () => {
    const lane = EAST_PATHS[1];
    expect(lane[lane.length - 1][0]).toBeCloseTo(GREAT_GATE.x, 1);
    expect(lane[lane.length - 1][1]).toBeLessThan(EAST.minZ);
    expect(clampToRegions(GREAT_GATE.x, GREAT_GATE.z - 3)).toBeNull();
    expect(clampToRegions(RESIDENCE.x, RESIDENCE_FRONT + 1.4)).toBeNull();
    expect(WALK_RECTS.some((r) => r.minX === PRECINCT.minX && r.maxZ === EAST.minZ)).toBe(true);
  });

  it('a porta da Sede fica no terraço, na frente da residência, e quem sai fica no terraço', () => {
    const sede = INTERIORS_BY_ID.sede;
    const out = outsideDoor(sede);
    expect(out.door[1]).toBe(TERRACE.h);
    expect(out.door[2]).toBeCloseTo(RESIDENCE_FRONT, 5);
    expect(out.spot[1]).toBe(TERRACE.h);
    expect(out.spot[2]).toBeGreaterThan(RESIDENCE_FRONT);
    expect(out.spot[2]).toBeLessThan(TERRACE.z1);
    // the stair reaches the terrace on the same axis
    expect(out.spot[0]).toBeGreaterThan(STAIRS.x0);
    expect(out.spot[0]).toBeLessThan(STAIRS.x1);
  });

  it('os versos das lanternas têm uma resposta só', () => {
    const s = solutions(LANTERN_PUZZLE);
    expect(s).toHaveLength(1);
    expect(s[0]).toEqual(['grou', 'carpa', 'gato', 'tartaruga']);
    expect(LANTERN_PUZZLE.pieces).toEqual([...GUARDIANS]);
    for (const g of GUARDIANS) expect(GUARDIAN_LANTERNS[g]).toBeDefined();
  });

  it('as lanternas, o sino e o arquivo ficam no terraço, fora do caminho até a porta', () => {
    const inTerrace = (x: number, z: number) => x > TERRACE.x0 && x < TERRACE.x1 && z > TERRACE.z0 && z < TERRACE.z1;
    for (const [x, z] of Object.values(GUARDIAN_LANTERNS)) {
      expect(inTerrace(x, z)).toBe(true);
      expect(Math.abs(x - RESIDENCE.x)).toBeGreaterThan(1.6);
    }
    expect(inTerrace(BELL.x, BELL.z)).toBe(true);
    expect(inTerrace(ARCHIVE.x, ARCHIVE.z)).toBe(true);
  });

  it('a pata de jade da torre só se pega lá de cima', () => {
    const j = WORLD_OBJECTS.find((o) => o.id === 'jade_torre')!;
    // standing on the terrace next to the tower, the cat (0.35 m) is at least half the tower away from its middle
    expect((j.radius ?? 0) + 0.35).toBeLessThan(TOWER.w / 2);
    expect(j.position[1]).toBe(TOWER.h);
    expect(JADE_PAWS).toHaveLength(MISSIONS.patas_de_jade.steps.find((s) => s.id === 'achar')!.counter!.goal);
  });

  it('os moradores novos ficam dentro do recinto, e o Toshi guarda a porta da residência', () => {
    for (const id of ['ren', 'bunko', 'tama', 'toshi']) {
      const [x, , z] = NPCS_BY_ID[id].position;
      expect(x > PRECINCT.minX && x < PRECINCT.maxX && z > PRECINCT.minZ && z < PRECINCT.maxZ, id).toBe(true);
    }
    expect(NPCS_BY_ID.toshi.position[1]).toBe(TERRACE.h);
    expect(Math.abs(NPCS_BY_ID.toshi.position[2] - RESIDENCE_FRONT)).toBeLessThan(1.5);
  });

  it('todo objeto do recinto fica dentro dele', () => {
    for (const o of PRECINCT_OBJECTS) {
      const [x, , z] = o.position;
      // the two guardian statues and the direction sign stand outside the gate, in the lane
      const outsideGate = z > PRECINCT.maxZ && z < PRECINCT.maxZ + 2.5;
      expect((x > PRECINCT.minX && x < PRECINCT.maxX && z > PRECINCT.minZ && z < PRECINCT.maxZ) || outsideGate, o.id).toBe(true);
    }
  });
});

describe('a Clareira dos Cervos: a saída para as Terras Selvagens', () => {
  it('o portão da trilha fica na cerca sul da clareira, e quem volta das terras selvagens chega dentro da vila', () => {
    expect(TRAIL_GATE.at[0]).toBe(EXIT_GATE.x);
    expect(TRAIL_GATE.at[2]).toBe(EXIT_GATE.z);
    const [x, , z] = TRAIL_GATE.out;
    expect(z).toBeLessThan(SOUTH.maxZ);
    expect(clampToRegions(x, z)).toBeNull();
    // and it does not land on the walk-on line
    expect(z).toBeLessThan(EXIT_TRIGGER_Z - 5);
  });

  it('a trilha é andável do portão até a linha que leva às terras selvagens', () => {
    for (let z = EXIT_GATE.z; z <= EXIT_TRIGGER_Z + 0.5; z += 0.5) expect(clampToRegions(EXIT_GATE.x, z), `z ${z}`).toBeNull();
    expect(EXIT_TRAIL.z1).toBeGreaterThan(EXIT_TRIGGER_Z);
  });

  it('a pergunta dos filhotes conta os cervos que estão na cena', () => {
    expect(FAWNS).toBe(3);
    expect(CLEARING_DEER.length).toBeGreaterThan(FAWNS);
    expect(CHALLENGES.cervos_filhotes.answer).toBe(FAWNS);
    expect(CLEARING_CHALLENGES.every((c) => CHALLENGES[c.id])).toBe(true);
  });

  it('nada mais depende dos lugares antigos', () => {
    const near = (p: number[], x: number, z: number, r: number) => Math.hypot(p[0] - x, p[2] - z) < r;
    // the old trail gate in the Bambuzal's west fence
    expect(WORLD_OBJECTS.filter((o) => near(o.position, -40, 12, 3)).map((o) => o.id)).toEqual([]);
    // the old Sede gate at the clearing: only the way out (the trail gate's objects) stands there now
    expect(WORLD_OBJECTS.filter((o) => near(o.position, -9, 62.6, 1.5)).map((o) => o.id).sort()).toEqual(['portao_trilha', 'portao_trilha_fechado']);
    expect(Object.values(NPCS_BY_ID).filter((n) => near(n.position, -6.4, 61.0, 0.6)).map((n) => n.id)).toEqual([]);
  });
});

describe('a porta da residência do Mikage', () => {
  it('quem está no terraço, na frente da porta, consegue apertar "Entrar" (a porta fica na altura do terraço)', async () => {
    const THREE = await import('three');
    const { pickInteractable } = await import('../src/game/systems/interaction');
    const sede = INTERIORS_BY_ID.sede;
    const out = outsideDoor(sede);
    const door = { id: 'porta_sede', position: new THREE.Vector3(...out.door), radius: 1.9, label: () => 'Entrar', onInteract: () => {} };
    // the cat's body centre stands about 0.7 m over the ground it is on
    const cat = { x: out.spot[0], y: out.spot[1] + 0.7, z: out.spot[2] };
    expect(pickInteractable([door], cat, 'playing')?.item.id).toBe('porta_sede');
  });

  it('o código da porta usa a altura da porta (não o chão da vila)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(__dirname, '../src/game/world/Interiors.tsx'), 'utf8');
    expect(src).toContain('new THREE.Vector3(o.door[0], o.door[1], o.door[2])');
  });
});
