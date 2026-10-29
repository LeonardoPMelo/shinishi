import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onGameEvent } from '../src/systems/events';
import { solutions, press, brokenRule } from '../src/systems/orderPuzzle';
import { circuitTick, startRun, floorTick, quietFloor, medalFor, SQUEAK_EVERY } from '../src/systems/academy';
import { CIRCUIT, LEVER_ROUNDS, LEVER_SOLVED, CIRCUIT_DONE, NIGHTINGALE, LEVER_SPOTS } from '../src/data/academy';
import { BOOK_PUZZLE, BOOK_SOLVED, SECRET_CASE, SEDE_NIGHTINGALE, YARD_TARGETS } from '../src/data/mikage';
import { INTERIORS_BY_ID, partitionSegments, areaAt, insideDoor, type InteriorDef } from '../src/data/interiors';
import { CHALLENGES } from '../src/data/challenges';
import { MISSIONS } from '../src/data/missions';
import { NPCS_BY_ID, resolveDialogue, availableOffer } from '../src/data/npcs';
import { OBJECTS_BY_ID } from '../src/data/world';
import { ITEMS } from '../src/data/items';
import { useGameStore } from '../src/store/gameStore';
import { checkCondition } from '../src/systems/progression';
import type { DialogueTree } from '../src/types';
import { wallHides } from '../src/game/world/cutaway';
import { clampToRegions } from '../src/data/regions';
import { MIRANTE, MIRANTE_STAIRS } from '../src/data/world2';

/** Etapa 5 da expansão: the Ninja Academy and Mikage's residence. */

const A = INTERIORS_BY_ID.academia;
const S = INTERIORS_BY_ID.sede;

describe('quebra-cabeças de ordem: sempre exatamente uma resposta', () => {
  it('cada rodada das alavancas e os livros da biblioteca têm uma única ordem possível', () => {
    for (const p of [...LEVER_ROUNDS, BOOK_PUZZLE]) expect(solutions(p), p.id).toHaveLength(1);
    expect(solutions(LEVER_ROUNDS[0])[0]).toEqual(['peixe', 'lua', 'sino']);
    expect(solutions(LEVER_ROUNDS[1])[0]).toEqual(['peixe', 'folha', 'sino', 'lua']);
    expect(solutions(BOOK_PUZZLE)[0]).toEqual(['azul', 'vermelho', 'amarelo', 'roxo', 'verde']);
  });

  it('a ordem certa resolve; a errada volta tudo e aponta a pista que não bateu', () => {
    const p = LEVER_ROUNDS[0];
    let pulled: string[] = [];
    for (const x of ['peixe', 'lua']) pulled = press(p, pulled, x).pulled;
    expect(press(p, pulled, 'sino').result).toBe('solved');

    let wrong: string[] = [];
    for (const x of ['lua', 'peixe']) wrong = press(p, wrong, x).pulled;
    const r = press(p, wrong, 'sino');
    expect(r.result).toBe('wrong');
    expect(r.pulled).toEqual([]);
    expect(brokenRule(p, r.attempt)?.text).toBe('O peixe vem antes da lua.');
    // pulling the same piece twice changes nothing
    expect(press(p, ['peixe'], 'peixe')).toMatchObject({ result: 'repeat', pulled: ['peixe'] });
  });

  it('o texto das pistas no quadro e no catálogo é o mesmo das regras que o jogo confere', () => {
    const board1 = OBJECTS_BY_ID.quadro_pistas_1.dialogue!.start.text;
    for (const r of LEVER_ROUNDS[0].rules) expect(board1).toContain(r.text);
    const board2 = OBJECTS_BY_ID.quadro_pistas_2.dialogue!.start.text;
    for (const r of LEVER_ROUNDS[1].rules.filter((r) => !r.text.startsWith('A folha'))) expect(board2).toContain(r.text);
    expect(board2).toContain('A folha não é a primeira nem a última.');
    const poem = OBJECTS_BY_ID.catalogo_poema.dialogue!.start.text;
    for (const r of BOOK_PUZZLE.rules) expect(poem).toContain(r.text);
  });
});

