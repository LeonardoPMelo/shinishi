import type { Condition, DialogueOption, DialogueRoute, DialogueTree, Item, Mission } from '../types';
import type { WorldObject } from './world';
import { w, type EnemySpawn } from './wild';

/**
 * As Terras Selvagens, segunda parte (after Etapa 10): the Chefe Espinho's band and what it stole, the caves'
 * singing crystals, and the places that hold them. Local coordinates like data/wild.ts.
 *
 *  - O Acampamento dos Espinhos (the old bandits' clearing): tents, a lookout, the stolen goods, three cages.
 *    Its band: hedgehogs, a badger with a shield at the entrance, a weasel on its round, a fox archer on the
 *    lookout, and (once he comes back for his loot) the Chefe Espinho himself.
 *  - O Fortim do Hissui gets its watchtower archer and a gate guard.
 *  - A Caverna da Névoa: four crystal pillars that sing a tune to repeat, and the chamber they open.
 *
 * Missions: Os Animais Sumidos (Momo), O Chefe Espinho (Yuki), Os Cristais Cantores (Bento).
 */

const say = (speaker: string, text: string, options: DialogueOption[] = [{ label: 'Ok', nextNodeId: null }], onEnter?: string): DialogueTree => ({
  start: { id: 'start', speaker, text, onEnter, options },
});

// ── O Acampamento dos Espinhos ───────────────────────────────────────────────

export const ESPINHO_CAMP = { x: -16, z: -13, r: 10 };
/** Gone for good once the chief is beaten. */
export const ESPINHO_BAND: Condition = { notFlag: 'espinho_vencido' };
export const ESPINHO_TENTS: { x: number; z: number; rot: number }[] = [
  { x: -22.4, z: -18.6, rot: 0.5 },
  { x: -11.6, z: -19.6, rot: -0.4 },
  { x: -21.6, z: -9.0, rot: 2.6 },
];
/** The lookout the archer stands on, and its height. */
export const ESPINHO_LOOKOUT = { x: -8.6, z: -18.4, h: 2.2 };
export const ESPINHO_FIRE = { x: -17.4, z: -16.4 };
/** The stolen goods, piled up. */
export const ESPINHO_LOOT = { x: -13.4, z: -21.4 };
/** The camp's worn paths (world/WildCamps.tsx paints them): from the entrance to the fire, and from the fire to each
 *  tent, the loot, the cages and the lookout. */
export const CAMP_PATHS: [number, number][][] = [
  [[-6.6, -11.2], [-11.8, -13.0], [ESPINHO_FIRE.x, ESPINHO_FIRE.z]],
  ...ESPINHO_TENTS.map((t): [number, number][] => [[ESPINHO_FIRE.x, ESPINHO_FIRE.z], [t.x, t.z]]),
  [[ESPINHO_FIRE.x, ESPINHO_FIRE.z], [ESPINHO_LOOT.x, ESPINHO_LOOT.z]],
  [[ESPINHO_FIRE.x, ESPINHO_FIRE.z], [-23.0, -14.0]],
  // to the third cage (the band goes to feed the animals)
  [[ESPINHO_FIRE.x, ESPINHO_FIRE.z], [-18.6, -20.2]],
  [[-11.8, -13.0], [ESPINHO_LOOKOUT.x - 0.8, ESPINHO_LOOKOUT.z + 1.0]],
];
/** The camp's clutter (world/WildCamps.tsx): off the worn paths, the band's spots and the weasel's round. */
export const CAMP_PROPS = {
  firewood: { x: -19.8, z: -19.9, rot: 0.4 },
  sacks: [{ x: -15.3, z: -22.2, rot: 0.3, s: 1 }, { x: -15.95, z: -21.55, rot: 1.2, s: 0.9 }, { x: -15.6, z: -22.75, rot: 2.2, s: 0.8 }],
  pinecones: { x: -10.0, z: -19.7 },
  rack: { x: -24.7, z: -21.7, rot: 0.7 },
  table: { x: -21.4, z: -12.4, rot: -0.5 },
};
/** The cages with the missing animals (open each one: they run home to the camp). */
export const CAGES: { id: string; x: number; z: number; animal: 'coelho' | 'cervo' | 'passaro' }[] = [
  { id: 'jaula_1', x: -24.4, z: -12.4, animal: 'coelho' },
  { id: 'jaula_2', x: -24.0, z: -15.6, animal: 'cervo' },
  { id: 'jaula_3', x: -18.6, z: -21.0, animal: 'passaro' },
];
/** Opening a cage is too risky while somebody of the band is after the cat this close. */
export const CAGE_SAFE = 7;
export const CAGE_REACH = 1.5;

