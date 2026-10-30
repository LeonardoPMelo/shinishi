import type { Challenge, Condition, DialogueOption, DialogueRoute, DialogueTree, Item, Mission, NPCDefinition, Vec3 } from '../types';
import type { WorldObject } from './world';
import { INTERIORS_BY_ID, toWorld } from './interiors';
import { SHRINE } from '../systems/temple';
import { ANCIENT } from './south';
import { CLEARING } from './west';
import { MIRANTE } from './world2';
import { w } from './wild';

/**
 * Capítulo 7 — O Pacto das Duas Margens (Etapa 8 da expansão): the end of the story that began with the
 * stolen fish. The General Hissui gets a face, a past and a reason: he comes from the far bank of the river,
 * where the families were left behind in the Great Flood, the night the village was born. The Disco Solar
 * opens the Celeiro do Sol, the reserve the founders built for exactly those families, and never delivered.
 * The ending is a duel of riddles and a pact, not a fight. Two side missions deepen the past: Shinichi's own
 * (a basket that came down the river with a jade ribbon) and the old ninja techniques (three stone steles).
 *
 * Also here: what the villagers say as the story moves (`STORY_REACTIONS`), the story so far of each chapter
 * (`CHAPTER_RECAPS`, in the Jornada panel), and the short interactive intro (`INTRO_PANELS`).
 */

const say = (speaker: string, text: string, options: DialogueOption[] = [{ label: 'Ok', nextNodeId: null }], onEnter?: string): DialogueTree => ({
  start: { id: 'start', speaker, text, options, onEnter },
});
const sede = (x: number, z: number): Vec3 => toWorld(INTERIORS_BY_ID.sede, x, z);

/**
 * Mestre Kuma's shed (data/world.ts SHED_POS; repeated here because world.ts imports this file: a value import
 * back would be a cycle. tests/story.test.ts checks they agree).
 */
export const SHED_AT: Vec3 = [-16.3, 0, 17.6];

/** The jade ribbon's colour: the far-bank weavers' colour, and Hissui's scarf. */
export const JADE = '#4FA383';

// ── Items ────────────────────────────────────────────────────────────────────

export const STORY_ITEMS: Item[] = [
  {
    id: 'fita_jade', name: 'Fita Verde-Jade', icon: '🟢', category: 'cosmetico', rarity: 'lendario', slot: 'faixa', band: JADE,
    description: 'Veio amarrada no cesto em que o Shinichi desceu o rio, ainda filhote. Tecida do jeito da outra margem.',
    effectText: 'Vestida: a faixa do Shinichi fica verde-jade. Alguém das terras selvagens vai reconhecê-la.',
  },
  {
    id: 'carta_mikage', name: 'Carta do Mikage', icon: '✉️',
    description: 'Lacrada com a pata do Mikage. Endereçada a "Hissui, meu velho amigo da outra margem".',
  },
];

// ── Challenges: the Duel of Riddles ──────────────────────────────────────────

export const STORY_CHALLENGES: Challenge[] = [
  {
    id: 'duelo_1', title: 'Duelo de Enigmas — 1', skill: 'logica', kind: 'choice',
    story: 'O Hissui cruza os braços: "Na minha margem, cada família guarda peixe para o inverno.\nA família Musgo tem mais que a família Pedra. A família Pedra tem mais que a família Junco."',
    question: 'Qual família tem MENOS peixe?',
    choices: ['Musgo', 'Pedra', 'Junco'], answer: 2,
    observe: 'Coloque as famílias numa fila, da que tem mais para a que tem menos, usando as duas frases.',
    hint: 'Musgo vem antes de Pedra; Pedra vem antes de Junco. Quem ficou no fim da fila?',
    example: 'Se Ana é mais alta que Bia e Bia é mais alta que Cris, a mais baixa é a Cris.',
    successText: '"Hm. Pensa antes de pular. Gato de rio aprende isso cedo."',
    onSuccess: 'STEP:hissui.duelo1',
  },
  {
    id: 'duelo_2', title: 'Duelo de Enigmas — 2', skill: 'divisao', kind: 'number',
    story: '"O Celeiro do Sol guarda 48 peixes secos. Se fossem divididos igualmente entre 8 famílias, 5 da vila e 3 da minha margem..."',
    question: 'Quantos peixes cada família receberia?',
    answer: 6,
    observe: 'Repartir igualmente é dividir: o total pelo número de famílias.',
    hint: '5 + 3 = 8 famílias. Quanto é 48 ÷ 8?',
    example: 'Com 20 peixes para 4 famílias: 20 ÷ 4 = 5 para cada uma.',
    successText: '"Seis para cada. Ninguém com mais, ninguém com menos." Ele fica quieto um instante.',
    onSuccess: 'STEP:hissui.duelo2',
  },
  {
    id: 'duelo_3', title: 'Duelo de Enigmas — 3', skill: 'fracoes', kind: 'choice',
    story: '"Última. Das 8 famílias, 3 são da minha margem."',
    question: 'Que fração do celeiro fica com a margem do Hissui?',
    choices: ['1/3', '3/8', '3/5', '5/8'], answer: 1,
    observe: 'A fração é "a parte sobre o todo": quantas famílias são da margem dele, de quantas no total?',
    hint: 'A parte é 3. O todo são 8 famílias.',
    example: 'Se 2 de 5 gatos são malhados, os malhados são 2/5 dos gatos.',
    successText: '"Três oitavos. Era isso que o meu pai pedia. Só isso."',
    onSuccess: 'STEP:hissui.duelo3',
  },
];