describe('Circuito das Patas', () => {
  /** The props a checkpoint stands on. */
  const platforms = A.props.filter((p) => p.kind === 'plataforma').map((p) => ({ at: p.at, size: p.size!, h: p.h! }));
  const under = (at: [number, number]) => platforms.find((p) => Math.abs(at[0] - p.at[0]) <= p.size[0] / 2 && Math.abs(at[1] - p.at[1]) <= p.size[1] / 2);

  it('cada ponto de controle fica em cima de uma plataforma, e a altura pedida é a do topo', () => {
    for (const cp of CIRCUIT.checkpoints.slice(0, -1)) {
      for (const o of cp.options) {
        const p = under(o.at);
        expect(p, cp.name).toBeDefined();
        expect(p!.h - o.minY).toBeGreaterThan(0);
        expect(p!.h - o.minY).toBeLessThan(0.3);
      }
    }
  });

  it('o caminho principal se faz com o pulo simples; a torre alta só com o salto duplo', () => {
    // single jump: apex ~1.52 m, plus the ~0.38 m the capsule rides up an edge (Etapa 3, measured)
    const SINGLE = 1.52 + 0.38;
    const main = [0, 0.6, 1.2, 1.2, 1.5, 1.8];
    for (let i = 1; i < main.length; i++) expect(main[i] - main[i - 1]).toBeLessThan(SINGLE - 0.3);
    const tower = platforms.find((p) => p.h > 2.5)!;
    const from = platforms.find((p) => p.at[0] === 7.0 && p.at[1] === 0.0)!;
    expect(tower.h - from.h).toBeGreaterThan(SINGLE - 0.25);
  });

  it('os degraus até a plataforma alta cabem num pulo andando (~2 m de voo): vão curto, pouso largo', () => {
    // measured in play: a 0.8 m step was jumped clean over, and the cat fell between the platforms
    const steps = [7.0, 5.2, 2.9].map((x) => platforms.find((p) => p.at[0] === x && p.at[1] < -5)!);
    for (let i = 1; i < steps.length; i++) {
      const from = steps[i - 1];
      const to = steps[i];
      const gap = from.at[0] - from.size[0] / 2 - (to.at[0] + to.size[0] / 2);
      expect(gap).toBeGreaterThan(0.2);
      expect(gap).toBeLessThan(0.8);
      expect(gap + to.size[0]).toBeGreaterThan(1.75);
    }
  });

  it('largada → pontos em ordem → chegada; o tempo dá a medalha; sair da área zera', () => {
    let run = startRun(10);
    const path: [number, number, number][] = [[7.0, 0.6, 3.0], [7.0, 1.2, 0.0], [7.0, 1.2, -5.1], [2.9, 1.8, -5.2], [4.2, 0, 5.0]];
    const events = path.map(([x, y, z], i) => {
      const r = circuitTick(CIRCUIT, run, x, y, z, 10 + (i + 1) * 4);
      run = r.run;
      return r.event;
    });
    expect(events.slice(0, 4).map((e) => e?.kind)).toEqual(['checkpoint', 'checkpoint', 'checkpoint', 'checkpoint']);
    expect(events[4]).toEqual({ kind: 'finish', seconds: 20, medal: 'prata' });
    // reaching a later point first counts for nothing
    const skip = circuitTick(CIRCUIT, startRun(0), 2.9, 1.8, -5.2, 1);
    expect(skip.event).toBeNull();
    // standing on the floor under a platform is not on it
    expect(circuitTick(CIRCUIT, startRun(0), 7.0, 0, 3.0, 1).event).toBeNull();
    // the tower counts for the third point
    let alt = startRun(0);
    alt = circuitTick(CIRCUIT, alt, 7.0, 0.6, 3.0, 1).run;
    alt = circuitTick(CIRCUIT, alt, 7.0, 1.2, 0.0, 2).run;
    expect(circuitTick(CIRCUIT, alt, 4.6, 2.9, -2.0, 3).event).toEqual({ kind: 'checkpoint', index: 2 });
    expect(circuitTick(CIRCUIT, startRun(0), -2, 0, 0, 1).event).toEqual({ kind: 'abort' });
    expect([medalFor(CIRCUIT, 13), medalFor(CIRCUIT, 22), medalFor(CIRCUIT, 22.1)]).toEqual(['ouro', 'prata', 'bronze']);
    // Haru tells the same times the game uses
    expect(JSON.stringify(NPCS_BY_ID.haru.routes)).toContain(`Até ${CIRCUIT.medals.ouro} segundos: ouro. Até ${CIRCUIT.medals.prata}: prata.`);
  });
});

