import type { NPCDefinition, DialogueTree, DialogueOption, DialogueRoute, Condition } from '../types';
import { KURO_MIRANTE } from './world2';

/** Capítulo 2: new characters and the dialogue routes added to existing ones. */

const bye = (label = 'Até mais!'): DialogueOption => ({ label, nextNodeId: null });

function say(speaker: string, text: string, options: DialogueOption[] = [bye()], onEnter?: string): DialogueTree {
  return { start: { id: 'start', speaker, text, options, onEnter } };
}

function chatterRoute(speaker: string, lines: string[]): DialogueRoute & { make: () => DialogueTree } {
  return { tree: {}, make: () => say(speaker, lines[Math.floor(Math.random() * lines.length)]) };
}

export interface RouteExtension {
  /** High-priority routes for missions in progress. */
  active: DialogueRoute[];
  /** Mission offers, placed after the NPC's existing in-progress routes. */
  offers: DialogueRoute[];
  offerMeta: { mission: string; when?: Condition }[];
}

// ── Extensions for existing characters ──────────────────────────────────────
export const EXTENSIONS: Record<string, RouteExtension> = {
  taro: {
    active: [
      { when: { active: 'gol', step: 'gol.gols' }, tree: say('Taro', 'TRÊS gols?! ...Tá. Você é bom. Um pouquinho.\nAmanhã a gente treina junto? Não que eu precise. É só pra você não ficar sozinho.', [
        { label: '😹 Combinado, parceiro!', nextNodeId: null, action: 'STEP:gol.voltar' },
      ]) },
      { when: { active: 'gol' }, tree: say('Taro', 'O gol vermelho fica na floresta, perto da pedra alta. Corra empurrando a bola ou chute com E.\nTrês gols! Eu... vou contar daqui. De longe. Sem olhar.') },
    ],
    offers: [
      { when: { done: 'chuva_peixes', notStarted: 'gol' }, tree: {
        start: {
          id: 'start', speaker: 'Taro',
          text: 'Ei, Detetive. Montei um gol na floresta. Aposto que você não faz 3 gols com a bola de pano!\nEu fiz 2. Quase 3. O terceiro bateu numa borboleta.',
          options: [{ label: '⚽ Desafio aceito!', nextNodeId: null, action: 'START:gol' }, bye('Depois')],
        },
      } },
    ],
    offerMeta: [{ mission: 'gol', when: { done: 'chuva_peixes' } }],
  },
  chef_tofu: {
    active: [
      { when: { active: 'festival', step: 'festival.pendurar' }, tree: say('Chef Hana', 'As lanternas estão LINDAS! Então... QUE COMECE O FESTIVAL DAS LANTERNAS! 🏮🎆\n{aniversario}', [
        { label: '🎉 Viva o festival!', nextNodeId: null, action: 'STEP:festival.abrir' },
      ]) },
      { when: { active: 'festival' }, tree: say('Chef Hana', 'Lanternas! Vi uma perto da cantina, uma no mercado, uma perto da casa da Luna,\numa na oficina do Kiko e uma no dojo. Pendure nos postes das bandeirinhas e no torii!') },
      { when: { active: 'lanternas_apagadas', notStep: 'lanternas_apagadas.investigar' }, tree: say('Chef Hana', 'Que escuridão! O Guarda Roku estava de ronda quando aconteceu. Pergunte a ele!') },
      { when: { active: 'lanternas_apagadas' }, tree: say('Chef Hana', 'Força, Shinichi! A vila confia em você.') },
    ],
    offers: [
      { when: { done: ['festival', 'kuro', 'ponte'], notStarted: 'lanternas_apagadas' }, tree: {
        start: {
          id: 'start', speaker: 'Chef Hana', mood: 'surprised',
          text: 'SHINICHI! Você viu?! TODAS as lanternas do festival se apagaram de uma vez!\nE ninguém sabe como...',
          onEnter: 'FLAG:lanternas_escuras',
          options: [{ label: 'Eu vou descobrir.', nextNodeId: null, action: 'START:lanternas_apagadas' }],
        },
      } },
      { when: { done: 'receita', notStarted: 'festival' }, tree: {
        start: {
          id: 'start', speaker: 'Chef Hana', mood: 'happy',
          text: 'Tive uma ideia DELICIOSA: um Festival das Lanternas! Comida, música, luzes...\nMas preciso de 5 lanternas de papel penduradas na praça. Me ajuda?',
          options: [{ label: '🏮 Vamos fazer uma festa!', nextNodeId: null, action: 'START:festival' }, bye('Depois')],
        },
      } },
    ],
    offerMeta: [
      { mission: 'festival', when: { done: 'receita' } },
      { mission: 'lanternas_apagadas', when: { done: ['festival', 'kuro', 'ponte'] } },
    ],
  },
  roku: {
    active: [
      { when: { active: 'lanternas_apagadas', notStep: 'lanternas_apagadas.investigar' }, tree: say('Guarda Roku', 'Eu VI! Uma sombra de cachecol vermelho subindo a escada do Mirante!\nEu... fiquei aqui embaixo. Guardando. A escada. Com bravura.', [
        { label: 'Vou ao Mirante.', nextNodeId: null, action: 'STEP:lanternas_apagadas.investigar' },
      ]) },
      { when: { active: 'cofre', step: 'cofre.abrir' }, tree: say('Guarda Roku', 'MINHA MEDALHA! "Por bravura (quase sempre)". Obrigado, Shinichi!\nVou anotar o código num lugar seguro. Talvez no meu chapéu.', [
        { label: '🎖️ Devolver a medalha', nextNodeId: null, action: 'TAKE:medalha;STEP:cofre.voltar' },
      ]) },
      { when: { active: 'cofre' }, tree: say('Guarda Roku', 'Deixei 3 bilhetes: um na praça, um perto do sino do templo e um perto da ponte.\nOu foi ao contrário. Use o Faro (Q) se ficar difícil!') },
    ],
    offers: [
      { when: { done: 'fantasma', notStarted: 'cofre' }, tree: {
        start: {
          id: 'start', speaker: 'Guarda Roku', mood: 'sad',
          text: 'Situação de emergência nível... constrangedor. Esqueci o código do meu cofre.\nMas sou esperto: deixei bilhetes-pista pela vila! ...Só não lembro as pistas.',
          options: [{ label: '🔍 Eu decifro as pistas.', nextNodeId: null, action: 'START:cofre' }, bye('Boa sorte, Roku')],
        },
      } },
    ],
    offerMeta: [{ mission: 'cofre', when: { done: 'fantasma' } }],
  },
  kenzo: {
    active: [
      { when: { active: 'ponte', step: 'ponte.contar', notStep: 'ponte.comprar' }, tree: {
        start: {
          id: 'start', speaker: 'Boku',
          text: 'Tábuas para o Mirante? Organizadíssimas: 3 moedas cada.\nQuantas você precisa? 12? Então o total é...',
          options: [
            { label: '🧮 Calcular e pagar', nextNodeId: null, action: 'CHALLENGE:tabuas_preco', when: { coins: 36 } },
            { label: 'Posso trabalhar no mercado? (preciso de moedas)', nextNodeId: 'work', when: { notFlag: 'ajudou_mercado' } },
            { label: 'Ajudar no mercado de novo', nextNodeId: 'work2', when: { flag: 'ajudou_mercado' } },
            bye('Já volto'),
          ],
        },
        work: {
          id: 'work', speaker: 'Boku',
          text: '*(você organiza 200 maçãs por tamanho, cor e humor)*\n\nPerfeito! Tome 40 moedas. Você tem futuro no comércio.',
          onEnter: 'FLAG:ajudou_mercado;COINS:40',
          options: [bye('Obrigado!')],
        },
        work2: {
          id: 'work2', speaker: 'Boku',
          text: '*(você empilha nabos em formato de pirâmide)*\n\nArtístico! Tome 15 moedas.',
          onEnter: 'COINS:15',
          options: [bye('Valeu!')],
        },
      } },
    ],
    offers: [],
    offerMeta: [],
  },
  lotus: {
    active: [
      { when: { active: 'folhas', step: 'folhas.folhas' }, tree: say('Mestre Lótus', 'Cinco folhas. Você olhou para a sombra antes de correr. Hmpf.\nEstou... levemente impressionado. Não se acostume.', [
        { label: '🙇 Obrigado, Mestre!', nextNodeId: null, action: 'STEP:folhas.voltar' },
      ]) },
      { when: { active: 'folhas' }, tree: say('Mestre Lótus', 'As folhas caem perto de mim. Olhe o círculo dourado no chão: é onde vão pousar.\nChegue antes delas. Simples. Não fácil.') },
    ],
    offers: [
      { when: { done: 'treino', notStarted: 'folhas' }, tree: {
        start: {
          id: 'start', speaker: 'Mestre Lótus',
          text: 'Próxima lição: reflexo. Vou sacudir a cerejeira e folhas douradas vão cair.\nPegue cinco antes que toquem o chão. A sombra conta o futuro, se você prestar atenção.',
          options: [{ label: '🍂 Estou pronto!', nextNodeId: null, action: 'START:folhas' }, bye('Depois')],
        },
      } },
    ],
    offerMeta: [{ mission: 'folhas', when: { done: 'treino' } }],
  },
  tanuki: {
    active: [
      { when: { active: 'filhotes', step: 'filhotes.achar', flag: 'tanuki_compreendido' }, tree: say('Tanuki', 'Você achou os seis! *(abraça todos de uma vez)*\nDesde que a vila nos ajudou, eles não param de brincar. Obrigado, amigo.', [
        { label: '🦝 Eles são ótimos em se esconder!', nextNodeId: null, action: 'STEP:filhotes.voltar' },
      ]) },
      { when: { active: 'filhotes', step: 'filhotes.achar' }, tree: say('Tanuki', 'Os seis! Obrigado. Sabe... depois daquela bronca, achei que você não ia querer me ajudar.\nObrigado por me dar outra chance.', [
        { label: 'Todo mundo merece outra chance.', nextNodeId: null, action: 'STEP:filhotes.voltar' },
      ]) },
      { when: { active: 'filhotes' }, tree: say('Tanuki', 'Escute as risadinhas: eles não conseguem ficar quietos! Um deles adora lugares altos...') },
    ],
    offers: [
      { when: { done: 'peixes', notStarted: 'filhotes' }, tree: {
        start: {
          id: 'start', speaker: 'Tanuki',
          text: 'Shinichi! Meus 6 filhotes estão brincando de esconde-esconde... e eu não acho NENHUM.\nEles são muito bons nisso. Puxaram a mim.',
          options: [{ label: '👀 Eu acho todos!', nextNodeId: null, action: 'START:filhotes' }, bye('Depois')],
        },
      } },
    ],
    offerMeta: [{ mission: 'filhotes', when: { done: 'peixes' } }],
  },
  mestre_kuma: {
    active: [
      { when: { active: 'lanternas_apagadas' }, tree: say('Mestre Kuma', 'Escuridão não se vence com raiva, jovem. Vence-se com uma luz que alguém quer ver.') },
    ],
    offers: [],
    offerMeta: [],
  },
};