// ── People ───────────────────────────────────────────────────────────────────

const HISSUI_LOOK = { species: 'cat' as const, fur: '#6E8C80', belly: '#D3DED6', scale: 1.15, eyes: 'sharp' as const, accessory: 'guard' as const };

/** At the outpost, from the moment Yuki sends Shinichi to him until the pact. */
export const HISSUI: NPCDefinition = {
  id: 'hissui',
  name: 'General Hissui',
  role: 'Líder do bando da outra margem',
  position: w(-38.2, -35.6),
  faceRotation: 0,
  look: HISSUI_LOOK,
  voice: 'meow_low',
  visibleWhen: { step: 'hissui.ouvir', notStep: 'hissui.acordo' },
  barks: ['Mais um passo e eu chamo as raposas.', 'A vila tem ponte. A minha margem tinha água.'],
  routes: [
    // the jade ribbon: he recognises the far bank's weaving (only when Shinichi wears it)
    { when: { active: 'hissui', notStep: 'hissui.encontrar', item: { id: 'carta_mikage' } }, tree: {
      start: {
        id: 'start', speaker: 'General Hissui', mood: 'angry',
        text: 'Então a vila mandou um aprendiz. O Mikage nem teve coragem de vir.\nDiga o que veio dizer e vá embora antes que as raposas acordem.',
        options: [
          { label: '✉️ Entregar a carta do Mikage', nextNodeId: 'carta' },
        ],
      },
      carta: {
        id: 'carta', speaker: 'General Hissui', mood: 'surprised',
        text: '*(lê em silêncio)*\n"Hissui. O celeiro do sol era para a sua margem. Os fundadores o encheram para vocês, e eu nunca levei.\nNão é um pedido de desculpas: é um convite. Ninguém fica para trás. — Mikage"',
        options: [{ label: '...', nextNodeId: 'duvida' }],
      },
      duvida: {
        id: 'duvida', speaker: 'General Hissui',
        text: 'Palavras bonitas. Na noite da cheia também houve palavras bonitas, e a ponte chegou tarde.\nVocê quer que eu confie na vila? Então prove que a vila sabe pensar e dividir. Um duelo: três enigmas. Errou, tenta de novo. Sem pressa.',
        options: [{ label: '🧠 Aceito o duelo', nextNodeId: null, action: 'STEP:hissui.encontrar;TAKE:carta_mikage' }],
      },
    } },
    { when: { active: 'hissui', step: 'hissui.encontrar', notStep: 'hissui.duelo1' }, tree: say('General Hissui',
      'Primeiro enigma. Ouça bem.', [{ label: '🧠 Pode falar', nextNodeId: null, action: 'CHALLENGE:duelo_1' }, { label: 'Daqui a pouco', nextNodeId: null }]) },
    { when: { active: 'hissui', step: 'hissui.duelo1', notStep: 'hissui.duelo2' }, tree: say('General Hissui',
      'Segundo enigma. Este é sobre o celeiro.', [{ label: '🧠 Pode falar', nextNodeId: null, action: 'CHALLENGE:duelo_2' }, { label: 'Daqui a pouco', nextNodeId: null }]) },
    { when: { active: 'hissui', step: 'hissui.duelo2', notStep: 'hissui.duelo3' }, tree: say('General Hissui',
      'O último.', [{ label: '🧠 Pode falar', nextNodeId: null, action: 'CHALLENGE:duelo_3' }, { label: 'Daqui a pouco', nextNodeId: null }]) },
    // the end of the duel; with the jade ribbon worn, he recognises where Shinichi came from
    { when: { active: 'hissui', step: 'hissui.duelo3', notStep: 'hissui.acordo', wearing: 'fita_jade' }, tree: {
      start: {
        id: 'start', speaker: 'General Hissui', mood: 'surprised',
        text: 'Espere. Essa fita na sua testa... esse trançado é da minha margem. Da família Junco.\nNa noite da cheia, uma das mães do Junco pôs o filhote num cesto para salvar ele da água. Nunca mais soubemos do cesto.',
        options: [{ label: 'O cesto... era eu?', nextNodeId: 'irmao' }],
      },
      irmao: {
        id: 'irmao', speaker: 'General Hissui', mood: 'happy',
        text: 'Então a correnteza levou você até a vila, e a vila cuidou de você. *(ri pela primeira vez)*\nTalvez a ponte tenha chegado, afinal. Do jeito torto que as pontes chegam.\nVou com você até o Mikage. Mas quem fala primeiro sou eu.',
        options: [{ label: '🐾 Combinado', nextNodeId: null, action: 'FLAG:hissui_reconheceu;STEP:hissui.acordo' }],
      },
    } },
    { when: { active: 'hissui', step: 'hissui.duelo3', notStep: 'hissui.acordo' }, tree: {
      start: {
        id: 'start', speaker: 'General Hissui',
        text: 'Três enigmas, três respostas. E nenhuma delas foi "a vila primeiro".\nEu queria o disco para pegar o celeiro à força. Parece que dá para pegar de outro jeito.',
        options: [{ label: 'Vem falar com o Mikage?', nextNodeId: 'vou' }],
      },
      vou: {
        id: 'vou', speaker: 'General Hissui',
        text: 'Vou até a Sede. Mas quem fala primeiro sou eu.',
        options: [{ label: '🐾 Combinado', nextNodeId: null, action: 'STEP:hissui.acordo' }],
      },
    } },
    { tree: say('General Hissui', 'Você não tem nada para me dizer, aprendiz. Ainda.') },
  ],
};

