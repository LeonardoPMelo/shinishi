import type { NPCDefinition, DialogueTree, DialogueOption, DialogueRoute, Condition } from '../types';
import { checkCondition } from '../systems/progression';
import type { Progress } from '../types';
import { EXTENSIONS, NEW_NPCS } from './npcs2';
import { FUJI } from './east';
import { GORO } from './west';
import { HINOKI } from './south';
import { LUNA_FOREST, APPLES } from './redesign';
import { CHAPTER3_ROUTES } from './chapter3';
import { MIMI } from './interiors';

// ── Helpers ─────────────────────────────────────────────────────────────────
const bye = (label = 'Até mais!'): DialogueOption => ({ label, nextNodeId: null });

/** One-node conversation. */
function say(speaker: string, text: string, options: DialogueOption[] = [bye()], onEnter?: string): DialogueTree {
  return { start: { id: 'start', speaker, text, options, onEnter } };
}

/** Picks a random line each time it is opened — keeps idle chatter fresh. */
function chatter(speaker: string, lines: string[]): DialogueTree {
  return say(speaker, lines[Math.floor(Math.random() * lines.length)]);
}

const lazy = (when: Condition | undefined, make: () => DialogueTree): DialogueRoute & { make: () => DialogueTree } =>
  ({ when, tree: {}, make });

const PEIXES_DONE: Condition = { done: 'peixes' };

// ── Chef Hana ───────────────────────────────────────────────────────────────
const tofuIntro: DialogueTree = {
  start: {
    id: 'start', speaker: 'Chef Hana', mood: 'surprised',
    text: '🍱 Shinichi! Que bom que você apareceu! Estou em pânico total!',
    options: [
      { label: 'O que aconteceu?', nextNodeId: 'explain' },
      { label: 'Que cheiro bom...', nextNodeId: 'smell' },
    ],
  },
  smell: {
    id: 'smell', speaker: 'Chef Hana',
    text: '*(suspiro)* É incenso de lavanda. Uso para me acalmar nas crises.\nE hoje é DEFINITIVAMENTE uma crise!',
    options: [{ label: 'Entendo. O que aconteceu?', nextNodeId: 'explain' }],
  },
  explain: {
    id: 'explain', speaker: 'Chef Hana',
    text: 'Os 48 peixes da cantina desapareceram! Eu ia servir 8 famílias no jantar.\n\nVocê investiga isso pra mim?',
    options: [
      { label: 'Claro! Conto com meu faro de detetive ninja!', nextNodeId: 'accept', action: 'START:peixes;STEP:peixes.talk_tofu' },
      { label: 'Hm... deixa eu pensar...', nextNodeId: 'think' },
    ],
  },
  think: {
    id: 'think', speaker: 'Shinichi',
    text: '*(pensa por 0,3 segundos)*\n\nOk, pensei bastante. Aceito o desafio!',
    options: [{ label: '(aceitar missão)', nextNodeId: 'accept', action: 'START:peixes;STEP:peixes.talk_tofu' }],
  },
  accept: {
    id: 'accept', speaker: 'Chef Hana',
    text: 'Ótimo! O Boku estava no mercado ontem, e a Luna fica perto da fonte.\nOs caixotes vazios ainda estão no estoque, ao lado da cantina. Investigue tudo e volte aqui.\nBoa sorte, Detetive Ninja! 🐟',
    options: [bye('Entendido!')],
  },
};

const tofuFinal = (understood: boolean): DialogueTree => ({
  start: {
    id: 'start', speaker: 'Chef Hana', mood: 'happy',
    text: understood
      ? 'O Tanuki veio aqui, devolveu os peixes e me contou dos 6 filhotes.\nEu não fazia ideia! Ele vai me ajudar na cantina e a vila vai\nmontar uma despensa de inverno para todos. Você resolveu com sabedoria! 🎉'
      : 'O Tanuki devolveu os peixes e pediu desculpas. Estava bem envergonhado.\nVocê foi firme — e justo. A cantina está salva! 🎉',
    options: [{ label: 'Foi trabalho em equipe!', nextNodeId: null, action: 'STEP:peixes.report_tofu' }],
  },
});

const tofuReceitaIntro: DialogueTree = {
  start: {
    id: 'start', speaker: 'Chef Hana', mood: 'surprised',
    text: 'SHINICHI! Aconteceu de novo! A receita do Bolinho Supremo SUMIU!\nAlguém roubou! Ou... eu deixei na janela aberta com vento. Mas provavelmente roubou!',
    options: [
      { label: 'Vou investigar (de novo).', nextNodeId: 'go', action: 'START:receita' },
      { label: 'Agora não, Chef.', nextNodeId: null },
    ],
  },
  go: {
    id: 'go', speaker: 'Chef Hana',
    text: 'O Boku passa o dia olhando o céu esperando clientes. Pergunte a ele!',
    options: [bye('Deixa comigo!')],
  },
};

const tofuReceitaOrdem: DialogueTree = {
  start: {
    id: 'start', speaker: 'Chef Hana', mood: 'happy',
    text: 'MINHA RECEITA! Estava numa cerejeira?! ...Ah. A janela.\n\nOh não, molhou e os passos ficaram embaralhados. Me ajuda a ordenar?',
    options: [
      { label: '📜 Ordenar a receita', nextNodeId: null, action: 'CHALLENGE:receita_ordem' },
      { label: 'Daqui a pouco.', nextNodeId: null },
    ],
  },
};

const tofuDesculpas: DialogueTree = {
  start: {
    id: 'start', speaker: 'Taro',
    text: '*(empurrado pra frente)* ...Chef. Fui eu que fiz chover peixe.\nEu queria mostrar que sou o melhor ninja. Desculpa pela bagunça.',
    options: [{ label: '(olhar para a Chef)', nextNodeId: 'tofu' }],
  },
  tofu: {
    id: 'tofu', speaker: 'Chef Hana', mood: 'happy',
    text: 'Peixes organizados em 4 cestos? E um pedido de desculpas?\nTaro, isso foi mais corajoso que qualquer jutsu. Amanhã você me ajuda a limpá-los!',
    options: [{ label: '😹 Final feliz (e cheiroso)', nextNodeId: null, action: 'STEP:chuva_peixes.desculpas' }],
  },
};