// ── New characters ──────────────────────────────────────────────────────────
const mochi: NPCDefinition = {
  id: 'mochi',
  name: 'Vovó Mochi',
  role: 'Moradora mais antiga',
  position: [7.4, 0, -14.4],
  look: { species: 'cat', fur: '#E9E4EE', belly: '#FFFFFF', scale: 0.95, wide: 1.15, eyes: 'closed', accessory: 'granny' },
  voice: 'meow',
  offers: [{ mission: 'ponte', when: { done: 'peixes' } }],
  barks: ['Ai, minhas costas...', 'No meu tempo, a gente subia o Mirante todo dia!', 'Quer um biscoito, querido?'],
  routes: [
    { when: { active: 'ponte', step: 'ponte.luneta' }, tree: {
      start: {
        id: 'start', speaker: 'Vovó Mochi', mood: 'happy',
        text: 'Você viu a Montanha do Gato? E as cachoeiras? Me conta tudo, querido!',
        options: [{ label: '"Dava pra ver até os templos lá longe!"', nextNodeId: 'end' }],
      },
      end: {
        id: 'end', speaker: 'Vovó Mochi', mood: 'happy',
        text: '*(fecha os olhos e sorri)* Eu consigo ver daqui, do jeito que você contou.\nAmanhã eu subo devagarinho, agora que a escada está firme. Obrigada!',
        options: [{ label: '💛 Eu te ajudo a subir!', nextNodeId: null, action: 'STEP:ponte.voltar' }],
      },
    } },
    { when: { active: 'ponte', notStep: 'ponte.contar' }, tree: say('Vovó Mochi', 'A escada tem 6 degraus quebrados, e cada degrau usa 2 tábuas.\nQuantas tábuas precisamos comprar?', [
      { label: '🧮 Calcular', nextNodeId: null, action: 'CHALLENGE:tabuas_degraus' }, bye('Já volto'),
    ]) },
    { when: { active: 'ponte', step: 'ponte.comprar' }, tree: say('Vovó Mochi', 'Tábuas compradas! Agora é martelar com cuidado. Cuidado com o dedo, querido!') },
    { when: { active: 'ponte' }, tree: say('Vovó Mochi', 'O Boku vende tábuas no mercado. Ele é organizado... e péssimo de conta. Ajude ele!') },
    { when: { notStarted: 'ponte' }, tree: {
      start: {
        id: 'start', speaker: 'Vovó Mochi',
        text: 'Ah, Shinichi. Quando eu era filhote, subia o Mirante do Vento para ver a Montanha do Gato.\nAgora a escada quebrou... e minhas patas não pulam como antes.',
        options: [{ label: '🔨 Eu conserto a escada!', nextNodeId: 'plan', action: 'START:ponte' }, bye('Que pena, vovó')],
      },
      plan: {
        id: 'plan', speaker: 'Vovó Mochi',
        text: 'Que gentil! Mas antes de comprar, vamos planejar: são 6 degraus, 2 tábuas cada.\nQuantas tábuas no total?',
        options: [{ label: '🧮 Calcular', nextNodeId: null, action: 'CHALLENGE:tabuas_degraus' }, bye('Depois')],
      },
    } },
    chatterRoute('Vovó Mochi', [
      'O Mirante fica lindo ao pôr do sol. A escada agora é firme como meu tricô!',
      'Sabia que o primeiro gato ninja tomava chá comigo? Ele odiava açúcar.',
      'Coma bem, durma bem e aprenda algo novo todo dia. É o segredo dos 9 anos de idade... em anos de gato.',
    ]),
  ],
};