/** In the audience hall, next to Mikage, for the pact. */
export const HISSUI_SEDE: NPCDefinition = {
  id: 'hissui_sede',
  name: 'General Hissui',
  role: 'Visitante da outra margem',
  position: sede(2.3, -7.6),
  faceRotation: -Math.PI / 2,
  look: HISSUI_LOOK,
  voice: 'meow_low',
  visibleWhen: { step: 'hissui.acordo', notStep: 'hissui.pacto' },
  barks: ['Esta sala é grande demais.', 'Ele ainda bebe chá de jasmim? Igualzinho.'],
  routes: [
    { when: { active: 'hissui' }, tree: say('General Hissui', 'Fale com o Mikage. Eu estou ouvindo. Por enquanto.') },
    { tree: say('General Hissui', 'Hm.') },
  ],
};

/** After the pact: at the wild lands' camp, helping the expedition. */
export const HISSUI_ALIADO: NPCDefinition = {
  id: 'hissui_aliado',
  name: 'General Hissui',
  role: 'Aliado da Vila das Patas',
  position: w(28.6, 23.2),
  faceRotation: Math.PI / 2,
  look: HISSUI_LOOK,
  voice: 'meow_low',
  visibleWhen: { done: 'hissui' },
  barks: ['As armadilhas? Desmontei todas. Viraram cerca de horta.', 'Seis peixes por família. Eu conferi duas vezes.', 'O Bento me desenhou no mapa. Com bigode demais.'],
  routes: [
    { when: { flag: 'hissui_reconheceu' }, tree: say('General Hissui',
      'Primo de rio, como dizem na minha margem. As raposas e os ouriços agora ajudam a expedição.\nSe precisar de alguém para assustar um javali, sabe onde me achar.') },
    { tree: say('General Hissui',
      'As raposas e os ouriços agora ajudam a expedição. Ninguém mais dorme com fome na outra margem.\nE se você quiser um duelo de enigmas de novo... eu treinei.') },
  ],
};

export const STORY_NPCS: NPCDefinition[] = [HISSUI, HISSUI_SEDE, HISSUI_ALIADO];

// ── Routes added to existing villagers (spliced in data/npcs.ts) ─────────────

export interface StoryRoutes { active: DialogueRoute[]; offers: DialogueRoute[]; offerMeta: { mission: string; when?: Condition }[] }