const chefTofu: NPCDefinition = {
  id: 'chef_tofu',
  name: 'Chef Hana',
  role: 'Cozinheira da Cantina',
  position: [-5, 0, -4],
  look: { species: 'cat', fur: '#F3D9B5', belly: '#FFF6EA', scale: 1.05, wide: 1.2, accessory: 'chef' },
  voice: 'meow_low',
  offers: [{ mission: 'peixes' }, { mission: 'receita', when: PEIXES_DONE }],
  barks: ['Bolinho quentinho! ...Ainda não, mas logo!', 'Quem mexeu no meu wok?!', 'Peixe fresco é peixe feliz!'],
  routes: [
    { when: { active: 'chuva_peixes', step: 'chuva_peixes.cestos' }, tree: tofuDesculpas },
    { when: { active: 'receita', step: 'receita.arvore' }, tree: tofuReceitaOrdem },
    { when: { active: 'receita' }, tree: say('Chef Hana', 'Alguma pista da receita? O Boku vê tudo que voa por aí!') },
    { when: { active: 'peixes', step: 'peixes.confront_tanuki', flag: 'tanuki_compreendido' }, tree: tofuFinal(true) },
    { when: { active: 'peixes', step: 'peixes.confront_tanuki' }, tree: tofuFinal(false) },
    { when: { active: 'peixes', step: 'peixes.solve_math' }, tree: say('Chef Hana', 'Quem levaria a comida de 8 famílias? A cauda listrada que a Luna viu...\nO Tanuki mora perto da cabana de palha, depois das árvores grandes.') },
    {
      when: { active: 'peixes', step: ['peixes.talk_kenzo', 'peixes.talk_mei', 'peixes.estoque'] },
      tree: say('Chef Hana', 'Você ouviu o Boku e a Luna, e contou os caixotes! Então sabe: 48 peixes para 8 famílias.\nQuanto cada família deveria receber? Se a gente souber, entende o tamanho do sumiço!', [
        { label: '🧮 Resolver o enigma', nextNodeId: null, action: 'CHALLENGE:peixes_divisao' },
        bye('Preciso pensar mais...'),
      ]),
    },
    { when: { active: 'peixes', step: 'peixes.talk_tofu' }, tree: say('Chef Hana', 'Já ouviu o Boku (mercado) e a Luna (fonte)? E olhou os caixotes do estoque?\nAs pistas juntas contam a história!') },
    { when: { notStarted: 'peixes' }, tree: tofuIntro },
    { when: { done: 'peixes', notStarted: 'receita' }, tree: tofuReceitaIntro },
    { when: { flag: 'tanuki_compreendido' }, tree: say('Chef Hana', 'O Tanuki agora lava pratos aqui! Ele é ótimo em esconder... quer dizer, GUARDAR coisas.') },
  ],
};
(chefTofu.routes as DialogueRoute[]).push(lazy(undefined, () => chatter('Chef Hana', [
  'A cantina está aberta! Hoje temos sopa de missô com... surpresa.',
  'Sabia que eu já cozinhei para o Mestre Kuma? Ele disse "hm". Melhor elogio da vida.',
  'Shhh. Estou ouvindo o arroz. Ele me diz quando está pronto.',
])));

// ── Boku ───────────────────────────────────────────────────────────────────
const kenzoPeixes: DialogueTree = {
  start: {
    id: 'start', speaker: 'Boku',
    text: 'Os peixes? Eu estava no mercado ontem à tarde e vi a Chef contar: exatamente 48!\nEla disse que eram pra 8 famílias.',
    options: [{ label: 'Isso é uma pista!', nextNodeId: 'hint', action: 'STEP:peixes.talk_kenzo' }],
  },
  hint: {
    id: 'hint', speaker: 'Boku',
    text: 'E tem mais: às 22h ouvi um barulho perto do estoque... um tamborilar de dedos.\nAnoto tudo no meu caderninho. Organização é tudo!',
    options: [bye('Valeu, Boku!')],
  },
};

const kenzoContasOffer: DialogueTree = {
  start: {
    id: 'start', speaker: 'Boku',
    text: 'Shinichi, preciso confessar uma coisa: sou organizado, pontual... e PÉSSIMO com contas.\nA Dona Neko está esperando. Me ajuda no caixa?',
    options: [
      { label: '🧮 Ajudar no caixa', nextNodeId: null, action: 'START:contas;CHALLENGE:kenzo_preco' },
      { label: 'Agora não dá.', nextNodeId: null },
    ],
  },
};

const kenzo: NPCDefinition = {
  id: 'kenzo',
  name: 'Boku',
  role: 'Comerciante',
  position: [7, 0, -2],
  look: { species: 'cat', fur: '#8A5E3C', belly: '#E8D3B4', scale: 1.05, wide: 1.25, stripes: '#6E472C', accessory: 'happi' },
  voice: 'meow_low',
  offers: [{ mission: 'contas', when: PEIXES_DONE }],
  barks: ['Maçãs fresquinhas! Organizadas por cor!', 'Promoção: leve 3, pague... deixa eu calcular...', 'Peixe? Só na cantina!'],
  routes: [
    { when: { active: 'receita', notStep: 'receita.kenzo' }, tree: say('Boku', 'Um papel voando? SIM! Ontem, com o vento, um pergaminho passou girando\ne ficou preso na cerejeira grande perto do templo. Anotei no caderninho!', [
      { label: 'Obrigado, Boku!', nextNodeId: null, action: 'STEP:receita.kenzo' },
    ]) },
    { when: { active: 'peixes', step: 'peixes.talk_tofu', notStep: 'peixes.talk_kenzo' }, tree: kenzoPeixes },
    { when: { active: 'contas', notStep: 'contas.preco' }, tree: say('Boku', 'A Dona Neko encomendou maçãs e eu preciso do preço antes de embrulhar!', [
      { label: '🧮 Calcular o preço', nextNodeId: null, action: 'CHALLENGE:kenzo_preco' }, bye('Já volto'),
    ]) },
    { when: { active: 'contas', step: 'contas.preco', notStep: 'contas.entregar', item: { id: 'sacola_macas' } }, tree: say('Boku',
      'A sacola já está com você! A Dona Neko mora lá no oeste, perto do galpão velho.\nEla cochila muito, então chame com jeitinho.', [bye('Estou indo!')]) },
    { when: { active: 'contas', step: 'contas.preco', notStep: 'contas.entregar' }, tree: say('Boku',
      `${APPLES.count * APPLES.price} moedas, perfeito! Embrulhei as maçãs.\nVocê leva para a Dona Neko? Ela mora perto do galpão velho, no oeste. Eu não posso largar a barraca!`, [
      { label: '🍎 Levo sim!', nextNodeId: null, action: 'GIVE:sacola_macas' }, bye('Daqui a pouco'),
    ]) },
    { when: { active: 'contas', step: 'contas.entregar', notStep: 'contas.troco' }, tree: say('Boku', `Ela pagou com uma nota de ${APPLES.paid}? Ótimo! As maçãs custaram ${APPLES.count * APPLES.price}... quanto eu devolvo?`, [
      { label: '🧮 Calcular o troco', nextNodeId: null, action: 'CHALLENGE:kenzo_troco' }, bye('Já volto'),
    ]) },
    { when: { active: 'contas', step: 'contas.troco' }, tree: say('Boku', 'Socorro! O Seu Bigodes quer aproveitar a promoção do quadro e eu já me perdi nas contas.\nO quadro fica aqui do lado da barraca.', [bye('Vou olhar o quadro')]) },
    { when: { done: 'peixes', notStarted: 'contas' }, tree: kenzoContasOffer },
  ],
};
(kenzo.routes as DialogueRoute[]).push(lazy(undefined, () => chatter('Boku', [
  'Sou o Boku, o mais organizado da vila. Meus nabos estão em ordem alfabética.',
  'Cheguei 2 minutos adiantado hoje. Recorde pessoal!',
  'Já percebeu que gatos adoram caixas? Eu vendo caixas. Sucesso garantido.',
])));