const bigodes: NPCDefinition = {
  id: 'bigodes',
  name: 'Seu Bigodes',
  role: 'Peixeiro do mercado',
  position: [9.6, 0, 0.6],
  faceRotation: -Math.PI / 2,
  look: { species: 'cat', fur: '#D98E4A', belly: '#FFE6C7', scale: 1.1, wide: 1.25, stripes: '#B06A2E', accessory: 'vendor' },
  voice: 'meow_low',
  offers: [{ mission: 'peixe_fujao', when: { done: 'peixes' } }],
  barks: ['Peixe fresco! Fresquinho!', 'Opa! Não derruba meus peixes, hein!', 'Olha o atum! Olha o salmão!'],
  routes: [
    { when: { active: 'peixe_fujao', step: 'peixe_fujao.pegar' }, tree: say('Seu Bigodes', 'MEU PEIXE DOURADO! *(abraça o peixe, o peixe abraça de volta?)*\nVocê é mais rápido que vento de feira! Tome aqui, seu prêmio.', [
      { label: '🐟 De nada, Seu Bigodes!', nextNodeId: null, action: 'STEP:peixe_fujao.devolver' },
    ]) },
    { when: { active: 'peixe_fujao' }, tree: say('Seu Bigodes', 'Ele está pulando pelo mercado! Não adianta só correr atrás:\nencurrale ele perto das barracas e das paredes!') },
    { when: { done: 'peixes', notStarted: 'peixe_fujao' }, tree: {
      start: {
        id: 'start', speaker: 'Seu Bigodes', mood: 'surprised',
        text: 'SOCORRO! Meu peixe dourado premiado pulou da banca e está fugindo pelo mercado!\nEle é escorregadio, saltitante e muito convencido!',
        options: [{ label: '🏃 Deixa comigo!', nextNodeId: null, action: 'START:peixe_fujao' }, bye('Que situação...')],
      },
    } },
    chatterRoute('Seu Bigodes', [
      'Peixe fresco é peixe feliz! E peixe feliz... pula. Muito.',
      'Meu bigode tem 30 anos. É mais velho que o Taro.',
      'O segredo do meu atum? Carinho. E gelo. Muito gelo.',
    ]),
  ],
};