export const STORY_ROUTES: Record<string, StoryRoutes> = {
  mikage: {
    active: [
      { when: { active: 'conselho', notStep: 'conselho.ouvir' }, tree: {
        start: {
          id: 'start', speaker: 'Mikage', mood: 'sad',
          text: '*(lê as ordens duas vezes)*\n"Achem o Disco Solar antes da Vila das Patas." Hissui... então é ele.',
          options: [{ label: 'O senhor conhece o Hissui?', nextNodeId: 'amigo' }],
        },
        amigo: {
          id: 'amigo', speaker: 'Mikage',
          text: 'Éramos dois mensageiros magricelas. Ele morava na outra margem do rio, com as famílias que pescavam no junco.\nNa noite da Grande Cheia, eu corri para acordar este lado. Ele correu para acordar o dele. A ponte caiu entre nós.',
          options: [{ label: 'E depois?', nextNodeId: 'registro' }],
        },
        registro: {
          id: 'registro', speaker: 'Mikage',
          text: 'Depois eu fiquei ocupado demais construindo a vila. E ele... foi embora.\nO registro daquela noite está na biblioteca, na estante do canto. Leia. Eu nunca tive coragem de reler.',
          options: [{ label: '📖 Vou ler', nextNodeId: null, action: 'STEP:conselho.ouvir;TAKE:ordens_hissui' }],
        },
      } },
      { when: { active: 'conselho', step: 'conselho.registro', notStep: 'conselho.mikage' }, tree: {
        start: {
          id: 'start', speaker: 'Mikage', mood: 'sad',
          text: '"Celeiro do Sol, para as famílias da outra margem, até que a ponte nova as alcance." Eu tinha esquecido. Ou quis esquecer.\nO Hissui não quer roubar a vila, Shinichi. Ele quer o que prometemos e nunca entregamos.',
          options: [{ label: 'Onde fica o celeiro?', nextNodeId: 'templo' }],
        },
        templo: {
          id: 'templo', speaker: 'Mikage',
          text: 'Embaixo do santuário do Templo dos Enigmas. Só o Disco Solar abre: o das Ruínas do Sol, nas terras selvagens.\nCom o disco nas patas, fale com a Tsubaki: ela sabe o caminho. Antes de qualquer coisa, precisamos ver com os próprios olhos.',
          options: [{ label: '🌞 Vou com a Tsubaki', nextNodeId: null, action: 'STEP:conselho.mikage' }],
        },
      } },
      { when: { active: 'conselho', step: 'conselho.ouvir' }, tree: say('Mikage', 'O registro da cheia está na biblioteca, na estante do canto.') },
      { when: { active: 'celeiro', step: 'celeiro.ler', notStep: 'celeiro.mikage' }, tree: {
        start: {
          id: 'start', speaker: 'Mikage',
          text: 'Cheio. Depois de tantos anos, cheio. Os fundadores encheram e ninguém nunca abriu.\n*(pega um pincel)* Vou escrever para o Hissui. Não um pedido de desculpas: um convite.',
          options: [{ label: '✉️ Eu levo a carta', nextNodeId: null, action: 'STEP:celeiro.mikage;GIVE:carta_mikage' }],
        },
      } },
      { when: { active: 'celeiro' }, tree: say('Mikage', 'A Tsubaki sabe o caminho do santuário. Leve o Disco Solar.') },
      // the pact
      { when: { active: 'hissui', step: 'hissui.acordo', notStep: 'hissui.pacto' }, tree: {
        start: {
          id: 'start', speaker: 'General Hissui', mood: 'angry',
          text: 'Mikage. Faz trinta invernos.',
          options: [{ label: '...', nextNodeId: 'mikage' }],
        },
        mikage: {
          id: 'mikage', speaker: 'Mikage', mood: 'sad',
          text: 'Trinta e um. E eu errei em todos eles, Hissui. O celeiro era seu. A ponte nova nunca foi construída.',
          options: [{ label: '...', nextNodeId: 'hissui' }],
        },
        hissui: {
          id: 'hissui', speaker: 'General Hissui',
          text: 'O seu aprendiz resolveu três enigmas meus sem nunca dizer "a vila primeiro". Isso vale mais que uma ponte.\nDivida o celeiro. Seis peixes por família. E construa a ponte nova, que eu ajudo.',
          options: [{ label: '...', nextNodeId: 'pacto' }],
        },
        pacto: {
          id: 'pacto', speaker: 'Mikage', mood: 'happy',
          text: 'Pacto das Duas Margens, então: ninguém fica para trás, de nenhum lado do rio.\n*(as duas patas se encontram)*\nShinichi... a vila nasceu numa noite de cheia. Hoje ela terminou de nascer.',
          options: [{ label: '🐾 Ninguém fica para trás', nextNodeId: null, action: 'STEP:hissui.pacto' }],
        },
      } },
    ],
    offers: [
      { when: { notStarted: 'conselho', done: 'posto' }, tree: {
        start: {
          id: 'start', speaker: 'Mikage', mood: 'surprised',
          text: 'Shinichi! A Yuki mandou um mensageiro: você trouxe algo do posto do Hissui?',
          options: [
            { label: '📜 As ordens do Hissui', nextNodeId: null, action: 'START:conselho' },
            { label: 'Depois', nextNodeId: null },
          ],
        },
      } },
    ],
    offerMeta: [{ mission: 'conselho', when: { done: 'posto' } }],
  },
  tsubaki: {
    active: [
      { when: { active: 'celeiro', notStep: 'celeiro.ouvir' }, tree: {
        start: {
          id: 'start', speaker: 'Tsubaki', mood: 'surprised',
          text: 'O Celeiro do Sol! Minha avó falava dele: uma porta redonda embaixo do santuário, sem fechadura nenhuma.\nSó um encaixe do tamanho de um disco. Você trouxe o disco?',
          options: [{ label: '🌞 Trouxe', nextNodeId: 'ir' }],
        },
        ir: {
          id: 'ir', speaker: 'Tsubaki',
          text: 'Então vá ao santuário, no fundo do templo. Ao lado do altar tem um pedestal com um sol gravado.\nEu fico aqui. Lugar fechado há cem anos tem cheiro de... cem anos.',
          options: [{ label: '🐾 Vou lá', nextNodeId: null, action: 'STEP:celeiro.ouvir' }],
        },
      } },
      { when: { active: 'celeiro' }, tree: say('Tsubaki', 'O pedestal fica ao lado do altar, no fundo do santuário.') },
    ],
    offers: [
      { when: { notStarted: 'celeiro', done: ['conselho', 'ruinas'] }, tree: say('Tsubaki', 'O Mikage me contou tudo. Quer abrir o Celeiro do Sol?', [
        { label: '🌞 Quero', nextNodeId: null, action: 'START:celeiro' },
        { label: 'Depois', nextNodeId: null },
      ]) },
    ],
    offerMeta: [{ mission: 'celeiro', when: { done: ['conselho', 'ruinas'] } }],
  },
  yuki_campo: {
    active: [
      { when: { active: 'hissui', notStep: 'hissui.ouvir' }, tree: {
        start: {
          id: 'start', speaker: 'Conselheira Yuki',
          text: 'Os batedores viram o Hissui em pessoa no posto, perto da fogueira. Sem as raposas por perto, pela primeira vez.\nÉ a sua chance de entregar a carta. Vá devagar, e ouça mais do que fala.',
          options: [{ label: '✉️ Estou indo', nextNodeId: null, action: 'STEP:hissui.ouvir' }],
        },
      } },
      { when: { active: 'hissui', notStep: 'hissui.acordo' }, tree: say('Conselheira Yuki', 'O Hissui está no posto, perto da fogueira. Boa sorte, Shinichi.') },
      { when: { active: 'hissui' }, tree: say('Conselheira Yuki', 'O Hissui foi para a Sede? Então corre! Não quero perder essa conversa... quer dizer, você não pode perder.') },
    ],
    offers: [
      { when: { notStarted: 'hissui', done: 'celeiro' }, tree: say('Conselheira Yuki', 'Uma carta do Mikage para o Hissui? Então chegou a hora. Topa levar?', [
        { label: '✉️ Topo', nextNodeId: null, action: 'START:hissui' },
        { label: 'Depois', nextNodeId: null },
      ]) },
    ],
    offerMeta: [{ mission: 'hissui', when: { done: 'celeiro' } }],
  },
  mochi: {
    active: [
      { when: { active: 'cesto', notStep: 'cesto.ouvir' }, tree: {
        start: {
          id: 'start', speaker: 'Vovó Mochi',
          text: 'Senta aqui, filhote. Nunca te contei direito como você chegou na vila, né?\nFoi numa manhã de tempestade. Eu fui ver o rio e vi um cesto descendo a correnteza, rodando.',
          options: [{ label: 'Um cesto?', nextNodeId: 'cesto' }],
        },
        cesto: {
          id: 'cesto', speaker: 'Vovó Mochi', mood: 'happy',
          text: 'Pesquei com a minha bengala! E dentro tinha um filhotinho molhado, bravo, miando para o céu. Era você.\nO cesto ainda está guardado no galpão do Mestre Kuma, embrulhado num pano. Vai ver?',
          options: [{ label: '🧺 Vou ver', nextNodeId: null, action: 'STEP:cesto.ouvir' }],
        },
      } },
      { when: { active: 'cesto', step: 'cesto.cesto', notStep: 'cesto.mochi' }, tree: {
        start: {
          id: 'start', speaker: 'Vovó Mochi',
          text: 'Achou a fita? Era a única coisa amarrada no cesto. Verde que nem jade.\nNinguém na vila tece daquele jeito. Fica com ela, filhote. É sua desde o primeiro dia.',
          options: [{ label: '🟢 Obrigado, vovó', nextNodeId: null, action: 'STEP:cesto.mochi' }],
        },
      } },
      { when: { active: 'cesto' }, tree: say('Vovó Mochi', 'O cesto está no galpão do Mestre Kuma, perto da cerca oeste.') },
    ],
    offers: [
      { when: { notStarted: 'cesto', done: 'posto' }, tree: say('Vovó Mochi', 'Shinichi, ouvi dizer que você foi até a outra margem do rio. Isso me lembrou uma história... a sua.', [
        { label: '🧺 Conta, vovó', nextNodeId: null, action: 'START:cesto' },
        { label: 'Depois', nextNodeId: null },
      ]) },
    ],
    offerMeta: [{ mission: 'cesto', when: { done: 'posto' } }],
  },
  lotus: {
    active: [
      { when: { active: 'tecnicas', notStep: 'tecnicas.ouvir' }, tree: {
        start: {
          id: 'start', speaker: 'Mestre Lótus',
          text: 'Você já se perguntou de onde vieram o Faro, o Miado e o Salto? Não fui eu que inventei. Infelizmente.\nOs primeiros ninjas gravaram cada técnica numa estela de pedra: uma no Bosque Antigo, uma no Bambuzal e uma no alto do Mirante.',
          options: [{ label: '🗿 Vou ler as três', nextNodeId: null, action: 'STEP:tecnicas.ouvir' }],
        },
      } },
      { when: { active: 'tecnicas', step: 'tecnicas.estelas', notStep: 'tecnicas.lotus' }, tree: {
        start: {
          id: 'start', speaker: 'Mestre Lótus', mood: 'happy',
          text: 'O Faro nasceu para achar quem se perdeu. O Miado, para chamar quem estava longe. O Salto, para alcançar a outra margem.\nPercebe? Nenhuma técnica foi criada para vencer alguém. Todas foram criadas para buscar alguém.',
          options: [{ label: '🐾 Para ninguém ficar para trás', nextNodeId: null, action: 'STEP:tecnicas.lotus' }],
        },
      } },
      { when: { active: 'tecnicas' }, tree: say('Mestre Lótus', 'Bosque Antigo, Bambuzal e o alto do Mirante. Uma estela em cada.') },
    ],
    offers: [
      { when: { notStarted: 'tecnicas', done: 'templo' }, tree: say('Mestre Lótus', 'Quem resolve os enigmas do templo merece saber de onde vêm as técnicas ninja. Quer ouvir?', [
        { label: '🗿 Quero', nextNodeId: null, action: 'START:tecnicas' },
        { label: 'Depois', nextNodeId: null },
      ]) },
    ],
    offerMeta: [{ mission: 'tecnicas', when: { done: 'templo' } }],
  },
};