// ── Luna ─────────────────────────────────────────────────────────────────────
const meiPeixes: DialogueTree = {
  start: {
    id: 'start', speaker: 'Luna',
    text: '*(sussurra)* Oi... Ontem perto das 22h vi uma sombra saindo do estoque\ncarregando um cesto enorme. A sombra tinha... uma cauda listrada!',
    options: [{ label: 'Cauda listrada? Isso é uma pista!', nextNodeId: 'conclude', action: 'STEP:peixes.talk_mei' }],
  },
  conclude: {
    id: 'conclude', speaker: 'Luna',
    text: 'Fiquei com medo de contar... Mas antes de acusar alguém,\ntalvez valha a pena entender o porquê, né?',
    options: [bye('Você tem razão, Luna. Obrigado!')],
  },
};

const meiCoragem = (start: boolean): DialogueTree => ({
  start: {
    id: 'start', speaker: 'Luna', onEnter: start ? 'START:mei_coragem' : undefined,
    text: 'O Mestre Lótus abriu treinos para aprendizes na floresta... eu queria ir.\nMas e se eu errar na frente de todo mundo? E se o Taro rir de mim?',
    options: [
      { label: '"Ah, é fácil! É só ir lá e fazer."', nextNodeId: 'facil' },
      { label: '"Do que você tem mais medo?"', nextNodeId: 'medo' },
      { label: '"Ninjas de verdade não sentem medo."', nextNodeId: 'semmedo' },
    ],
  },
  facil: {
    id: 'facil', speaker: 'Luna', mood: 'sad',
    text: 'Fácil pra você... você é o Detetive Ninja. *(olha para o chão)*',
    options: [{ label: '"Desculpa. Me conta: do que você tem mais medo?"', nextNodeId: 'medo' }],
  },
  semmedo: {
    id: 'semmedo', speaker: 'Luna', mood: 'sad', onEnter: 'FLAG:mei_magoada',
    text: 'Então... eu não sou uma ninja de verdade? *(abaixa as orelhas)*',
    options: [{ label: '"Espera, falei besteira. Me conta do seu medo?"', nextNodeId: 'medo' }],
  },
  medo: {
    id: 'medo', speaker: 'Luna',
    text: 'De errar. Quando eu erro, parece que todo mundo está olhando e rindo...',
    options: [
      { label: '"Eu caí no rio três vezes semana passada. Três!"', nextNodeId: 'humor' },
      { label: '"O Mestre Lótus diz que errar é praticar."', nextNodeId: 'pratica' },
    ],
  },
  humor: {
    id: 'humor', speaker: 'Luna', mood: 'happy',
    text: '*(ri baixinho)* Três vezes? ...Tá bom, isso me ajudou um pouquinho.',
    options: [{ label: '"Quer ir comigo?"', nextNodeId: 'decide' }],
  },
  pratica: {
    id: 'pratica', speaker: 'Luna',
    text: 'Errar é... praticar? Então quanto mais eu erro, mais eu pratico? Hmm.',
    options: [{ label: '"Exato! E eu vou junto."', nextNodeId: 'decide' }],
  },
  decide: {
    id: 'decide', speaker: 'Luna', mood: 'happy',
    text: 'Se você for comigo até a floresta... acho que consigo tentar.',
    options: [{ label: 'Combinado! Te encontro lá depois da ponte.', nextNodeId: null, action: 'STEP:mei_coragem.conversar;FLAG:mei_na_floresta' }],
  },
});

const mei: NPCDefinition = {
  id: 'mei',
  name: 'Luna',
  role: 'Curandeira tímida',
  position: [2, 0, 8],
  look: { species: 'cat', fur: '#FBF7F2', belly: '#FFFFFF', scale: 0.92, mask: '#E9A15A', accessory: 'scarf' },
  voice: 'meow_high',
  visibleWhen: { notFlag: 'mei_na_floresta' },
  offers: [{ mission: 'mei_coragem', when: PEIXES_DONE }],
  barks: ['*(acena tímida)*', 'A fonte faz um barulhinho bom...'],
  routes: [
    { when: { active: 'peixes', step: 'peixes.talk_tofu', notStep: 'peixes.talk_mei' }, tree: meiPeixes },
    { when: { active: 'mei_coragem' }, tree: meiCoragem(false) },
    { when: { done: 'peixes', notStarted: 'mei_coragem' }, tree: meiCoragem(true) },
    { when: { active: 'peixes' }, tree: say('Luna', 'Você já resolveu o enigma dos peixes? Torço por você! 🌸') },
    { tree: say('Luna', '*(sussurra)* Oi... Eu fico perto da fonte porque é quieto e dá pra pensar.') },
  ],
};

const meiFloresta: NPCDefinition = {
  id: 'mei_floresta',
  name: 'Luna',
  role: 'Curandeira em treino',
  // at the foot of the first stone pillar (the pillars are her challenge in mei_coragem)
  position: LUNA_FOREST,
  faceRotation: -Math.PI * 0.7,
  look: mei.look,
  voice: 'meow_high',
  visibleWhen: { flag: 'mei_na_floresta' },
  barks: ['Mais uma argola... respira...', 'Errei! Ou seja: pratiquei!'],
  routes: [
    // 4) after the bell: she climbs too, and gives the ribbon (the hurt line if the player was unkind before)
    { when: { active: 'mei_coragem', step: 'mei_coragem.pilares', flag: 'mei_magoada' }, tree: say('Luna',
      '*(sobe pilar por pilar, devagar... e chega lá em cima!)*\nSabe... aquilo de "ninjas não sentem medo" doeu um pouco. Mas você voltou, me escutou e me mostrou o caminho.\nIsso foi coragem também. Toma, é minha fita da sorte.', [
      { label: '🎀 Obrigado, Luna', nextNodeId: null, action: 'STEP:mei_coragem.voltar' },
    ]) },
    { when: { active: 'mei_coragem', step: 'mei_coragem.pilares' }, tree: say('Luna',
      '*(sobe o primeiro... o segundo... escorrega no terceiro, ri, tenta de novo... e chega no topo!)*\nEu consegui! Errei uma vez. Ou seja: pratiquei uma vez!\nToma, é minha fita da sorte. Você merece.', [
      { label: '🎀 Obrigado, Luna', nextNodeId: null, action: 'STEP:mei_coragem.voltar' },
    ]) },
    // 3) pattern understood: now show her it can be done
    { when: { active: 'mei_coragem', step: 'mei_coragem.medir' }, tree: say('Luna',
      'Sempre o mesmo pulo... tá. Mas você vai primeiro? Se eu te ver subindo, acho que consigo.\nTem um sino lá no pilar mais alto. Toca ele quando chegar!', [bye('Olha só!')]) },
    // 2) at the pillars: she is stuck looking at how tall they get
    { when: { active: 'mei_coragem', step: 'mei_coragem.floresta' }, tree: say('Luna',
      'Olha esses pilares... cada um maior que o outro. O último parece uma montanha!\nComo alguém pula até lá?', [
      { label: '🧮 Vamos medir quanto cada um sobe', nextNodeId: null, action: 'CHALLENGE:luna_pilares' }, bye('Já volto'),
    ]) },
    { when: { active: 'mei_coragem' }, tree: say('Luna', 'Você veio! *(aponta para os pilares de pedra)* É aqui que o Mestre Lótus treina os aprendizes.\nEu fico olhando... mas não subo.', [
      { label: '"Vamos olhar juntos?"', nextNodeId: null, action: 'STEP:mei_coragem.floresta' },
    ]) },
    { tree: say('Luna', 'Hoje o Taro errou uma argola e EU acertei. Não ri dele. Mas sorri por dentro. 🌸') },
  ],
};