const pipo: NPCDefinition = {
  id: 'pipo',
  name: 'Pipo',
  role: 'Filhote brincalhão',
  position: [4.8, 0, 0],
  speed: 3.4,
  patrol: [[4.8, 0, 0], [3.4, 0, 3.4], [0, 0, 4.8], [-3.4, 0, 3.4], [-4.8, 0, 0], [-3.4, 0, -3.4], [0, 0, -4.8], [3.4, 0, -3.4]],
  look: { species: 'cat', fur: '#FFFFFF', belly: '#FFFFFF', scale: 0.72, mask: '#E39B4A', stripes: '#2E2A30', accessory: 'kid' },
  voice: 'meow_high',
  barks: ['Pega-pega! Você tá com ela!', 'Não me pega! Não me pega!', 'Shinichi, me ensina a pular alto?'],
  routes: [
    chatterRoute('Pipo', [
      'Quando eu crescer quero ser ninja igual você! Ou peixeiro. Ou os dois!',
      'Sabia que se você correr em volta da fonte 100 vezes fica tonto? Eu sei porque testei.',
      'O Mestre Lótus disse que eu sou "energético". Acho que é um elogio!',
    ]),
  ],
};

const kuroMirante: NPCDefinition = {
  id: 'kuro_mirante',
  name: 'Kuro',
  role: 'Aprendiz do primeiro gato ninja',
  position: KURO_MIRANTE,
  look: { species: 'cat', fur: '#2A2630', belly: '#3A3542', scale: 1.05, eyes: 'sharp', accessory: 'mystery' },
  voice: 'meow_low',
  visibleWhen: { active: 'lanternas_apagadas', notStep: 'lanternas_apagadas.reacender' },
  routes: [
    { when: { step: 'lanternas_apagadas.kuro' }, tree: say('Kuro', 'Vá. A fonte da praça. Eu... vou olhar daqui de cima.') },
    { when: { step: 'lanternas_apagadas.investigar' }, tree: {
      start: {
        id: 'start', speaker: 'Kuro',
        text: 'Então subiu até aqui. Fui eu, sim. Apaguei as lanternas.\nUm festival inteiro de luz... e nenhuma para o meu mestre.',
        options: [
          { label: '"Por que fazer a vila toda ficar no escuro?"', nextNodeId: 'why' },
          { label: '"Você está bem, Kuro?"', nextNodeId: 'ok' },
        ],
      },
      why: {
        id: 'why', speaker: 'Kuro',
        text: 'Para que sentissem o que eu sinto. Escuridão. Esquecimento.\nO mestre Hoshi protegeu esta vila, e ninguém lembra o nome dele.',
        options: [{ label: '"Eu li o pergaminho. Eu lembro."', nextNodeId: 'idea' }],
      },
      ok: {
        id: 'ok', speaker: 'Kuro', mood: 'sad',
        text: '*(silêncio longo)* ...Ninguém me pergunta isso há muito tempo.\nNão. Não estou bem. Sinto falta dele.',
        options: [{ label: '"Me conta sobre o seu mestre."', nextNodeId: 'idea' }],
      },
      idea: {
        id: 'idea', speaker: 'Shinichi',
        text: 'E se a gente acendesse uma lanterna só para ele? Com o nome dele escrito.\nNa fonte da praça, onde todo mundo passa. A Lanterna da Memória.',
        options: [{ label: '(estender a pata)', nextNodeId: 'end' }],
      },
      end: {
        id: 'end', speaker: 'Kuro',
        text: '*(olha para a sua pata por muito tempo... e aperta)*\nMestre Hoshi. Escreva direito, Detetive. Ele era exigente com caligrafia.',
        options: [{ label: '🏮 Vou acender a Lanterna da Memória.', nextNodeId: null, action: 'STEP:lanternas_apagadas.kuro;FLAG:kuro_amigo' }],
      },
    } },
  ],
};