// ── Objects ──────────────────────────────────────────────────────────────────

/** The three steles of the old techniques. */
export const STELES = [
  { id: 'estela_faro', name: 'Estela do Faro', at: [ANCIENT.x - 6.2, 0, ANCIENT.z - 1.0] as Vec3,
    text: '"FARO. Quando a primeira filhote se perdeu na mata, a mãe fechou os olhos e seguiu o cheiro do leite de arroz até ela. Respire. Feche os olhos. Siga."' },
  { id: 'estela_miado', name: 'Estela do Miado', at: [CLEARING.x - 2.6, 0, CLEARING.z - 2.6] as Vec3,
    text: '"MIADO. Na noite sem lua, um velho chamou os netos de margem a margem. O som atravessou o rio onde a voz comum se afogava. Chame alto. Chame com o coração."' },
  // on the terrace's free corner, clear of the tree, the spyglass and Kuro (measured, Etapa 10)
  { id: 'estela_salto', name: 'Estela do Salto', at: [MIRANTE.x0 + 1.0, MIRANTE.h, MIRANTE.z1 - 0.6] as Vec3,
    text: '"SALTO. Quando a ponte caiu, os mais leves pularam de pedra em pedra levando cordas para o outro lado. Pule para alcançar, não para fugir."' },
];