// ── Tanuki ──────────────────────────────────────────────────────────────────
const tanukiConfissao: DialogueTree = {
  start: {
    id: 'start', speaker: 'Tanuki',
    text: '*(suspiro)* Eu sabia que você viria. Sim... fui eu. Peguei os 48 peixes.',
    options: [
      { label: 'Por que você fez isso?', nextNodeId: 'why' },
      { label: 'Você vai devolver AGORA!', nextNodeId: 'threat' },
    ],
  },
  threat: {
    id: 'threat', speaker: 'Tanuki', mood: 'sad',
    text: '*(olhos marejados)* Eu sei que errei... Minha família não tem comida\npara o inverno. São 6 filhotes.',
    options: [{ label: 'Me conta tudo.', nextNodeId: 'think' }],
  },
  why: {
    id: 'why', speaker: 'Tanuki', mood: 'sad',
    text: 'O inverno está chegando. Tenho 6 filhotes e a despensa está vazia.\nEu só queria que eles tivessem o suficiente... Devia ter pedido ajuda.',
    options: [{ label: '(pensar)', nextNodeId: 'think' }],
  },
  think: {
    id: 'think', speaker: 'Shinichi',
    text: '*(pausa pensativa)*\n\nSe 6 filhotes comem 1 peixe por dia, 48 peixes duram 8 dias.\nMas 8 famílias ficaram sem jantar... O que é mais justo?',
    options: [
      { label: '"Você precisa devolver tudo e pedir desculpas."', nextNodeId: 'return', action: 'FLAG:tanuki_confrontado' },
      { label: '"Devolva, e vamos pedir ajuda à vila juntos."', nextNodeId: 'understand', action: 'FLAG:tanuki_compreendido' },
    ],
  },
  return: {
    id: 'return', speaker: 'Tanuki',
    text: 'Você tem razão. Pegar escondido não resolve. Vou devolver e pedir desculpas ao Chef.',
    options: [{ label: 'É o certo a fazer.', nextNodeId: null, action: 'STEP:peixes.confront_tanuki' }],
  },
  understand: {
    id: 'understand', speaker: 'Tanuki', mood: 'happy',
    text: '*(funga)* Juntos? A vila... me ajudaria? Ninguém nunca perguntou dos meus filhotes.\nTá bom. Vou devolver e contar a verdade.',
    options: [{ label: 'Vamos resolver isso juntos.', nextNodeId: null, action: 'STEP:peixes.confront_tanuki' }],
  },
};

const tanuki: NPCDefinition = {
  id: 'tanuki',
  name: 'Tanuki',
  role: 'Habitante da Vila',
  position: [-10, 0, 8],
  look: { species: 'tanuki', fur: '#9A7A5C', belly: '#E9D9C3', scale: 0.95, wide: 1.15, mask: '#3B2C24', accessory: 'leaf' },
  voice: 'chitter',
  barks: ['*(esconde algo atrás das costas)*', 'Nada para ver aqui!'],
  routes: [
    { when: { active: 'inventor', notFlag: 'got_gear_tanuki', flag: 'tanuki_confrontado' }, tree: say('Tanuki', 'Uma engrenagem? Depois daquela conversa, aprendi a devolver as coisas.\nAchei essa no rio. Pode levar.', [
      { label: '⚙️ Obrigado!', nextNodeId: null, action: 'FLAG:got_gear_tanuki;GIVE:engrenagem;COUNT:engrenagens' },
    ]) },
    { when: { active: 'inventor', notFlag: 'got_gear_tanuki' }, tree: say('Tanuki', 'Engrenagem? Eu guardo tudo que brilha... mas para um amigo? Toma!\nMeus filhotes usavam de pião. Eles vão entender.', [
      { label: '⚙️ Obrigado!', nextNodeId: null, action: 'FLAG:got_gear_tanuki;GIVE:engrenagem;COUNT:engrenagens' },
    ]) },
    { when: { active: 'peixes', step: 'peixes.solve_math', notStep: 'peixes.confront_tanuki' }, tree: tanukiConfissao },
    { when: { active: 'peixes', step: 'peixes.confront_tanuki' }, tree: say('Tanuki', 'Já estou indo até a cantina... é que minhas patas estão tremendo.') },
    { when: { done: 'peixes', flag: 'tanuki_compreendido' }, tree: say('Tanuki', 'Agora ajudo na cantina! O Chef me paga em peixes. HONESTAMENTE. 🐟') },
    { when: { done: 'peixes' }, tree: say('Tanuki', 'Estou lavando pratos na cantina para compensar. É justo. Molhado, mas justo.') },
    { tree: say('Tanuki', '*(desvia o olhar)* Hm... ocupado aqui. Coletando... coisas da natureza.\nCompletamente legais.', [bye('Ok...')]) },
  ],
};

// ── Mestre Kuma ─────────────────────────────────────────────────────────────
const kumaOffer: DialogueTree = {
  start: {
    id: 'start', speaker: 'Mestre Kuma',
    text: '🐻 Você resolveu o caso dos peixes com a mente E com o coração. Raro.\n\nPerto da cantina existe uma porta de pedra. Atrás dela, o jardim do\nprimeiro gato ninja da vila. Ela só abre para quem enxerga padrões.',
    options: [
      { label: 'Vou encontrar esse jardim!', nextNodeId: null, action: 'START:lanternas' },
      { label: 'Um jardim secreto? Depois eu vejo.', nextNodeId: null },
    ],
  },
};

const kumaScroll: DialogueTree = {
  start: {
    id: 'start', speaker: 'Mestre Kuma',
    text: '*(lê o pergaminho em silêncio por muito tempo)*\n\nKuro... Eu conheci esse nome. Era um aprendiz brilhante e muito sozinho.\nQuando o mestre dele foi esquecido, ele foi embora com raiva da vila.',
    options: [{ label: 'O que aconteceu com ele?', nextNodeId: 'next' }],
  },
  next: {
    id: 'next', speaker: 'Mestre Kuma',
    text: 'Dizem que um gato de cachecol vermelho foi visto na Floresta do Treinamento.\nVá até lá. E lembre: entender alguém não é o mesmo que concordar com ele.',
    options: [{ label: 'Entendido, Mestre.', nextNodeId: null, action: 'STEP:lanternas.voltar' }],
  },
};