// ── O Fortim do Hissui ───────────────────────────────────────────────────────

export const FORT_TOWERS: { x: number; z: number; h: number }[] = [
  { x: -46.2, z: -31.4, h: 2.6 },
  { x: -31.8, z: -37.6, h: 2.6 },
];

/** The new creatures (Enemies.tsx spawns these with data/wild.ts ENEMY_SPAWNS). */
export const WILD2_SPAWNS: EnemySpawn[] = [
  // the Espinho band: a badger at the east entrance, a weasel on its round, an archer on the lookout, and
  // two hedgehogs napping by the fire (a noise or a close cat wakes them)
  { id: 'texugo_espinho', kind: 'texugo', at: [-7.6, -11.2], r: 0, heading: Math.PI / 2, when: ESPINHO_BAND },
  { id: 'doninha_espinho', kind: 'doninha', at: [-8.4, -6.4], r: 0, when: ESPINHO_BAND, route: [[-8.4, -6.4], [-19.8, -6.6], [-14.0, -8.8]] },
  { id: 'arqueira_espinho', kind: 'arqueira', at: [ESPINHO_LOOKOUT.x, ESPINHO_LOOKOUT.z], r: 0, heading: 0.6, when: ESPINHO_BAND, post: true, y: ESPINHO_LOOKOUT.h },
  { id: 'ourico_fogo_1', kind: 'ourico', at: [-19.0, -15.4], r: 2, when: ESPINHO_BAND, rest: true },
  { id: 'ourico_fogo_2', kind: 'ourico', at: [-16.0, -17.8], r: 2, when: ESPINHO_BAND, rest: true },
  // the chief comes back for his loot once the animals are freed (his mission is running)
  { id: 'chefe_espinho', kind: 'chefe', at: [ESPINHO_LOOT.x + 1.4, ESPINHO_LOOT.z + 2.4], r: 3, heading: Math.PI, when: { active: 'chefe_espinho', notFlag: 'espinho_vencido' } },
  // the Fortim: an archer on the west tower and a badger at the canyon gate (sent away with the other guards
  // when Hissui waits for the letter, chapter 7)
  { id: 'arqueira_fortim', kind: 'arqueira', at: [FORT_TOWERS[0].x, FORT_TOWERS[0].z], r: 0, heading: 0.4, when: { notStep: 'hissui.ouvir' }, post: true, y: FORT_TOWERS[0].h },
  // (inside, by the tents and facing away from the canyon: the way in stays a stealth way, as chapter 7 needs)
  { id: 'texugo_fortim', kind: 'texugo', at: [-41.0, -32.0], r: 0, heading: -Math.PI / 2, when: { notStep: 'hissui.ouvir' } },
  // a weasel scouting the forest trail
  { id: 'doninha_mata', kind: 'doninha', at: [-8.6, 10.0], r: 0, when: ESPINHO_BAND, route: [[-8.6, 10.0], [-12.0, 2.4], [-15.4, -4.6], [-11.0, 3.0]] },
];

// ── A Caverna da Névoa: os cristais cantores ──────────────────────────────────

/** Four crystal pillars, each with its own note (west to east), and the echo stone that plays the tune. */
export const SINGING: { id: string; x: number; z: number; color: string; note: number }[] = [
  { id: 'cristal_azul', x: 21.2, z: -30.4, color: '#6FB8FF', note: 0 },
  { id: 'cristal_verde', x: 24.4, z: -34.6, color: '#7FE0A8', note: 1 },
  { id: 'cristal_rosa', x: 28.0, z: -34.8, color: '#FF9FD2', note: 2 },
  { id: 'cristal_ouro', x: 31.2, z: -30.6, color: '#FFD86A', note: 3 },
];
// (beside the cave trail: on it, it stood in the way)
export const ECHO_STONE = { x: 27.4, z: -27.6 };
/** The three tunes, longer each time (indices into SINGING). */
export const TUNES: number[][] = [[0, 2, 1], [1, 3, 0, 2], [2, 0, 3, 1, 3]];
/** The chamber in the north rock, shut by a slab until the last tune: x range and depth (local). */
export const CHAMBER = { x0: 24.8, x1: 27.2, z0: -40.6, z1: -38.6 };
export const TUNE_DONE = 'FLAG:camara_aberta;STEP:cristais_cantores.melodia;SFX:mechanism;SKILL:padroes';