const kuroPraca: NPCDefinition = {
  id: 'kuro_praca',
  name: 'Kuro',
  role: 'Amigo (meio rabugento)',
  position: [2.6, 0, -2.6],
  faceRotation: -2.4,
  look: kuroMirante.look,
  voice: 'meow_low',
  visibleWhen: { done: 'lanternas_apagadas' },
  barks: ['Hmpf. As lanternas ficaram... bonitas.', 'A caligrafia ficou boa. Para um gato.'],
  routes: [
    chatterRoute('Kuro', [
      'O mestre Hoshi diria que você tem passos leves. Eu digo que você faz barulho. Mas tudo bem.',
      'Talvez eu ensine umas técnicas para o Taro. Ele precisa. MUITO.',
      'Obrigado... por ter perguntado se eu estava bem.',
    ]),
  ],
};

// ── Prompt Mestre cast: three new faces, each with a job in the game ─────────────
/** Liria checks Kiko's machines: she gives a measuring tip during A Máquina Desgovernada. */
const liria: NPCDefinition = {
  id: 'liria',
  name: 'Liria',
  role: 'Inventora cuidadosa',
  position: [10.4, 0, 18.4],
  faceRotation: Math.PI * 0.75,
  look: { species: 'cat', fur: '#8FA3B8', belly: '#DDE6EE', scale: 0.98, accessory: 'tinker' },
  voice: 'meow',
  barks: ['Medir duas vezes, girar uma!', 'Kiko, isso NÃO é seguro!', 'Anotei tudo. Página 47.'],
  routes: [
    { when: { active: 'maquina', notStep: 'maquina.observar' }, tree: say('Liria', 'Antes de mexer em qualquer manivela, eu meço.\nOlhe o transferidor do lançador: onde o braço ESTÁ e onde o Kiko QUER que ele fique.\nA diferença entre os dois é o tanto que falta girar.', [bye('Vou medir!')]) },
    { when: { active: 'maquina', notStep: 'maquina.ajustar' }, tree: say('Liria', 'Anotei aqui: cada clique da manivela gira 5°.\nSe você sabe quantos graus faltam, é só ver quantos "5" cabem nesse número.', [bye('Obrigado, Liria!')]) },
    { when: { active: 'maquina' }, tree: say('Liria', '*(segura a prancheta na frente do rosto)* Pode testar. Eu fico... aqui atrás. Bem atrás.') },
    { when: { done: 'maquina' }, tree: say('Liria', 'Funcionou de primeira porque você CALCULOU antes de girar.\nO Kiko chama isso de sorte. Eu chamo de matemática. 📐', [bye('Boa dupla vocês dois!')]) },
    chatterRoute('Liria', [
      'O Kiko inventa, eu confiro. Ele diz que eu sou o freio. Eu digo que sou o cinto de segurança.',
      'Minha prancheta tem 3 regras: medir, anotar, conferir. A regra 4 é esconder do Kiko.',
      'Já viu um biscoito voador? Eu já. Foi uma terça-feira difícil.',
    ]),
  ],
};