export const STORY_OBJECTS: WorldObject[] = [
  {
    id: 'registro_cheia', kind: 'examine', position: sede(7.0, -2.7), label: 'Ler o registro da Grande Cheia', name: 'Registro da Grande Cheia', radius: 1.3,
    when: { step: 'conselho.ouvir' },
    dialogue: say('Registro da Grande Cheia',
      '"Noite da Grande Cheia. A ponte velha caiu às duas badaladas. Desta margem, todos salvos.\nDa outra margem, as famílias do junco perderam as casas. Os fundadores decidem: o Celeiro do Sol, embaixo do templo, guardará peixe e sementes para elas, até que a ponte nova as alcance."\nNa margem da página, outra letra: "a ponte nova ficou para o ano seguinte". Não tem ano seguinte escrito.',
      [{ label: '📖 Entendi', nextNodeId: null }], 'STEP:conselho.registro'),
  },
  {
    // in the sanctuary, in front of the altar: the sun on the wall behind it takes the disc (Etapa 10: beside the
    // shrine it stood 1.3 m from the fraction door's lever). The sanctuary is open by then (chapter 4 is done).
    id: 'pedestal_sol', kind: 'examine', position: [SHRINE[0], 0, SHRINE[2] + 0.5], label: 'Encaixar o Disco Solar', name: 'Pedestal do Sol', radius: 1.4,
    when: { step: 'celeiro.ouvir', notFlag: 'celeiro_aberto' },
    usableWhen: { item: { id: 'disco_solar' } },
    dialogue: say('Pedestal do Sol',
      'O disco encaixa com um clique. O sol gravado esquenta e brilha...\nNo chão do santuário, uma pedra redonda gira e afunda, revelando uma escada. Lá embaixo, o Celeiro do Sol.',
      [{ label: '🌞 Descer', nextNodeId: null }], 'FLAG:celeiro_aberto;STEP:celeiro.encaixar;SFX:mechanism'),
  },
  {
    id: 'inscricao_celeiro', kind: 'examine', position: [SHRINE[0] - 4.6, 0, SHRINE[2] + 1.2], label: 'Olhar o Celeiro do Sol', name: 'Celeiro do Sol', radius: 1.5,
    when: { flag: 'celeiro_aberto' },
    dialogue: say('Celeiro do Sol',
      'Cestos de peixe seco empilhados até o teto, potes de sementes lacrados, tudo seco e conservado.\nNa parede, entalhado: "PARA QUEM A CHEIA DEIXOU PARA TRÁS."',
      [{ label: '...', nextNodeId: null }], 'STEP:celeiro.ler'),
  },
  {
    id: 'cesto_antigo', kind: 'examine', position: [SHED_AT[0] + 1.2, 0, SHED_AT[2] + 2.2], label: 'Abrir o pano do cesto', name: 'Cesto Antigo', radius: 1.4,
    when: { step: 'cesto.ouvir', notStep: 'cesto.cesto' },
    dialogue: say('Cesto Antigo',
      'Um cesto de junco trançado, pequeno, com marcas de água até a metade.\nNa alça, uma fita verde-jade, amarrada com um nó que você nunca viu na vila.',
      [{ label: '🟢 Pegar a fita', nextNodeId: null }], 'STEP:cesto.cesto;GIVE:fita_jade'),
  },
  ...STELES.map((s): WorldObject => ({
    id: s.id, kind: 'examine', position: s.at, label: `Ler a ${s.name}`, name: s.name, radius: 1.5,
    hideWhen: { step: 'tecnicas.ouvir', notFlag: `lida_${s.id}` },
    dialogue: say(s.name, s.text, [{ label: '🗿 ...', nextNodeId: null }]),
  })),
  // reading a stele during the mission counts it (one object per stele, shown only until read)
  ...STELES.map((s): WorldObject => ({
    id: `${s.id}_missao`, kind: 'examine', position: s.at, label: `Ler a ${s.name}`, name: s.name, radius: 1.5,
    when: { step: 'tecnicas.ouvir', notFlag: `lida_${s.id}` },
    dialogue: say(s.name, s.text, [{ label: '🗿 Guardar na memória', nextNodeId: null }], `FLAG:lida_${s.id};COUNT:estelas_lidas`),
  })),
];

// ── Missions ─────────────────────────────────────────────────────────────────