const kuma: NPCDefinition = {
  id: 'mestre_kuma',
  name: 'Mestre Kuma',
  role: 'Sábio do Templo',
  position: [0, 0, -12],
  look: { species: 'bear', fur: '#7A5232', belly: '#C9A27A', scale: 1.3, wide: 1.2, accessory: 'monk' },
  voice: 'grunt',
  offers: [{ mission: 'lanternas', when: PEIXES_DONE }],
  barks: ['Hmm.', 'O vento está falando. Ele fala muito.'],
  routes: [
    { when: { active: 'lanternas', step: 'lanternas.pergaminho' }, tree: kumaScroll },
    { when: { active: 'lanternas' }, tree: say('Mestre Kuma', 'A lápide fica ao lado da porta de pedra, atrás da cantina.\nNão procure com pressa. Procure com atenção.') },
    { when: { done: 'peixes', notStarted: 'lanternas' }, tree: kumaOffer },
    { when: { active: 'kuro', step: 'kuro.encontrar' }, tree: {
      start: {
        id: 'start', speaker: 'Mestre Kuma',
        text: 'Você o encontrou. E ele deixou o nome do mestre dele numa pedra...\nKuro foi aprendiz aqui, muito antes de você. O mestre dele salvou a vila e foi esquecido.',
        options: [{ label: '"Ele disse que as lanternas do festival vão se apagar."', nextNodeId: 'end' }],
      },
      end: {
        id: 'end', speaker: 'Mestre Kuma', mood: 'surprised',
        text: 'Então ele vai agir no festival. Fique atento, jovem.\nE lembre: entender a dor de alguém não é concordar com o que ele faz. Mas ajuda a encontrar outro caminho.',
        options: [{ label: '🌙 Vou ficar atento.', nextNodeId: null, action: 'STEP:kuro.contar' }],
      },
    } },
    { when: { active: 'kuro', counter: { id: 'kuro_pistas', atLeast: 3 } }, tree: say('Mestre Kuma', 'Três pistas e uma seta para uma pedra entalhada? Leia a pedra com calma.\nNúmeros às vezes são letras disfarçadas.') },
    { when: { active: 'kuro' }, tree: say('Mestre Kuma', 'A floresta fica depois da ponte vermelha. Não procure o gato: procure o que ele deixou para trás.\nPegadas, fios, sinais. Quem observa encontra.') },
    { when: { done: 'kuro' }, tree: say('Mestre Kuma', 'Kuro voltará. Quando isso acontecer, a vila vai precisar de alguém\nque saiba ouvir antes de lutar. Continue treinando, jovem.') },
    {
      tree: {
        start: {
          id: 'start', speaker: 'Mestre Kuma',
          text: '🐻 Hmm... um jovem ninja. Seu kimono está torto.\nMas seus olhos têm fogo. Isso conta mais.',
          options: [
            { label: 'Você pode me treinar?', nextNodeId: 'train' },
            { label: 'Meu kimono está ÓTIMO.', nextNodeId: 'kimono' },
          ],
        },
        train: {
          id: 'train', speaker: 'Mestre Kuma',
          text: 'Antes de treinar o corpo, treine a mente. Resolva os problemas da vila.\nPara saltos, procure o Mestre Lótus na floresta, depois da ponte.',
          options: [bye('Entendido, Mestre.')],
        },
        kimono: {
          id: 'kimono', speaker: 'Mestre Kuma',
          text: '*(olha para o kimono)*\n*(olha para você)*\n*(olha de novo para o kimono)*\n\nEstá torto.',
          options: [bye('...ok, talvez um pouquinho.')],
        },
      },
    },
  ],
};

// ── Mestre Lótus ────────────────────────────────────────────────────────────
const lotus: NPCDefinition = {
  id: 'lotus',
  name: 'Mestre Lótus',
  role: 'Mestre de Treinamento',
  position: [-4, 0, 29.5],
  look: { species: 'cat', fur: '#A9A6B2', belly: '#EEEBF2', scale: 1.05, eyes: 'closed', accessory: 'sage' },
  voice: 'meow_low',
  offers: [{ mission: 'treino' }],
  barks: ['Hmpf. Postura.', 'Respire. Observe. Pule. Nessa ordem.'],
  routes: [
    { when: { active: 'treino', step: 'treino.pedra_alta' }, tree: say('Mestre Lótus', 'Pegou a pata na pedra alta. Sem chorar, sem cair de cara.\nQuase impressionante. *(sorriso mínimo)*\n\nUm ninja não é quem nunca cai. É quem observa antes de pular.', [
      { label: '🙇 Obrigado, Mestre!', nextNodeId: null, action: 'STEP:treino.voltar' },
    ]) },
    { when: { active: 'treino', step: 'treino.aprender' }, tree: say('Mestre Lótus', 'A Pata Dourada na pedra alta, a leste. Pule, e no ar pule DE NOVO.\nSim, isso desafia a física. Não, não vou explicar.') },
    { when: { active: 'treino', step: 'treino.argolas' }, tree: {
      start: {
        id: 'start', speaker: 'Mestre Lótus',
        text: 'Seis argolas, na ordem. Hmpf. Você observou antes de pular.\nAgora a técnica secreta: o Salto Duplo. Pule... e no ar, pule de novo.',
        options: [{ label: '🌀 Aprender o Salto Duplo', nextNodeId: 'how', action: 'ABILITY:double_jump;STEP:treino.aprender' }],
      },
      how: {
        id: 'how', speaker: 'Mestre Lótus',
        text: 'Aperte ESPAÇO e, no ar, ESPAÇO de novo. Teste na pedra alta, a leste.\nLá em cima tem uma Pata Dourada esperando um gato menos atrapalhado.',
        options: [bye('Vou lá!')],
      },
    } },
    { when: { active: 'treino' }, tree: say('Mestre Lótus', 'As argolas não vão pular sozinhas. A dourada é a próxima.\nDica: corra (Shift) e pule na hora certa. Errar está incluído no preço.') },
    { when: { notStarted: 'treino' }, tree: {
      start: {
        id: 'start', speaker: 'Mestre Lótus',
        text: 'Ah. Mais um aprendiz que acha que ser ninja é fazer pose.\n*(abre um olho)* ...Você até que tem boa postura. Para um gato.',
        options: [
          { label: 'Quero aprender técnicas ninja!', nextNodeId: 'offer' },
          { label: 'Minha pose é ÉPICA.', nextNodeId: 'pose' },
        ],
      },
      pose: {
        id: 'pose', speaker: 'Mestre Lótus',
        text: '*(olha a pose por cinco longos segundos)*\nÉ uma pose. Isso eu admito.',
        options: [{ label: 'Tá, quero aprender.', nextNodeId: 'offer' }],
      },
      offer: {
        id: 'offer', speaker: 'Mestre Lótus',
        text: 'Primeira lição: observar antes de pular. Passe pelas seis argolas na ordem.\nA dourada é sempre a próxima. Volte quando terminar.',
        options: [{ label: 'Aceito o desafio!', nextNodeId: null, action: 'START:treino' }, bye('Depois')],
      },
    } },
    { tree: say('Mestre Lótus', 'Ainda faltam Patas Douradas por aí. Olhe para cima, olhe para trás.\nE use o faro (Q). Para que mais servem esses bigodes?') },
  ],
};