describe('chão-rouxinol', () => {
  const cross = (crouched: boolean, step = 0.05, length = 5) => {
    let s = quietFloor();
    let caught = false;
    for (let d = 0; d < length; d += step) {
      const r = floorTick(s, true, true, crouched, step);
      s = r.state;
      caught ||= r.caught;
    }
    return { caught, squeaks: s.squeaks };
  };

  it('agachado, o corredor inteiro fica em silêncio; em pé, o professor ouve antes do fim', () => {
    const len = NIGHTINGALE.rect[3] - NIGHTINGALE.rect[1];
    expect(cross(true, 0.05, len)).toEqual({ caught: false, squeaks: 0 });
    expect(cross(false, 0.05, len).caught).toBe(true);
    // two chirps are the limit, and the corridor is longer than that
    expect(len).toBeGreaterThan(SQUEAK_EVERY * 2);
  });

  it('pular por cima não engana: cair em pé nas tábuas canta', () => {
    const air = floorTick(quietFloor(), true, false, false, 0.2).state;
    expect(floorTick(air, true, true, false, 0).squeak).toBe(true);
    expect(floorTick(air, true, true, true, 0).squeak).toBe(false);
  });

  it('o corredor da Academia só se atravessa pelas tábuas; o pergaminho fica depois delas', () => {
    const walls = (A.partitions ?? []).filter((p) => p.from[0] === p.to[0] && Math.abs(p.from[0]) === 1.2);
    expect(walls).toHaveLength(2);
    for (const w of walls) expect(w.gaps ?? []).toEqual([]);
    const scroll = OBJECTS_BY_ID.pergaminho_rouxinol.position[2] - A.origin[1];
    expect(scroll).toBeLessThan(NIGHTINGALE.rect[1]);
    // and the boards fill the corridor's width
    expect([NIGHTINGALE.rect[0], NIGHTINGALE.rect[2]]).toEqual([-1.2, 1.2]);
  });
});