export const STORY_MISSIONS: Mission[] = [
  {
    id: 'conselho', chapter: 7, title: 'A Outra Margem', category: 'principal', giver: 'mikage',
    description: 'As ordens do Hissui nas patas do Mikage. Quem é esse general, e por que ele quer o Disco Solar?',
    steps: [
      { id: 'ouvir', description: 'Mostre as ordens ao Mikage (Sede)', target: { npc: 'mikage' } },
      { id: 'registro', description: 'Leia o registro da Grande Cheia na biblioteca da Sede', target: { object: 'registro_cheia' } },
      { id: 'mikage', description: 'Conte ao Mikage o que leu', target: { npc: 'mikage' } },
    ],
    rewards: { xp: 80, coins: 20, gems: 2 },
    lesson: 'Toda história tem dois lados. Quem parece vilão de um lado do rio pode ser quem foi esquecido do outro.',
  },
  {
    id: 'celeiro', chapter: 7, title: 'O Celeiro do Sol', category: 'investigação', giver: 'tsubaki',
    description: 'Embaixo do santuário do Templo dos Enigmas existe uma porta que só o Disco Solar abre.',
    steps: [
      { id: 'ouvir', description: 'Fale com a Tsubaki', target: { npc: 'tsubaki' } },
      { id: 'encaixar', description: 'Encaixe o Disco Solar no pedestal do santuário', target: { object: 'pedestal_sol' } },
      { id: 'ler', description: 'Veja o que o celeiro guarda', target: { object: 'inscricao_celeiro' } },
      { id: 'mikage', description: 'Conte ao Mikage', target: { npc: 'mikage' } },
    ],
    rewards: { xp: 90, coins: 25, gems: 3 },
    lesson: 'Promessas guardadas não alimentam ninguém. Só valem quando são cumpridas.',
  },
  {
    id: 'hissui', chapter: 7, title: 'O Pacto das Duas Margens', category: 'principal', giver: 'yuki_campo',
    description: 'Leve a carta do Mikage ao General Hissui, no posto das terras selvagens. Ele não vai facilitar.',
    steps: [
      { id: 'ouvir', description: 'Fale com a Yuki no acampamento', target: { npc: 'yuki_campo' } },
      { id: 'encontrar', description: 'Entregue a carta ao Hissui, no posto do desfiladeiro', target: { npc: 'hissui' } },
      { id: 'duelo1', description: 'Duelo de Enigmas: primeiro enigma', target: { npc: 'hissui' } },
      { id: 'duelo2', description: 'Duelo de Enigmas: segundo enigma', target: { npc: 'hissui' } },
      { id: 'duelo3', description: 'Duelo de Enigmas: último enigma', target: { npc: 'hissui' } },
      { id: 'acordo', description: 'Ouça o que o Hissui decidiu', target: { npc: 'hissui' } },
      { id: 'pacto', description: 'Encontre o Hissui e o Mikage no Salão de Audiências', target: { npc: 'mikage' } },
    ],
    rewards: { xp: 200, coins: 60, gems: 6, badges: ['Guardião do Pacto'] },
    lesson: 'Resolver um conflito não é vencer o outro: é encontrar uma divisão justa em que ninguém fica para trás.',
    onComplete: 'FLAG:hissui_aliado;SFX:fireworks',
  },
  {
    id: 'cesto', chapter: 7, title: 'O Cesto da Correnteza', category: 'secundária', giver: 'mochi',
    description: 'A Vovó Mochi tem uma história para contar: a de como o Shinichi chegou à vila.',
    steps: [
      { id: 'ouvir', description: 'Ouça a Vovó Mochi', target: { npc: 'mochi' } },
      { id: 'cesto', description: 'Procure o cesto no galpão do Mestre Kuma (cerca oeste)', target: { object: 'cesto_antigo' } },
      { id: 'mochi', description: 'Volte à Vovó Mochi', target: { npc: 'mochi' } },
    ],
    rewards: { xp: 60, coins: 10, gems: 2 },
    lesson: 'Saber de onde a gente veio não muda quem a gente é. Mas ajuda a entender por que algumas coisas nos tocam tanto.',
  },
  {
    id: 'tecnicas', chapter: 7, title: 'As Técnicas Antigas', category: 'exploração', giver: 'lotus',
    description: 'O Faro, o Miado e o Salto foram gravados em pedra pelos primeiros ninjas. Três estelas pela vila contam como nasceram.',
    steps: [
      { id: 'ouvir', description: 'Ouça o Mestre Lótus', target: { npc: 'lotus' } },
      { id: 'estelas', description: 'Leia as três estelas (Bosque Antigo, Bambuzal e alto do Mirante)', counter: { id: 'estelas_lidas', goal: 3 }, target: { object: 'estela_faro_missao' } },
      { id: 'lotus', description: 'Conte ao Mestre Lótus o que as estelas dizem', target: { npc: 'lotus' } },
    ],
    rewards: { xp: 70, coins: 15, gems: 3, badges: ['Historiador das Patas'] },
    lesson: 'Toda técnica nasceu de uma necessidade. Saber o porquê ajuda a usar melhor o como.',
  },
];

// ── What the villagers say as the story moves on ─────────────────────────────