/** What the game code runs for these places (checked with the data: systems/validateData.ts). */
export const WILD2_CODE_ACTIONS: Record<string, string> = {
  jaula: 'COUNT:jaulas;SFX:mechanism',
  chefe: 'FLAG:espinho_vencido;STEP:chefe_espinho.vencer;SFX:goal',
  melodia: TUNE_DONE,
};

// ── Items ────────────────────────────────────────────────────────────────────

export const WILD2_ITEMS: Item[] = [
  {
    id: 'coracao_nevoa', name: 'Coração da Névoa', icon: '💠', category: 'colecionavel', rarity: 'lendario',
    description: 'Um cristal do tamanho de uma ameixa, que canta baixinho quando a gente encosta no ouvido. Estava na câmara atrás dos cristais cantores.',
  },
];

// ── Missions ─────────────────────────────────────────────────────────────────

export const WILD2_MISSIONS: Mission[] = [
  {
    id: 'animais_sumidos', chapter: 6, title: 'Os Animais Sumidos', category: 'investigação', giver: 'momo',
    description: 'Coelhos, um filhote de cervo e um passarinho sumiram da Campina das Ervas. A Doutora Momo acha que alguém os levou.',
    steps: [
      { id: 'ouvir', description: 'Ouça a Doutora Momo no acampamento', target: { npc: 'momo' } },
      { id: 'rastros', description: 'Siga os rastros: da campina, pelas pedras do rio, até a mata', after: ['ouvir'], counter: { id: 'rastros', goal: 3 } },
      { id: 'jaulas', description: 'Abra as 3 jaulas no Acampamento dos Espinhos sem ser pego', after: ['rastros'], counter: { id: 'jaulas', goal: 3 } },
      { id: 'voltar', description: 'Conte à Doutora Momo', after: ['jaulas'], target: { npc: 'momo' } },
    ],
    rewards: { xp: 90, coins: 30, gems: 3, badges: ['Protetor dos Bichos'] },
    lesson: 'Rastros contam uma história: cada pista leva à próxima. E às vezes a coragem é agir em silêncio, sem brigar com ninguém.',
    onComplete: 'FLAG:animais_salvos',
  },
  {
    id: 'chefe_espinho', chapter: 6, title: 'O Chefe Espinho', category: 'principal', giver: 'yuki_campo',
    description: 'O Chefe Espinho voltou ao acampamento atrás dos bichos que você soltou. Enquanto ele estiver lá, a campina não fica em paz.',
    steps: [
      { id: 'ouvir', description: 'Ouça a Conselheira Yuki no acampamento', target: { npc: 'yuki_campo' } },
      { id: 'vencer', description: 'Vença o Chefe Espinho no Acampamento dos Espinhos', after: ['ouvir'], target: { position: w(-12.0, -19.0) } },
      { id: 'contar', description: 'Volte à Conselheira Yuki', after: ['vencer'], target: { npc: 'yuki_campo' } },
    ],
    rewards: { xp: 120, coins: 40, gems: 4, badges: ['Fim do Bando dos Espinhos'] },
    lesson: 'Com um adversário forte, observe antes de agir: ele avisa antes de atacar, fica tonto depois de errar, e é aí que a sua chance aparece.',
  },
  {
    id: 'cristais_cantores', chapter: 6, title: 'Os Cristais Cantores', category: 'educativa', giver: 'bento',
    description: 'O Bento ouviu música dentro da Caverna da Névoa. Os cristais cantam uma melodia... e parece que esperam uma resposta.',
    steps: [
      { id: 'ouvir', description: 'Ouça o Bento no acampamento', target: { npc: 'bento' } },
      { id: 'escutar', description: 'Encoste a orelha na pedra do eco, dentro da caverna', after: ['ouvir'], target: { object: 'pedra_eco' } },
      { id: 'melodia', description: 'Repita as três melodias tocando os cristais na mesma ordem', after: ['escutar'], target: { position: w(ECHO_STONE.x, ECHO_STONE.z) } },
      { id: 'camara', description: 'Entre na câmara que se abriu e abra o baú', after: ['melodia'], target: { object: 'bau_camara' } },
      { id: 'voltar', description: 'Mostre ao Bento o que encontrou', after: ['camara'], target: { npc: 'bento' } },
    ],
    rewards: { xp: 90, coins: 25, gems: 3, badges: ['Ouvido de Cristal'] },
    lesson: 'Uma sequência fica mais fácil de lembrar em pedaços: agrupe as notas de duas em duas, ou dê um nome para cada cor.',
  },
];