// ── Taro ────────────────────────────────────────────────────────────────────
const taro: NPCDefinition = {
  id: 'taro',
  name: 'Taro',
  role: 'Rival competitivo',
  position: [-2.8, 0, 6.4],
  look: { species: 'cat', fur: '#3A3742', belly: '#6E6A78', scale: 1, eyes: 'sharp', accessory: 'rival' },
  voice: 'meow_high',
  offers: [{ mission: 'chuva_peixes', when: PEIXES_DONE }],
  barks: ['Detetive Ninja? Pff. EU sou o futuro Mestre das Patas.', 'Hmph!', 'Aposto que pulo mais alto que você.'],
  routes: [
    { when: { active: 'chuva_peixes', step: 'chuva_peixes.recolher', notStep: 'chuva_peixes.cestos' }, tree: say('Taro', 'Você pegou os 12?! ...Ok. Obrigado. Agora, os cestos do mercado cabem 3 cada.\nQuantos cestos a gente precisa? (Eu sei, só estou testando você.)', [
      { label: '🧺 Calcular os cestos', nextNodeId: null, action: 'CHALLENGE:cestos_peixes' }, bye('Já volto'),
    ]) },
    { when: { active: 'chuva_peixes', step: 'chuva_peixes.cestos' }, tree: say('Taro', 'Tá... a gente precisa falar com a Chef Hana. Você vai na frente.\nBEM na frente.') },
    { when: { active: 'chuva_peixes' }, tree: say('Taro', 'Recolhe logo esses peixes! Doze! Eles estão pulando pela vila toda...\n...por favor?') },
    { when: { active: 'inventor', notFlag: 'got_gear_taro', done: 'chuva_peixes' }, tree: say('Taro', 'Essa engrenagem? Eu ia usar no meu "Jutsu Mecânico"... Toma.\nVocê me ajudou com os peixes. Ninjas pagam suas dívidas.', [
      { label: '⚙️ Valeu, Taro!', nextNodeId: null, action: 'FLAG:got_gear_taro;GIVE:engrenagem;COUNT:engrenagens' },
    ]) },
    { when: { active: 'inventor', notFlag: 'got_gear_taro' }, tree: say('Taro', 'Engrenagem? Leva. Não preciso de máquinas, sou um gênio natural.\n*(um peixe pula da mochila dele)* ...Isso não aconteceu.', [
      { label: '⚙️ Valeu, Taro!', nextNodeId: null, action: 'FLAG:got_gear_taro;GIVE:engrenagem;COUNT:engrenagens' },
    ]) },
    { when: { done: 'peixes', notStarted: 'chuva_peixes' }, tree: {
      start: {
        id: 'start', speaker: 'Taro',
        text: 'Ah, o famoso Detetive Ninja. Eu, Taro, acabei de criar um jutsu INCRÍVEL:\no Jutsu da Multiplicação de Peixes!',
        options: [{ label: 'E funcionou?', nextNodeId: 'oops' }],
      },
      oops: {
        id: 'oops', speaker: 'Taro', mood: 'surprised',
        text: '*(um peixe cai do céu na cabeça dele)*\n\n...Funcionou DEMAIS. Tem 12 peixes pulando pela vila.\nSe a Chef Hana descobrir... Me ajuda? Não conta pra ninguém que pedi.',
        options: [{ label: 'Eu ajudo. 🐟', nextNodeId: null, action: 'START:chuva_peixes' }, bye('Boa sorte com isso!')],
      },
    } },
    { when: { done: 'chuva_peixes' }, tree: say('Taro', 'Ainda acho que sou o melhor ninja. Mas talvez... o segundo melhor seja você.\nTalvez. Não espalha.') },
    { tree: say('Taro', 'Hmph. Detetive Ninja... Um dia eu resolvo um mistério MAIOR que o seu.') },
  ],
};

// ── Kiko ────────────────────────────────────────────────────────────────────
const kiko: NPCDefinition = {
  id: 'kiko',
  name: 'Kiko',
  role: 'Inventor excêntrico',
  position: [12.6, 0, 16.6],
  look: { species: 'cat', fur: '#E8873A', belly: '#FFE3C4', scale: 0.95, stripes: '#C2602A', accessory: 'inventor' },
  voice: 'meow_high',
  offers: [{ mission: 'inventor', when: PEIXES_DONE }],
  barks: ['Faltou parafuso! Ou sobrou? Nunca sei.', 'Teste número 47: menos fumaça que o 46!'],
  routes: [
    { when: { active: 'inventor', step: 'inventor.instalar', notStep: 'inventor.calcular' }, tree: say('Kiko', 'Engrenagens no lugar! Agora a parte delicada: a grande tem 24 dentes e a\npequena tem 8. Preciso saber quantas voltas a pequena dá. Me ajuda?', [
      { label: '⚙️ Calcular', nextNodeId: null, action: 'CHALLENGE:engrenagens' }, bye('Já volto'),
    ]) },
    { when: { active: 'inventor', step: 'inventor.calcular' }, tree: say('Kiko', 'Três voltas! Perfeito! Agora aperte o botão vermelho.\nO que pode dar errado? *(muita coisa)* NADA!') },
    { when: { active: 'inventor' }, tree: say('Kiko', 'Preciso de 3 engrenagens! Uma deve estar no caixote do mercado,\no Tanuki guarda tudo que brilha, e o Taro "pegou emprestado" uma.\nDepois é só encaixar na Peixomática!') },
    { when: { done: 'peixes', notStarted: 'inventor' }, tree: {
      start: {
        id: 'start', speaker: 'Kiko',
        text: 'Ah! Um assistente! Quer dizer, um VISITANTE! Eu sou o Kiko, inventor.\nEsta é a Peixomática 3000: ela organiza peixes por tamanho!\nBem, organizaria. Se tivesse engrenagens.',
        options: [
          { label: 'Posso ajudar a achar engrenagens!', nextNodeId: null, action: 'START:inventor' },
          { label: 'Ela vai explodir?', nextNodeId: 'boom' },
        ],
      },
      boom: {
        id: 'boom', speaker: 'Kiko',
        text: 'Explodir é uma palavra muito forte. Eu prefiro "surpreender intensamente".',
        options: [{ label: '...tá, eu ajudo.', nextNodeId: null, action: 'START:inventor' }, bye('Vou pensar')],
      },
    } },
    { when: { done: 'inventor' }, tree: say('Kiko', 'A Peixomática funciona! Meu próximo projeto: um aspirador de pelos que\nnão assusta gatos. Ainda está na fase "assusta MUITO".') },
    { tree: say('Kiko', 'Ocupado! Inventando! Volte quando a vila estiver mais calma.') },
  ],
};