/** Kaito teaches movement: double-jump timing and where the tall-rock paw is. */
const kaito: NPCDefinition = {
  id: 'kaito',
  name: 'Kaito',
  role: 'Especialista em parkour',
  position: [7.6, 0, 33.4],
  faceRotation: Math.PI * 0.6,
  look: { species: 'cat', fur: '#EFE3CF', belly: '#FFF6E8', scale: 0.98, stripes: '#4A3A32', eyes: 'sharp', accessory: 'parkour' },
  voice: 'meow_high',
  barks: ['Olha esse salto! ...Olhou? Não? Vou de novo.', 'Pedra, galho, telhado. Tudo é caminho!', 'Respira, mira, pula!'],
  routes: [
    { when: { notFlag: 'got_paw_3', ability: 'double_jump' }, tree: {
      start: {
        id: 'start', speaker: 'Kaito',
        text: 'Viu aquela pedra alta ali? Tem uma Pata Dourada lá em cima.\nUm salto só não chega. O segredo do salto duplo é o TEMPO.',
        options: [{ label: 'Como assim, tempo?', nextNodeId: 'tip' }, bye('Vou tentar!')],
      },
      tip: {
        id: 'tip', speaker: 'Kaito',
        text: 'Pule e, quando estiver lá no alto, quase parando de subir, aperte o pulo de novo.\nSe apertar cedo demais, você gasta o segundo pulo à toa. Segure o pulo para subir mais!',
        options: [bye('Entendi! No alto da curva!')],
      },
    } },
    { when: { notFlag: 'got_paw_3' }, tree: say('Kaito', 'Aquela pedra alta tem uma Pata Dourada em cima, mas precisa de salto duplo.\nO Mestre Lótus ensina no campo de treino. Depois volta aqui que eu te dou umas dicas!') },
    chatterRoute('Kaito', [
      'Parkour não é pular mais alto que todo mundo. É olhar o caminho antes de correr.',
      'Já caí desta pedra 37 vezes. Na 38ª eu subi. Errar faz parte do treino!',
      'Dica grátis: agachar antes de correr te deixa mais silencioso. Ninjas agradecem.',
    ]),
  ],
};