// ── Objects ──────────────────────────────────────────────────────────────────

const TRACKS: { id: string; at: [number, number]; text: string }[] = [
  { id: 'rastro_1', at: [13.6, 3.4], text: 'Pegadas de coelho correndo... e, por cima delas, marcas de patinhas pontudas e um sulco de rodas. Alguém puxou um carrinho para o oeste, rumo às pedras do rio.' },
  { id: 'rastro_2', at: [1.2, -7.4], text: 'Do outro lado das pedras: um tufo de pelo branco de coelho preso num galho e as mesmas marcas de rodas, agora entrando na mata.' },
  { id: 'rastro_3', at: [-5.6, -9.6], text: 'Uma pena azul, um espinho de ouriço e as rodas sumindo na direção da clareira com fumaça. É o Acampamento dos Espinhos.' },
];

export const WILD2_OBJECTS: WorldObject[] = [
  ...TRACKS.map((t): WorldObject => ({
    id: t.id, kind: 'clue', position: w(t.at[0], t.at[1]), label: 'Examinar os rastros', name: 'Rastros',
    when: { step: 'animais_sumidos.ouvir', notFlag: t.id },
    dialogue: say('Rastros', t.text, undefined, `FLAG:${t.id};COUNT:rastros`),
  })),
  {
    id: 'pedra_eco', kind: 'examine', position: w(ECHO_STONE.x, ECHO_STONE.z), label: 'Encostar a orelha na pedra', name: 'Pedra do eco', radius: 1.5,
    when: { step: 'cristais_cantores.ouvir', notStep: 'cristais_cantores.escutar' },
    dialogue: say('Pedra do eco', 'Você encosta a orelha na pedra fria... e ouve: quatro notas, uma para cada cristal, numa ordem que se repete.\nToque a pedra de novo para ouvir a melodia, depois toque os cristais na mesma ordem.', undefined, 'STEP:cristais_cantores.escutar'),
  },
  {
    id: 'bau_camara', kind: 'chest', position: w((CHAMBER.x0 + CHAMBER.x1) / 2, CHAMBER.z0 + 0.7), label: 'Abrir o baú da câmara', name: 'Baú da câmara',
    usableWhen: { flag: 'camara_aberta' },
    hideWhen: { flag: 'bau_camara_aberto' },
    actions: 'GIVE:coracao_nevoa;COINS:25;GEMS:2;FLAG:bau_camara_aberto;STEP:cristais_cantores.camara;SECRET:camara_cristais',
  },
  {
    id: 'placa_espinhos', kind: 'sign', position: w(-5.6, -12.6), rotation: Math.PI / 2, label: 'Ler a placa', name: 'Placa rabiscada',
    dialogue: say('Placa rabiscada', '"ACAMPAMENTO DOS ESPINHOS. Proibido entrar. Proibido sair também, se for bicho."\nEmbaixo, em letra pequena: "Assinado: Chefe Espinho, o mais espetado da floresta."'),
  },
];

// ── What the camp's people say (spliced into their routes like data/story.ts) ──