describe('as construções: paredes, portas e áreas', () => {
  /** True when (x, z) lies inside a wall piece (with the capsule's radius). */
  const inWall = (def: InteriorDef, x: number, z: number, r = 0.38) =>
    (def.partitions ?? []).flatMap(partitionSegments).some(([x0, z0, x1, z1]) =>
      x >= Math.min(x0, x1) - 0.1 - r && x <= Math.max(x0, x1) + 0.1 + r && z >= Math.min(z0, z1) - 0.1 - r && z <= Math.max(z0, z1) + 0.1 + r);

  it('cada porta interna tem largura para o gato passar', () => {
    for (const def of [A, S]) for (const p of def.partitions ?? []) for (const g of p.gaps ?? []) expect(g.w, `${def.id}`).toBeGreaterThan(2 * 0.38 + 0.3);
  });

  it('a entrada, os moradores e os objetos não ficam dentro de paredes', () => {
    for (const def of [A, S]) {
      const [x, , z] = insideDoor(def).spot;
      expect(inWall(def, x - def.origin[0], z - def.origin[1]), `${def.id} entrada`).toBe(false);
    }
    for (const id of ['sumi', 'haru']) {
      const p = NPCS_BY_ID[id].position;
      expect(inWall(A, p[0] - A.origin[0], p[2] - A.origin[1]), id).toBe(false);
    }
    for (const id of ['mikage', 'yuki', 'fumi']) {
      const p = NPCS_BY_ID[id].position;
      expect(inWall(S, p[0] - S.origin[0], p[2] - S.origin[1]), id).toBe(false);
    }
    for (const [piece, [x, z]] of Object.entries(LEVER_SPOTS)) expect(inWall(A, x, z + 0.8), piece).toBe(false);
  });

  it('perto de cada morador, o mais perto é ele (nenhum objeto rouba a conversa)', () => {
    // seen in play: next to Yuki, "E" opened the map on the table instead of talking to her
    const npcIds = ['sumi', 'haru', 'mikage', 'yuki', 'fumi', 'mimi'];
    const objs = Object.values(OBJECTS_BY_ID).filter((o) => Math.abs(o.position[0]) > 150);
    for (const id of npcIds) {
      const n = NPCS_BY_ID[id].position;
      for (const o of objs) expect(Math.hypot(o.position[0] - n[0], o.position[2] - n[2]), `${id} × ${o.id}`).toBeGreaterThan(1.8);
    }
  });

  it('cada área tem nome, e os lugares importantes caem na área certa', () => {
    const where = (def: InteriorDef, id: string) => {
      const p = NPCS_BY_ID[id]?.position ?? OBJECTS_BY_ID[id].position;
      return areaAt(def, p[0], p[2]);
    };
    expect(S.areas).toHaveLength(9);
    expect(where(S, 'mikage')).toBe('Salão de Audiências');
    expect(where(S, 'yuki')).toBe('Sala de Mapas');
    expect(where(S, 'fumi')).toBe('Biblioteca');
    expect(where(S, 'pedestal_fundacao')).toBe('Área Reservada');
    expect(where(S, 'mesa_mikage')).toBe('Escritório de Mikage');
    expect(where(S, 'pagina_reunioes')).toBe('Sala de Reuniões');
    expect(where(S, 'rocha_pacto')).toBe('Jardim Ornamental');
    expect(where(S, 'placa_alvos')).toBe('Pátio de Treinamento');
    expect(where(A, 'quadro_numeros_1')).toBe('Sala dos Números');
    expect(where(A, 'quadro_pistas_1')).toBe('Sala da Lógica');
    expect(where(A, 'sumi')).toBe('Sala dos Números');
    expect(where(A, 'haru')).toBe('Circuito das Patas');
    for (const t of YARD_TARGETS) expect(areaAt(S, S.origin[0] + t.at[0], S.origin[1] + t.at[1])).toBe('Pátio de Treinamento');
  });

  it('a Área Reservada só se alcança pela porta secreta, que a estante tapa até o enigma', () => {
    const walls = (S.partitions ?? []).filter((p) =>
      (p.from[1] === -5 && p.to[1] === -5 && Math.max(p.from[0], p.to[0]) === 11) || (p.from[0] === 8 && p.to[0] === 8));
    expect(walls).toHaveLength(2);
    const gaps = walls.flatMap((w) => w.gaps ?? []);
    expect(gaps).toEqual([{ at: 9.5, w: 1.4 }]);
    // closed, the bookcase covers the doorway; open, it leaves room for the cat
    expect(Math.abs(SECRET_CASE.at[0] - 9.5)).toBeLessThan(0.01);
    expect(SECRET_CASE.w).toBeGreaterThanOrEqual(1.4);
    const passage = (SECRET_CASE.openX - SECRET_CASE.w / 2) - (9.5 - 0.7);
    expect(passage).toBeGreaterThan(2 * 0.38 + 0.3);
    // the boards fill the reserved room from wall to wall
    expect([SEDE_NIGHTINGALE.rect[0], SEDE_NIGHTINGALE.rect[2]]).toEqual([8, 11]);
  });

  it('o portão da Sede fica numa área andável e longe do Mirante e da sua escada (primeira tentativa, descartada)', () => {
    const [cx, cz] = S.house.c;
    expect(clampToRegions(cx, cz + Math.cos(S.house.rot) * 2.2)).toBeNull();
    const overlaps = (r: { x0: number; x1: number; z0: number; z1: number }) => cx + 2.8 > r.x0 && cx - 2.8 < r.x1 && cz + 0.8 > r.z0 && cz - 0.8 < r.z1;
    expect(overlaps(MIRANTE)).toBe(false);
    expect(overlaps({ x0: MIRANTE_STAIRS.xBottom, x1: MIRANTE_STAIRS.xTop, z0: MIRANTE_STAIRS.z0, z1: MIRANTE_STAIRS.z1 })).toBe(false);
  });

  it('o portão da Sede só abre para quem tem a permissão do Toshi', () => {
    const p = useGameStore.getState().progress;
    expect(checkCondition(S.lock!.unless, { ...p, flags: {} })).toBe(false);
    expect(checkCondition(S.lock!.unless, { ...p, flags: { acesso_sede: true } })).toBe(true);
  });
});