/** First matching reaction wins; the villager's usual barks otherwise (game/entities/NPC.tsx). */
export const STORY_REACTIONS: Record<string, { when: Condition; barks: string[] }[]> = {
  chef_tofu: [
    { when: { done: 'hissui' }, barks: ['Seis peixes por família! Vou fazer o maior ensopado da história da vila.', 'Um general na minha cantina? Ele pediu sopa sem espinha. Respeito.'] },
    { when: { done: 'trilha' }, barks: ['Terras selvagens? Traga cogumelos. NÃO os brilhantes.', 'A expedição levou meus melhores peixes secos. Espero que valha a pena!'] },
  ],
  kenzo: [
    { when: { done: 'hissui' }, barks: ['Seis peixes vezes oito famílias: quarenta e oito. Conferi. Duas vezes.'] },
    { when: { done: 'explorador' }, barks: ['Um cartógrafo pendurado numa árvore? Eu teria contado as folhas enquanto esperava.'] },
  ],
  mochi: [
    { when: { done: 'cesto' }, barks: ['Essa fita fica linda em você, filhote.', 'Pesquei você com a bengala. Melhor pescaria da minha vida.'] },
  ],
  taro: [
    { when: { done: 'hissui' }, barks: ['Você fez as pazes com um GENERAL? Eu ainda não fiz com o Kuro.', 'Me ensina esse tal de duelo de enigmas? Eu sou ótimo em duelo. De bola.'] },
    { when: { done: 'posto' }, barks: ['É verdade que você passou por um javali dormindo? Eu teria acordado ele. Sem querer.'] },
  ],
  kiko: [
    { when: { done: 'ruinas' }, barks: ['Um disco que abre portas sozinho? Preciso desmontar. Só um pouquinho.'] },
  ],
  lotus: [
    { when: { done: 'tecnicas' }, barks: ['Faro para achar, Miado para chamar, Salto para alcançar.', 'Os primeiros ninjas eram buscadores, não lutadores.'] },
    { when: { done: 'posto' }, barks: ['Passar sem ser visto também é técnica ninja. A mais difícil.'] },
  ],
  mestre_kuma: [
    { when: { done: 'cesto' }, barks: ['Aquele cesto ficou no meu galpão por anos. Eu sabia que era importante. Só não sabia por quê.'] },
    { when: { done: 'hissui' }, barks: ['A ponte nova vai ser de pedra. Desta vez, ninguém espera o ano seguinte.'] },
  ],
  sumi: [
    { when: { done: 'hissui' }, barks: ['Um aluno da Academia resolveu uma guerra com frações. Vou pendurar isso na parede.'] },
  ],
  tsubaki: [
    { when: { done: 'celeiro' }, barks: ['Cem anos de poeira e nenhum peixe estragou. Os fundadores sabiam guardar.'] },
  ],
  fumi: [
    { when: { done: 'conselho' }, barks: ['Aquele registro estava na estante do canto há trinta anos. Ninguém pediu emprestado. Até você.'] },
  ],
  mikage: [
    { when: { done: 'hissui' }, barks: ['Trinta e um invernos. Que bom que não foram trinta e dois.', 'O Hissui ainda rouba o meu chá. Igualzinho.'] },
  ],
  yuki_campo: [
    { when: { done: 'hissui' }, barks: ['Com as raposas do Hissui de batedoras, o mapa do Bento ficou pronto em dois dias.'] },
  ],
  bento: [
    { when: { done: 'hissui' }, barks: ['Desenhei o Hissui no mapa. Ele reclamou do bigode. Era o bigode certo!'] },
  ],
  momo: [
    { when: { done: 'hissui' }, barks: ['Os ouriços agora me trazem ervas. Com os espinhos para baixo. Educados.'] },
  ],
  toshi: [
    { when: { done: 'hissui' }, barks: ['Deixei um general passar pelo portão. Com convite. Ainda estou nervoso.'] },
  ],
};

// ── The story so far (Jornada panel, once a chapter is complete) ─────────────

export const CHAPTER_RECAPS: Record<number, string> = {
  1: 'Os 48 peixes da cantina sumiram. O Faro achou o Tanuki, que tinha 6 filhotes e a despensa vazia; em vez de castigo, a vila ajudou. Um gato de cachecol vermelho, o Kuro, apareceu na floresta.',
  2: 'O festival das lanternas apagou de uma vez: foi o Kuro, triste porque a vila tinha esquecido o mestre Hoshi. A Lanterna da Memória, acesa na fonte da praça, transformou o rival em amigo.',
  3: 'Banquetes, chás, máquinas e uma balança antiga: a vila descobriu que contas e lógica também são técnicas ninja.',
  4: 'Três enigmas abriram o santuário do Templo, guardado havia anos. "Quem observa, encontra a regra."',
  5: 'O Shinichi se formou na Academia, conheceu o Mikage e o Pacto das Patas, nascido na noite da Grande Cheia. A Yuki planejou uma expedição.',
  6: 'Nas terras selvagens, o Shinichi resgatou o Bento, achou o Disco Solar nas ruínas e leu as ordens do General Hissui: ele queria o disco antes da vila.',
  7: 'O Hissui vinha da outra margem, a que ficou para trás na cheia. O Disco abriu o Celeiro do Sol, feito para ela. Um duelo de enigmas e um pacto depois, as duas margens viraram uma vila só.',
};

/** Shown in the Jornada panel after the last chapter is complete. */
export const STORY_EPILOGUE = 'Fim da primeira temporada. A ponte nova está sendo construída, de pedra, pelas duas margens. Novas aventuras: em breve.';

// ── The intro (new game) ─────────────────────────────────────────────────────

export const INTRO_PANELS: { scene: string; title: string; text: string }[] = [
  { scene: '🏯🌸🌊', title: 'A Vila das Patas', text: 'À beira de um rio largo, entre cerejeiras e pontes vermelhas, vivem gatos ninjas, tanukis, coelhos e um ou outro cachorro muito educado.' },
  { scene: '🌧️🌊🌉', title: 'A Grande Cheia', text: 'Muitos anos atrás, numa noite de chuva, o rio subiu e levou casas e pontes. Os moradores juntaram as patas e escreveram um pacto: "Ninguém fica para trás."' },
  { scene: '🧺🐾🟢', title: 'Um cesto no rio', text: 'Numa manhã de tempestade, a Vovó Mochi viu um cesto descendo a correnteza. Dentro, um filhote molhado e bravo, com uma fita verde amarrada na alça.' },
  { scene: '🐱🥷✨', title: 'Shinichi', text: 'Esse filhote cresceu. Hoje é o Shinichi, aprendiz de ninja, com o nariz mais esperto da vila. E hoje de manhã... os peixes da cantina SUMIRAM.' },
];