export const WILD2_ROUTES: Record<string, { active: DialogueRoute[]; offers: DialogueRoute[]; offerMeta: { mission: string; when?: Condition }[] }> = {
  momo: {
    active: [
      { when: { active: 'animais_sumidos', step: 'animais_sumidos.jaulas', notStep: 'animais_sumidos.voltar' }, tree: say('Doutora Momo',
        'Eles voltaram! O coelhinho, o filhote de cervo, até o passarinho azul... estão todos aqui, comendo hortelã.\nVocê entrou no acampamento dos bandidos e soltou os três sem uma briga sequer? Que coragem tranquila, Shinichi.',
        [{ label: '🐾 Eles estão a salvo!', nextNodeId: null, action: 'STEP:animais_sumidos.voltar' }]) },
      { when: { active: 'animais_sumidos', step: 'animais_sumidos.rastros' }, tree: say('Doutora Momo',
        'O Acampamento dos Espinhos! Fica na velha clareira da mata, a oeste do rio.\nCuidado: o texugo guarda a entrada leste, uma doninha faz a ronda e tem uma raposa na torre. Agachado (C) eles demoram mais para te ver. Uma shuriken jogada longe (1) faz eles irem olhar.') },
      { when: { active: 'animais_sumidos' }, tree: say('Doutora Momo', 'Comece pela campina, entre o acampamento e o rio: os rastros vão mostrando o caminho. Olhe com calma.') },
    ],
    offers: [
      { when: { done: 'filhote', notStarted: 'animais_sumidos' }, tree: {
        start: {
          id: 'start', speaker: 'Doutora Momo', mood: 'sad',
          text: 'Shinichi, os bichos da campina estão sumindo. Ontem, dois coelhos. Hoje, um filhote de cervo e o passarinho azul que dorme na barraca.\nNão foi o vento, nem um bicho com fome: tinha marcas de rodas na grama.',
          options: [{ label: '🔍 Eu sigo os rastros!', nextNodeId: null, action: 'START:animais_sumidos;STEP:animais_sumidos.ouvir;TRACK:animais_sumidos' }, { label: 'Depois', nextNodeId: null }],
        },
      } },
    ],
    offerMeta: [{ mission: 'animais_sumidos', when: { done: 'filhote' } }],
  },
  yuki_campo: {
    active: [
      { when: { active: 'chefe_espinho', step: 'chefe_espinho.vencer', notStep: 'chefe_espinho.contar' }, tree: say('Conselheira Yuki',
        'O Chefe Espinho desistiu e foi embora com o bando todo! Os batedores viram as barracas vazias.\nVocê observou, esperou a hora certa e não perdeu a calma. É isso que eu chamo de estratégia.',
        [{ label: '🦔 A campina está em paz!', nextNodeId: null, action: 'STEP:chefe_espinho.contar' }]) },
      { when: { active: 'chefe_espinho' }, tree: say('Conselheira Yuki',
        'O Chefe Espinho é grande e tem espinhos como os ouriços: pancada só vale quando ele está tonto (💫), depois de errar uma investida.\nQuando ele ficar bravo, fica mais rápido. Use as pedras e as barracas: quem investe contra elas fica tonto mais tempo.') },
    ],
    offers: [
      { when: { done: 'animais_sumidos', notStarted: 'chefe_espinho' }, tree: {
        start: {
          id: 'start', speaker: 'Conselheira Yuki',
          text: 'Notícia dos batedores: o Chefe Espinho voltou ao acampamento dele, furioso porque os bichos fugiram.\nEnquanto ele estiver lá, a campina não fica em paz. Você topa enfrentar o chefe do bando?',
          options: [{ label: '🦔 Topo!', nextNodeId: null, action: 'START:chefe_espinho;STEP:chefe_espinho.ouvir;TRACK:chefe_espinho' }, { label: 'Depois', nextNodeId: null }],
        },
      } },
    ],
    offerMeta: [{ mission: 'chefe_espinho', when: { done: 'animais_sumidos' } }],
  },
  bento: {
    active: [
      { when: { active: 'cristais_cantores', step: 'cristais_cantores.camara', notStep: 'cristais_cantores.voltar' }, tree: say('Bento',
        'O Coração da Névoa! Encosta no ouvido... ele está cantando a terceira melodia!\nVou desenhar a câmara no mapa. Você tem ouvido de músico, Shinichi.',
        [{ label: '💠 Mostrar o cristal', nextNodeId: null, action: 'STEP:cristais_cantores.voltar' }]) },
      { when: { active: 'cristais_cantores' }, tree: say('Bento',
        'A pedra do eco fica no meio da caverna, entre os quatro cristais grandes. Escute, depois repita.\nDica de cartógrafo: dê um nome para cada cor. "Azul, rosa, verde" é mais fácil de lembrar do que "aquele, aquele e aquele".') },
    ],
    offers: [
      { when: { done: 'cristais', notStarted: 'cristais_cantores' }, tree: {
        start: {
          id: 'start', speaker: 'Bento',
          text: 'Lembra dos Cristais da Névoa? Voltei na caverna para desenhar... e os cristais grandes estavam CANTANDO.\nQuatro notas, sempre na mesma ordem. Acho que é uma fechadura. Uma fechadura musical!',
          options: [{ label: '🎵 Vamos ouvir!', nextNodeId: null, action: 'START:cristais_cantores;STEP:cristais_cantores.ouvir;TRACK:cristais_cantores' }, { label: 'Depois', nextNodeId: null }],
        },
      } },
    ],
    offerMeta: [{ mission: 'cristais_cantores', when: { done: 'cristais' } }],
  },
};