describe('paredes que abaixam (a câmera sempre vê o gato)', () => {
  // the map room case seen in play: camera south and above, the cat 0.9 m past an inner wall
  const wall = { x0: 4, z0: -5, x1: 11, z1: -5, top: 2.1 };
  const camAt = (catZ: number) => ({ x: 6, y: 6.4, z: catZ + 5.1 });

  it('a parede entre a câmera e o gato abaixa', () => {
    expect(wallHides(camAt(-5.9), { x: 6, y: 1.0, z: -5.9 }, wall)).toBe(true);
  });

  it('a parede atrás do gato, ou bem abaixo da linha de visão, fica de pé', () => {
    // the cat is on the camera's side of the wall
    expect(wallHides(camAt(-3), { x: 6, y: 1.0, z: -3 }, wall)).toBe(false);
    // a low wall far under the line of sight
    expect(wallHides({ x: 6, y: 12, z: 0 }, { x: 6, y: 1, z: -5.5 }, { ...wall, top: 0.5 })).toBe(false);
    // a wall off to the side, not crossed by the line of sight
    expect(wallHides(camAt(-5.9), { x: 6, y: 1.0, z: -5.9 }, { x0: 9, z0: -10, x1: 9, z1: -5, top: 2.1 })).toBe(false);
  });
});

describe('desafios: respostas conferidas pela conta', () => {
  it('Academia', () => {
    const seq = [2, 5, 11, 23];
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBe(seq[i - 1] * 2 + 1);
    expect(CHALLENGES.acad_sequencia.answer).toBe(23 * 2 + 1);
    expect(CHALLENGES.acad_fracoes.answer).toBe(36 - 36 / 3 - 36 / 4);
    expect(CHALLENGES.acad_medidas.answer).toBe((3 * 100 + 20) / 40);
    expect(CHALLENGES.acad_extra.answer * 3 + 4).toBe(31);
  });

  it('Sede', () => {
    const cols = 'ABCDE';
    const col = cols[cols.indexOf('C') + 2];
    const row = 4 - 3;
    const c = CHALLENGES.mapa_coordenadas;
    expect(c.choices![c.answer]).toBe(`${col}${row}`);
    expect(CHALLENGES.suprimentos_rio.answer).toBe(4 * (3 / 4) * 3);
    expect(CHALLENGES.suprimentos_montanha.answer).toBe(4 * (3 / 4) * 5);
    const q = CHALLENGES.quem_levou;
    expect(q.choices![q.answer]).toBe('O próprio Mikage');
  });
});