/** Tsubaki guards the temple: she gives the "same on both sides" hint for A Balança do Templo. */
const tsubaki: NPCDefinition = {
  id: 'tsubaki',
  name: 'Tsubaki',
  role: 'Guardiã do templo',
  position: [3.2, 0, -10.6],
  faceRotation: Math.PI * 0.85,
  look: { species: 'cat', fur: '#3A2E2A', belly: '#F2E6D8', scale: 1.02, mask: '#D9893A', accessory: 'shrine' },
  voice: 'meow',
  barks: ['O templo está em paz.', 'Passos leves no pátio, por favor.', 'As camélias abriram hoje.'],
  offers: [{ mission: 'templo', when: { done: 'balanca' } }],
  routes: [
    // ── Capítulo 4: O Templo dos Enigmas ──
    { when: { active: 'templo', step: 'templo.santuario' }, tree: {
      start: {
        id: 'start', speaker: 'Tsubaki', mood: 'surprised',
        text: 'Você abriu o santuário?! Faz quarenta anos que ninguém lê aquele pergaminho.\n*(lê em voz baixa)* "Quem observa, encontra a regra..."',
        options: [{ label: 'E quem encontra a regra abre qualquer porta!', nextNodeId: 'end' }],
      },
      end: {
        id: 'end', speaker: 'Tsubaki', mood: 'happy',
        text: 'Os espelhos pedem ângulos, a porta pede frações, os gongos pedem padrões.\nNão é magia: é pensar com calma. O templo agora é seu também. Volte quando quiser treinar.',
        options: [{ label: '🏯 Obrigado, Tsubaki!', nextNodeId: null, action: 'STEP:templo.voltar' }],
      },
    } },
    { when: { active: 'templo' }, tree: say('Tsubaki', 'São três enigmas: os Espelhos da Luz (à esquerda), a Porta das Frações (à direita)\ne os Gongos da Sequência (no meio). Cada um tem uma placa com 3 ajudas.\nQuando os três estiverem resolvidos, o santuário se abre.', [bye('Vou lá!')]) },
    { when: { done: 'balanca', notStarted: 'templo' }, tree: {
      start: {
        id: 'start', speaker: 'Tsubaki',
        text: 'O Mestre Kuma me contou da balança. Você pensa antes de agir... isso é raro.\nAtrás do pagode existe o Templo dos Enigmas, fechado há quarenta anos. Quer entrar?',
        options: [
          { label: '🏯 Quero! Abra o portão.', nextNodeId: 'open', action: 'START:templo;STEP:templo.portao;SFX:mechanism' },
          { label: 'Hoje não, Tsubaki.', nextNodeId: null },
        ],
      },
      open: {
        id: 'open', speaker: 'Tsubaki', mood: 'happy',
        text: '*(gira uma chave enorme)* Pronto. O portão fica na cerca, à esquerda do pagode.\nLá dentro: observe tudo antes de mexer em qualquer coisa. E não corra no pátio.',
        options: [bye('Pode deixar!')],
      },
    } },
    { when: { done: 'templo' }, tree: say('Tsubaki', 'Às vezes eu entro no templo só para ver o raio de luz chegar no cristal.\nVocê fez aquilo parecer fácil. Não era.') },
    { when: { active: 'balanca', notStep: 'balanca.pedras' }, tree: say('Tsubaki', 'A balança do templo nunca mente.\nSe ela está equilibrada, os dois lados pesam igual. Comece por aí: o que está de cada lado?', [bye('Vou olhar a balança.')]) },
    { when: { active: 'balanca' }, tree: say('Tsubaki', 'Um segredo das guardiãs: se você tirar o MESMO peso dos dois lados, a balança continua equilibrada.\nTire o que você já conhece e veja o que sobra para as pedras.', [bye('Obrigado, Tsubaki!')]) },
    chatterRoute('Tsubaki', [
      'Guardar um templo é 1% enfrentar perigos e 99% varrer folhas.',
      'Esta naginata é de madeira. Serve para treinar... e para alcançar as lanternas altas.',
      'Meu nome quer dizer camélia. Ela floresce no inverno, quando nada mais floresce.',
    ]),
  ],
};

export const NEW_NPCS: NPCDefinition[] = [mochi, bigodes, pipo, kuroMirante, kuroPraca, liria, kaito, tsubaki];