// ── Guarda Roku ─────────────────────────────────────────────────────────────
const roku: NPCDefinition = {
  id: 'roku',
  name: 'Guarda Roku',
  role: 'Guarda (muito) atrapalhado',
  position: [-3.5, 0, -5.6],
  patrol: [[-3.5, 0, -5.6], [3.5, 0, -5.6], [3.8, 0, -2.8], [-3.8, 0, -2.8]],
  look: { species: 'cat', fur: '#8E8E96', belly: '#D8D8DE', scale: 1.15, wide: 1.2, accessory: 'guard' },
  voice: 'meow_low',
  offers: [{ mission: 'fantasma', when: PEIXES_DONE }],
  barks: ['Alto lá! ...Ah, é você.', 'Tudo sob controle! *(tropeça)*', 'Patrulha número 312. Nada suspeito. Exceto aquela folha.'],
  routes: [
    { when: { active: 'fantasma', step: 'fantasma.descobrir' }, tree: say('Guarda Roku', 'Era a... Dona Neko? Roncando? *(pausa)*\nEu SABIA. Era um teste. Para você. E você passou!\n...Obrigado. Não conta pra ninguém que eu me escondi atrás do quadro.', [
      { label: '😹 Segredo guardado', nextNodeId: null, action: 'STEP:fantasma.contar' },
    ]) },
    { when: { active: 'fantasma' }, tree: say('Guarda Roku', 'As pegadas vão até o galpão velho, perto do rio, a oeste.\nVai na frente. Eu cubro a retaguarda. Bem de longe.') },
    { when: { done: 'peixes', notStarted: 'fantasma' }, tree: {
      start: {
        id: 'start', speaker: 'Guarda Roku', mood: 'surprised',
        text: 'Shinichi! Situação de emergência nível... muito! Tem um FANTASMA no galpão velho!\nEle faz "ZZZRRRR" e "HHHNNN". Eu investigaria, mas... estou de guarda. Aqui. Longe.',
        options: [
          { label: 'Eu investigo o fantasma.', nextNodeId: 'go', action: 'START:fantasma' },
          { label: 'Fantasmas não existem, Roku.', nextNodeId: 'skeptic' },
        ],
      },
      skeptic: {
        id: 'skeptic', speaker: 'Guarda Roku',
        text: 'Então prova! Segue as pegadas e descobre o que é!',
        options: [{ label: 'Tá bom, eu vou.', nextNodeId: 'go', action: 'START:fantasma' }],
      },
      go: {
        id: 'go', speaker: 'Guarda Roku',
        text: 'Siga as pegadas a partir da praça, para o oeste, até o galpão perto do rio.\nSe ouvir "ZZZRRRR"... corre. Quer dizer, investiga!',
        options: [bye('Deixa comigo!')],
      },
    } },
    { when: { done: 'fantasma' }, tree: say('Guarda Roku', 'Desde o caso do fantasma, aprendi: primeiro observo, depois me assusto.\nÀs vezes ainda inverto a ordem.') },
    lazy(undefined, () => chatter('Guarda Roku', [
      'Alto lá! Identifique-se! ...Ah, Shinichi. Pode passar. Mas com cuidado.',
      'Sou o Guarda Roku. Protejo a vila de perigos como... folhas suspeitas.',
      'Minha armadura é de bambu. É leve, ecológica e faz "toc toc" quando corro.',
    ])),
  ],
};

// ── Dona Neko (o "fantasma") ────────────────────────────────────────────────
const neko: NPCDefinition = {
  id: 'neko',
  name: 'Dona Neko',
  role: 'Vizinha dorminhoca',
  position: [-16.2, 0, 19.6],
  look: { species: 'cat', fur: '#F2E3C9', belly: '#FFFFFF', scale: 0.95, wide: 1.3, eyes: 'sleepy', accessory: 'sleeper' },
  voice: 'snore',
  faceRotation: Math.PI / 2,
  routes: [
    { when: { active: 'fantasma', step: 'fantasma.pegadas', notStep: 'fantasma.descobrir' }, tree: {
      start: {
        id: 'start', speaker: 'Narrador',
        text: 'Atrás do galpão, enrolada num cobertor, uma gata idosa ronca alto.\n"ZZZRRRRR... HHHNNNN..."\n\nO fantasma tem bigodes e chinelos.',
        options: [
          { label: '(gritar) "BUUU!"', nextNodeId: 'grito' },
          { label: '(cutucar com cuidado)', nextNodeId: 'cutuca' },
        ],
      },
      grito: {
        id: 'grito', speaker: 'Dona Neko', mood: 'surprised',
        text: 'AAAAH! *(pula meio metro)* ...Shinichi?! Quase perdi minhas sete vidas!\n*(ri)* Eu cochilei aqui de novo, né? O galpão é quentinho...',
        options: [{ label: 'Desculpa! O Roku achou que você era um fantasma.', nextNodeId: 'end' }],
      },
      cutuca: {
        id: 'cutuca', speaker: 'Dona Neko',
        text: '*(abre um olho)* Hm? Oi, filhote... Eu cochilei aqui de novo, né?\nO galpão é quentinho quando bate sol.',
        options: [{ label: 'O Roku achou que você era um fantasma.', nextNodeId: 'end' }],
      },
      end: {
        id: 'end', speaker: 'Dona Neko', mood: 'happy',
        text: 'Um fantasma? EU? *(ri até tossir)* Diga ao Roku que o fantasma manda lembranças.\nE que ronca porque está feliz.',
        options: [{ label: '😹 Pode deixar', nextNodeId: null, action: 'STEP:fantasma.descobrir' }],
      },
    } },
    { when: { active: 'contas', step: 'contas.preco', notStep: 'contas.entregar', item: { id: 'sacola_macas' } }, tree: {
      start: {
        id: 'start', speaker: 'Dona Neko',
        text: '*(abre um olho)* Hm? Maçãs do Boku? Que gentileza vir até aqui, filhote!\n*(procura no avental)* Aqui está: uma nota de 20 moedas. Diga ao Boku para não errar o troco, hein?',
        options: [{ label: '💴 Pode deixar!', nextNodeId: null, action: 'TAKE:sacola_macas;GIVE:moedas_neko;STEP:contas.entregar' }],
      },
    } },
    { when: { done: 'fantasma' }, tree: say('Dona Neko', 'Ronco? Eu? Nunca. *(ronca acordada)*') },
    { tree: say('Dona Neko', 'Zzz... *(ronca)* ...peixinho... zzz...', [bye('(deixar dormir)')]) },
  ],
};