describe('missões jogadas do começo ao fim, pelas ações do próprio jogo', () => {
  const st = () => useGameStore.getState();
  /** Picks an option of the NPC's current dialogue by its label and runs it (like a click). */
  const talk = (npcId: string, label?: string) => {
    const d = resolveDialogue(NPCS_BY_ID[npcId], st().progress)!;
    const walk = (tree: DialogueTree, id: string): void => {
      const node = tree[id];
      st().runActions(node.onEnter);
      const opt = label ? node.options.find((o) => o.label.includes(label)) ?? node.options[0] : node.options[0];
      st().runActions(opt.action);
      if (opt.nextNodeId) walk(tree, opt.nextNodeId);
    };
    walk(d.tree, d.startId);
    useGameStore.setState({ phase: 'playing', activeDialogue: null, activeChallenge: null });
  };
  const solve = (challengeId: string) => {
    st().runActions(CHALLENGES[challengeId].onSuccess);
    useGameStore.setState({ phase: 'playing', activeChallenge: null });
  };
  const object = (id: string) => {
    const o = OBJECTS_BY_ID[id];
    expect(checkCondition(o.when, st().progress), `${id} existe`).toBe(true);
    if (o.dialogue) {
      st().runActions(o.dialogue.start.onEnter);
      for (const opt of o.dialogue.start.options) st().runActions(opt.action);
    }
    if (o.actions?.startsWith('CHALLENGE:')) solve(o.actions.slice(10));
    else st().runActions(o.actions);
  };

  beforeEach(() => {
    st().resetGame();
    useGameStore.setState({ phase: 'playing', celebrations: [] });
    // the academy opens after the Temple of Riddles
    const done = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { status: 'done' as const, steps: MISSIONS[id].steps.map((s) => s.id) }]));
    useGameStore.setState((s) => ({ progress: { ...s.progress, missions: { ...s.progress.missions, ...done(['peixes', 'templo']) } } }));
  });

  it('A Academia Ninja: matrícula, quatro selos e a formatura (faixa, técnica e a chave da Sede)', () => {
    expect(availableOffer(NPCS_BY_ID.sumi, st().progress)).toBe('academia');
    talk('sumi', 'matricular');
    expect(st().progress.missions.academia?.steps).toEqual(['matricula']);
    // numbers: the board shows one problem at a time
    object('quadro_numeros_1');
    expect(checkCondition(OBJECTS_BY_ID.quadro_numeros_1.when, st().progress)).toBe(false);
    object('quadro_numeros_2');
    object('quadro_numeros_3');
    expect(st().progress.missions.academia.steps).toContain('numeros');
    // logic: both rounds of levers
    st().runActions(LEVER_SOLVED[0]);
    expect(st().progress.missions.academia.steps).not.toContain('logica');
    st().runActions(LEVER_SOLVED[1]);
    // silence and movement
    object('pergaminho_rouxinol');
    st().runActions(CIRCUIT_DONE);
    expect(st().progress.missions.academia.steps).toEqual(expect.arrayContaining(['numeros', 'logica', 'rouxinol', 'circuito']));
    talk('sumi');
    expect(st().progress.missions.academia.status).toBe('done');
    expect(st().progress.abilities).toContain('passo_leve');
    expect(st().progress.inventory.faixa_academia).toBe(1);
    expect(ITEMS.faixa_academia.slot).toBe('faixa');
    expect(st().player.badges).toContain('Graduado da Academia');
    expect(st().progress.missions.audiencia?.status).toBe('active');
    expect(st().progress.tracked).toBe('audiencia');
  });

  it('a Sede: audiência, registros sumidos, expedição (a rota muda a conta e o prêmio) e o segredo da biblioteca', () => {
    const doneMissions = ['academia'];
    useGameStore.setState((s) => ({ progress: { ...s.progress, missions: { ...s.progress.missions, academia: { status: 'done', steps: MISSIONS.academia.steps.map((x) => x.id) } } } }));
    expect(doneMissions).toHaveLength(1);
    st().startMission('audiencia');
    expect(checkCondition(S.lock!.unless, st().progress)).toBe(false);
    talk('toshi');
    expect(st().progress.flags.acesso_sede).toBe(true);
    talk('mikage');
    expect(st().progress.missions.audiencia.status).toBe('done');

    // three people offer three different missions, and the log agrees with each of them
    expect(availableOffer(NPCS_BY_ID.mikage, st().progress)).toBe('documentos');
    expect(availableOffer(NPCS_BY_ID.yuki, st().progress)).toBe('expedicao');
    expect(availableOffer(NPCS_BY_ID.fumi, st().progress)).toBe('pergaminho');

    // Os Registros Sumidos
    talk('mikage', 'investigo');
    for (const id of ['pagina_biblioteca', 'pagina_reunioes', 'pagina_mapas']) object(id);
    expect(st().progress.inventory.pagina_registro).toBe(3);
    talk('mikage', 'Já sei');
    useGameStore.setState({ phase: 'playing', activeChallenge: null });
    solve('quem_levou');
    talk('mikage');
    expect(st().progress.missions.documentos.status).toBe('done');
    expect(st().progress.inventory.pagina_registro ?? 0).toBe(0);

    // A Expedição, pela rota da montanha
    talk('yuki', 'Topo');
    object('mesa_mapa_regiao');
    const table = OBJECTS_BY_ID.mesa_conselho_rota.dialogue!;
    st().runActions(table.montanha.onEnter);
    expect(st().progress.flags.rota_montanha).toBe(true);
    expect(checkCondition(OBJECTS_BY_ID.caixas_rio.when, st().progress)).toBe(false);
    object('caixas_montanha');
    talk('yuki');
    expect(st().progress.missions.expedicao.status).toBe('done');
    expect(st().progress.inventory.capa_vento).toBe(1);
    expect(st().progress.inventory.corda_ninja ?? 0).toBe(0);

    // O Segredo da Biblioteca
    talk('fumi', 'descobrir');
    object('catalogo_poema');
    st().runActions(BOOK_SOLVED);
    expect(st().progress.flags.biblioteca_aberta).toBe(true);
    object('pedestal_fundacao');
    talk('mikage');
    expect(st().progress.missions.pergaminho.status).toBe('done');
    expect(st().progress.inventory.pergaminho_fundacao).toBe(1);
    expect(st().player.badges).toContain('Guardião da História');
  });

  it('a rota do rio pede outra conta e dá outro prêmio', () => {
    useGameStore.setState((s) => ({ progress: { ...s.progress, missions: { ...s.progress.missions, audiencia: { status: 'done', steps: ['portao', 'mikage'] } } } }));
    talk('yuki', 'Topo');
    object('mesa_mapa_regiao');
    st().runActions(OBJECTS_BY_ID.mesa_conselho_rota.dialogue!.rio.onEnter);
    expect(checkCondition(OBJECTS_BY_ID.caixas_montanha.when, st().progress)).toBe(false);
    expect(OBJECTS_BY_ID.caixas_rio.actions).toBe('CHALLENGE:suprimentos_rio');
    object('caixas_rio');
    talk('yuki');
    expect(st().progress.inventory.corda_ninja).toBe(1);
    expect(st().progress.inventory.capa_vento ?? 0).toBe(0);
  });

  it('um aviso com defeito não corta a formatura ao meio (a próxima missão começa mesmo assim)', () => {
    // seen in play: a notice that threw on the "new technique" event stopped completeMission after the rewards
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const off = onGameEvent((e) => {
      if (e.type === 'ability') throw new Error('aviso quebrado');
    });
    useGameStore.setState((s) => ({ progress: { ...s.progress, missions: { ...s.progress.missions, academia: { status: 'active', steps: ['matricula', 'numeros', 'logica', 'rouxinol', 'circuito'] } } } }));
    talk('sumi');
    off();
    quiet.mockRestore();
    expect(st().progress.abilities).toContain('passo_leve');
    expect(st().progress.flags.graduado_academia).toBe(true);
    expect(st().progress.missions.audiencia?.status).toBe('active');
  });

  it('antes do Templo dos Enigmas, a Sumi não matricula (e o registro não diz que pode)', () => {
    st().resetGame();
    useGameStore.setState({ phase: 'playing', celebrations: [] });
    expect(availableOffer(NPCS_BY_ID.sumi, st().progress)).toBeNull();
    const d = resolveDialogue(NPCS_BY_ID.sumi, st().progress)!;
    expect(JSON.stringify(d.tree)).not.toContain('START:academia');
  });
});