// ── Sora ────────────────────────────────────────────────────────────────────
const sora: NPCDefinition = {
  id: 'sora',
  name: 'Sora',
  role: 'Exploradora',
  position: [3.6, 0, 19.0],
  look: { species: 'cat', fur: '#FFFFFF', belly: '#FFFFFF', scale: 0.98, mask: '#E39B4A', stripes: '#2E2A30', accessory: 'explorer' },
  voice: 'meow',
  offers: [{ mission: 'mapa', when: PEIXES_DONE }],
  barks: ['Psiu! Ouviu isso? Era o rio. Ele fala.', 'Cada pedra tem uma história.', 'Achados novos na sacola! Compare os preços, hein.'],
  routes: [
    { when: { active: 'mapa', step: 'mapa.cavar' }, tree: say('Sora', 'VOCÊ ACHOU! "Terceira lanterna" contando a partir da ponte! Eu contei do outro lado.\nFica com a bússola. Ela aponta para a cantina, mas é charmosa.', [
      { label: '🧭 Obrigado, Sora!', nextNodeId: null, action: 'STEP:mapa.voltar' },
    ]) },
    { when: { active: 'mapa' }, tree: say('Sora', '"Onde a água canta e a ponte vermelha dorme, cave sob a terceira lanterna."\nLanternas de pedra na margem... mas contando a partir de onde?\n(Abra a mochila com I para reler o mapa.)') },
    { when: { done: 'peixes', notStarted: 'mapa' }, tree: {
      start: {
        id: 'start', speaker: 'Sora',
        text: 'Ei, Detetive! Achei um mapa velho dentro de um tronco oco. Tem uma charada,\nmas eu cavei em seis lugares e só achei minhocas. Quer tentar?',
        options: [
          { label: '🗺️ Ver o mapa', nextNodeId: 'riddle', action: 'START:mapa;GIVE:mapa' },
          bye('Agora não'),
        ],
      },
      riddle: {
        id: 'riddle', speaker: 'Sora',
        text: '"Onde a água canta e a ponte vermelha dorme, cave sob a terceira lanterna."\n\nA ponte vermelha é aqui pertinho. O resto é com você!',
        options: [bye('Vou desvendar!')],
      },
    } },
    // everyday talk: a tip from her travels, and her bag of finds (the gem shop)
    lazy(undefined, () => {
      const tips = [
        'Dica de exploradora: tem uma Pata Dourada nas pedras do rio, a oeste.',
        'Já subiu na ponte vermelha? Lá de cima dá pra ver brilhos estranhos...',
        'Atrás da cabana de palha tem um cantinho que ninguém olha. Ninguém além de mim.',
      ];
      return say('Sora', `${tips[Math.floor(Math.random() * tips.length)]}\n\nAh! E a minha sacola de achados está aberta. Aceito gemas, não aceito minhocas.`, [
        { label: '🎒 Ver os achados da Sora (loja de gemas)', nextNodeId: null, action: 'SHOP' },
        bye('Até mais, Sora!'),
      ]);
    }),
  ],
};

// ── Kuro ────────────────────────────────────────────────────────────────────
const kuro: NPCDefinition = {
  id: 'kuro',
  name: 'Kuro',
  role: 'Gato misterioso',
  position: [14, 0, 33.6],
  look: { species: 'cat', fur: '#2A2630', belly: '#3A3542', scale: 1.05, eyes: 'sharp', accessory: 'mystery' },
  voice: 'meow_low',
  // shows himself only once the player has followed the clues and read his master's name on the stone
  visibleWhen: { flag: 'kuro_aparece', notDone: 'kuro', step: 'kuro.decifrar' },
  routes: [
    { when: { active: 'kuro' }, tree: {
      start: {
        id: 'start', speaker: 'Kuro',
        text: 'Então você é o "Detetive Ninja". Leu o pergaminho, não leu?\nAgora sabe que esta vila esquece quem a protege.',
        options: [
          { label: '"Você quer se vingar da vila?"', nextNodeId: 'vinganca' },
          { label: '"Por que você voltou?"', nextNodeId: 'porque' },
        ],
      },
      vinganca: {
        id: 'vinganca', speaker: 'Kuro',
        text: 'Vingança? *(ri baixo)* Não. Quero que LEMBREM. Meu mestre salvou esta vila\ne nem uma lanterna leva o nome dele. Vou mostrar o que acontece\nquando ninguém presta atenção.',
        options: [{ label: '"Talvez exista outro jeito."', nextNodeId: 'jeito' }],
      },
      porque: {
        id: 'porque', speaker: 'Kuro',
        text: 'Para testar se ainda existe alguém aqui que observa antes de agir.\nVocê resolveu o caso dos peixes sem condenar ninguém. Interessante.',
        options: [{ label: '"E agora?"', nextNodeId: 'jeito' }],
      },
      jeito: {
        id: 'jeito', speaker: 'Kuro',
        text: 'Veremos, Shinichi. Quando as lanternas do festival se apagarem,\nvocê vai entender. *(desaparece numa nuvem de fumaça)*',
        onEnter: 'SFX:poof',
        options: [{ label: '...Ele sumiu. (Contar ao Mestre Kuma)', nextNodeId: null, action: 'STEP:kuro.encontrar' }],
      },
    } },
  ],
};

const CHAPTER_1: NPCDefinition[] = [
  chefTofu, kenzo, mei, meiFloresta, tanuki, kuma, lotus, taro, kiko, roku, neko, sora, kuro,
];

// Capítulo 2: in-progress routes go first; new offers sit after each NPC's existing in-progress routes.
for (const npc of CHAPTER_1) {
  const ext = EXTENSIONS[npc.id];
  if (!ext) continue;
  const lastActive = npc.routes.reduce((acc, r, i) => (r.when?.active ? i : acc), -1);
  npc.routes.splice(lastActive + 1, 0, ...ext.offers);
  npc.routes.unshift(...ext.active);
  npc.offers = [...(npc.offers ?? []), ...ext.offerMeta];
}

export const NPC_DEFINITIONS: NPCDefinition[] = [...CHAPTER_1, ...NEW_NPCS, FUJI, GORO, HINOKI, MIMI];

// Capítulo 3: in-progress routes first; the new offers go after the villager's older ones (in-progress or offer
// routes), in the same order as `offers`, so the mission log (missionState.ts, first offer in that list) names
// the mission the villager really offers when you talk (tests/interiors.test.ts).
for (const npc of NPC_DEFINITIONS) {
  const ext = CHAPTER3_ROUTES[npc.id];
  if (!ext) continue;
  const lastOlder = npc.routes.reduce((acc, r, i) => (r.when?.active || r.when?.notStarted ? i : acc), -1);
  npc.routes.splice(lastOlder + 1, 0, ...ext.offers);
  npc.routes.unshift(...ext.active);
  npc.offers = [...(npc.offers ?? []), ...ext.offerMeta];
}

export const NPCS_BY_ID: Record<string, NPCDefinition> = Object.fromEntries(NPC_DEFINITIONS.map((n) => [n.id, n]));

/** First route whose condition holds wins. Lazy routes rebuild their tree (random chatter). */
export function resolveDialogue(npc: NPCDefinition, progress: Progress): { tree: DialogueTree; startId: string } | null {
  for (const route of npc.routes) {
    if (!checkCondition(route.when, progress)) continue;
    const make = (route as { make?: () => DialogueTree }).make;
    return { tree: make ? make() : route.tree, startId: route.start ?? 'start' };
  }
  return null;
}

/** The first mission this NPC can offer right now (drives the "!" marker). */
export function availableOffer(npc: NPCDefinition, progress: Progress): string | null {
  for (const offer of npc.offers ?? []) {
    if (!progress.missions[offer.mission] && checkCondition(offer.when, progress)) return offer.mission;
  }
  return null;
}
