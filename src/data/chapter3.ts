import type { Challenge, Condition, DialogueOption, DialogueRoute, DialogueTree, Item, Mission } from '../types';
import type { WorldObject } from './world';

/**
 * Capítulo 3, "Os Saberes da Vila": 6th-grade math inside village life, plus a mission about
 * empathy. Every challenge is recomputed by tests/chapter3.test.ts and has three-step help.
 *
 *   banquete  Seu Bigodes   divisão com resto
 *   pocao     Luna          proporções
 *   maquina   Kiko          ângulos
 *   fatias    Chef Hana     frações
 *   horta     Vovó Mochi    perímetro e área
 *   balanca   Mestre Kuma   raciocínio algébrico
 *   rival     Taro          empatia e cooperação
 */

const bye = (label = 'Até mais!'): DialogueOption => ({ label, nextNodeId: null });
const say = (speaker: string, text: string, options: DialogueOption[] = [bye()]): DialogueTree => ({
  start: { id: 'start', speaker, text, options },
});

// ── Places (free ground checked with the physics world, dev/qa.ts findSpace) ──
export const HORTA = { x: 8, z: 19.25, w: 6, d: 4 };
export const LAUNCHER = { x: 13.5, z: 12.5, basketX: 10.5 };
export const BALANCE: [number, number, number] = [-2.5, 0, -11.5];
export const PIE: [number, number, number] = [-3.7, 0, -2.3];
const FLOWERS: [number, number, number][] = [[4, 0, 34], [1.5, 0, 29.5], [-3, 0, 36.5]];

// ── Items ─────────────────────────────────────────────────────────────────────
export const CHAPTER3_ITEMS: Item[] = [
  { id: 'bolinho', name: 'Bolinho de Peixe', icon: '🍥', description: 'Do banquete do Seu Bigodes. Sobraram 2, e eles têm destino certo.' },
  { id: 'flor_camomila', name: 'Flor de Camomila', icon: '🌼', description: 'A Luna usa para chás calmantes. Cheirinho de sossego.' },
  { id: 'pocao_luna', name: 'Chá Calmante da Luna', icon: '🍵', description: '3 xícaras de chá para cada 2 colheres de mel. Proporção é tudo!' },
  { id: 'fatia_torta', name: 'Fatia de Torta', icon: '🥧', description: '1/8 da torta de peixe da Chef Hana. Ainda quentinha.' },
];

// ── Challenges ────────────────────────────────────────────────────────────────
export const CHAPTER3_CHALLENGES: Challenge[] = [
  {
    id: 'banquete_divisao', skill: 'divisao', kind: 'number', title: 'O Banquete dos Bigodes',
    story: 'O Seu Bigodes fez 50 bolinhos de peixe para os 8 gatos da patrulha.\nTodos precisam ganhar a MESMA quantidade, e ninguém parte bolinho ao meio.',
    question: 'Quantos bolinhos cada gato ganha?',
    answer: 6,
    observe: 'Todos ganham o mesmo e nenhum bolinho é partido. Distribua em rodadas: uma rodada dá 1 bolinho para cada um dos 8 gatos.',
    hint: 'Cada rodada gasta 8 bolinhos: 8, 16, 24, 32, 40, 48... a próxima passaria de 50.\nQuantas rodadas completas couberam?',
    example: 'Parecido: 17 balas para 5 crianças.\nRodadas de 5: 5, 10, 15 → 3 rodadas completas (a próxima seria 20, passa de 17). Cada criança ganha 3.',
    successText: '🍥 Isso! 6 bolinhos para cada gato da patrulha.\nMas... 8 gatos × 6 bolinhos não dá 50. Sobrou alguma coisa?',
    onSuccess: 'STEP:banquete.dividir',
  },
  {
    id: 'banquete_resto', skill: 'divisao', kind: 'number', title: 'O Que Sobrou?',
    story: 'Cada um dos 8 gatos ganhou 6 bolinhos.\nMas o Seu Bigodes tinha feito 50.',
    question: 'Quantos bolinhos sobram?',
    answer: 2,
    observe: 'Primeiro descubra quantos bolinhos já foram entregues: 8 gatos, 6 bolinhos cada.',
    hint: '8 × 6 é o que já foi entregue. Agora conte quanto falta dali até 50.',
    example: 'Parecido: 19 balas, 5 crianças com 3 balas cada.\n5 × 3 = 15 entregues; de 15 até 19 faltam 4. Sobram 4 balas: esse é o RESTO da divisão.',
    successText: '🍥 Sobram 2 bolinhos! Em matemática isso se chama RESTO:\n50 ÷ 8 dá 6 e sobram 2.',
    onSuccess: 'STEP:banquete.sobras;GIVE:bolinho:2',
  },
  {
    id: 'pocao_proporcao', skill: 'proporcoes', kind: 'number', title: 'O Chá da Luna',
    story: 'Na receita da Luna, para cada 3 xícaras de chá de camomila entram 2 colheres de mel.\nEla preparou 9 xícaras de chá.',
    question: 'Quantas colheres de mel ela deve usar?',
    answer: 6,
    observe: 'A receita anda em "pacotinhos": 3 xícaras de chá sempre vêm junto com 2 colheres de mel.',
    hint: 'Quantos pacotinhos de 3 xícaras cabem em 9 xícaras? Cada pacotinho pede 2 colheres.',
    example: 'Parecido: para cada 2 ovos vão 5 colheres de farinha.\nCom 6 ovos são 3 pacotinhos de 2 ovos, então 3 × 5 = 15 colheres de farinha.',
    successText: '🍯 Isso! 9 xícaras são 3 pacotinhos, e 3 × 2 = 6 colheres.\nO chá ficou docinho na medida certa.',
    onSuccess: 'STEP:pocao.misturar',
  },
  {
    id: 'pocao_total', skill: 'proporcoes', kind: 'number', title: 'O Pote Inteiro',
    story: 'A Luna quer usar o pote inteiro: 8 colheres de mel.\nA receita continua a mesma: 2 colheres de mel para cada 3 xícaras de chá.',
    question: 'Quantas xícaras de chá ela precisa?',
    answer: 12,
    observe: 'A proporção não muda: 2 colheres de mel sempre andam com 3 xícaras de chá.',
    hint: 'Quantos grupos de 2 colheres cabem em 8 colheres? Cada grupo pede 3 xícaras.',
    example: 'Parecido: 5 colheres de farinha para cada 2 ovos.\nCom 20 colheres de farinha são 4 grupos de 5, então 4 × 2 = 8 ovos.',
    successText: '🍵 12 xícaras! Mais mel pede mais chá, sempre na mesma proporção.',
    onSuccess: 'STEP:pocao.dobrar;GIVE:pocao_luna',
  },
  {
    id: 'maquina_giro', skill: 'geometria', kind: 'number', title: 'O Braço Torto',
    story: 'O braço do lançador do Kiko está inclinado 30° acima do chão.\nPara a bola cair dentro da cesta, ele precisa ficar a 45°.',
    question: 'Quantos graus o braço precisa subir?',
    answer: 15,
    observe: 'O braço já está em 30°. Queremos a DIFERENÇA entre onde ele está e onde precisa chegar.',
    hint: 'Conte de 30° até 45° de 5 em 5: 35, 40, 45... quantos graus você andou?',
    example: 'Parecido: um ponteiro em 20° precisa chegar a 60°.\nEle sobe 60 − 20 = 40 graus.',
    successText: '📐 Isso! Do 30° ao 45° são 15 graus a mais.',
    onSuccess: 'STEP:maquina.observar',
  },
  {
    id: 'maquina_cliques', skill: 'geometria', kind: 'number', title: 'A Manivela',
    story: 'A manivela do lançador gira o braço 5° a cada clique.\nFaltam 15° para o braço chegar aos 45°.',
    question: 'Quantos cliques na manivela?',
    answer: 3,
    observe: 'Cada clique é um pedacinho de 5°. Quantos pedacinhos formam o giro todo?',
    hint: 'Conte de 5 em 5 até chegar nos 15°, contando os cliques nos dedos.',
    example: 'Parecido: se cada clique girasse 10° e faltassem 40°,\nseriam 10, 20, 30, 40 → 4 cliques.',
    successText: '🔧 Clique, clique, clique! O braço está em 45°. Agora é testar!',
    onSuccess: 'FLAG:lancador_ajustado;STEP:maquina.ajustar',
  },
  {
    id: 'fatias_sobra', skill: 'fracoes', kind: 'choice', title: 'A Torta Fatiada',
    story: 'A torta de peixe da Chef Hana foi cortada em 8 fatias iguais.\nTaro, Boku e Pipo comeram uma fatia cada. (Dá para contar na bandeja!)',
    question: 'Que fração da torta SOBROU?',
    choices: ['3/8', '5/8', '8/5', '1/8'],
    answer: 1,
    observe: 'A torta inteira tem 8 fatias iguais, então cada fatia é 1/8. Conte as fatias que ainda estão na bandeja.',
    hint: 'Comeram 3 das 8 fatias. Na fração, o número de baixo é o total de fatias e o de cima, as que sobraram.',
    example: 'Parecido: uma pizza em 6 fatias, 2 foram comidas.\nSobram 4 de 6 fatias: 4/6 da pizza.',
    successText: '🥧 5/8! De 8 fatias, 5 continuam na bandeja.',
    onSuccess: 'STEP:fatias.contar',
  },
  {
    id: 'fatias_metade', skill: 'fracoes', kind: 'choice', title: 'Metade para o Festival',
    story: 'A Hana quer guardar METADE da torta inteira (das 8 fatias) para o festival.',
    question: 'Qual fração é igual à metade da torta?',
    choices: ['1/8', '2/8', '4/8', '6/8'],
    answer: 2,
    observe: 'Metade é dividir em 2 partes iguais. Quantas das 8 fatias formam uma dessas partes?',
    hint: '8 fatias em 2 partes iguais: cada parte tem quantas fatias? Esse número vai em cima da fração.',
    example: 'Parecido: uma barra de chocolate com 10 quadradinhos.\nMetade são 5 quadradinhos: 5/10 da barra.',
    successText: '🥧 4/8 é a metade! Frações diferentes podem valer o mesmo: 4/8 = 1/2.',
    onSuccess: 'STEP:fatias.metade;GIVE:fatia_torta',
  },
  {
    id: 'horta_perimetro', skill: 'geometria', kind: 'number', title: 'A Cerca da Horta',
    story: 'A horta da Vovó Mochi é um retângulo de 6 metros por 4 metros.\nEla quer uma cerca em volta toda. (As estacas ficam a 1 metro uma da outra: dá para contar!)',
    question: 'Quantos metros de cerca?',
    answer: 20,
    observe: 'A cerca passa pelos 4 lados: dois lados de 6 m e dois lados de 4 m.',
    hint: 'Ande em volta somando os lados, um de cada vez: 6 + 4 + ...',
    example: 'Parecido: um tapete de 3 m por 2 m.\nContorno: 3 + 2 + 3 + 2 = 10 metros. Isso se chama PERÍMETRO.',
    successText: '🌱 20 metros de cerca: 6 + 4 + 6 + 4. Esse contorno é o PERÍMETRO.',
    onSuccess: 'STEP:horta.cerca',
  },
  {
    id: 'horta_area', skill: 'geometria', kind: 'number', title: 'As Mudas',
    story: 'A horta foi dividida em quadradinhos de 1 m por 1 m, e cada quadradinho recebe uma muda.',
    question: 'Quantas mudas cabem na horta de 6 m × 4 m?',
    answer: 24,
    observe: 'Os quadradinhos formam fileiras. Quantos cabem em cada fileira, e quantas fileiras são?',
    hint: 'São 4 fileiras com 6 quadradinhos em cada uma. Some as fileiras ou multiplique.',
    example: 'Parecido: um tapete de 3 m por 2 m tem 2 fileiras de 3 quadradinhos.\n3 + 3 = 6, ou 3 × 2 = 6 metros quadrados. Isso se chama ÁREA.',
    successText: '🌱 24 mudas! 6 × 4 = 24 quadradinhos de 1 m²: essa é a ÁREA da horta.',
    onSuccess: 'STEP:horta.mudas',
  },
  {
    id: 'balanca_pedra', skill: 'algebra', kind: 'number', title: 'A Balança do Templo',
    story: 'Na balança do templo, 3 pedras iguais mais um peso de 4 equilibram um peso de 19.',
    question: 'Quanto pesa cada pedra?',
    answer: 5,
    observe: 'A balança está equilibrada: os dois lados pesam o mesmo. Tire o peso de 4 dos DOIS lados.',
    hint: 'Sem o 4, as 3 pedras pesam 19 − 4. Agora reparta esse peso entre as 3 pedras.',
    example: 'Parecido: 2 pedras + 3 = 11. Tirando 3 dos dois lados: 2 pedras = 8.\nCada pedra pesa 8 ÷ 2 = 4.',
    successText: '⚖️ Cada pedra pesa 5! 3 × 5 + 4 = 19. A balança agradece.',
    onSuccess: 'STEP:balanca.pedras',
  },
  {
    id: 'balanca_mista', skill: 'algebra', kind: 'number', title: 'O Número Escondido',
    story: 'O Mestre Kuma escreveu na areia: "o dobro de um número, mais 3, dá 11".',
    question: 'Que número é esse?',
    answer: 4,
    observe: 'Faça o caminho de volta: o que foi feito por último (mais 3) é o primeiro a ser desfeito.',
    hint: '11 − 3 é o dobro do número. Agora divida por 2.',
    example: 'Parecido: "o triplo de um número, mais 1, dá 16".\n16 − 1 = 15, e 15 ÷ 3 = 5.',
    successText: '🔢 O número é 4: 2 × 4 + 3 = 11. Desfazer as contas de trás para frente é um superpoder!',
    onSuccess: 'STEP:balanca.desafio',
  },
];

// ── Missions ──────────────────────────────────────────────────────────────────
export const CHAPTER3_MISSIONS: Mission[] = [
  {
    id: 'banquete', chapter: 3, title: 'O Banquete dos Bigodes', category: 'educativa', giver: 'bigodes',
    description: 'O Seu Bigodes fez bolinhos para a patrulha do Roku. Dividir igualmente parece fácil... até sobrar alguma coisa.',
    steps: [
      { id: 'dividir', description: 'Divida os bolinhos com o Seu Bigodes', target: { npc: 'bigodes' } },
      { id: 'sobras', description: 'Descubra quantos bolinhos sobram', target: { npc: 'bigodes' } },
      { id: 'entregar', description: 'Leve as sobras para a Dona Neko, que mora sozinha', target: { npc: 'neko' } },
      { id: 'voltar', description: 'Conte ao Seu Bigodes para onde foram as sobras', target: { npc: 'bigodes' } },
    ],
    rewards: { xp: 55, coins: 20, gems: 2, badges: ['Mestre do Resto'] },
    lesson: 'Nem toda divisão é exata: o que sobra se chama RESTO. E um resto bem usado pode alegrar alguém.',
  },
  {
    id: 'pocao', chapter: 3, title: 'O Chá Calmante da Luna', category: 'educativa', giver: 'mei_floresta',
    description: 'A Luna está aprendendo a ser curandeira. O chá dela precisa da proporção certa: nem doce demais, nem amargo.',
    steps: [
      { id: 'flores', description: 'Colha flores de camomila pela floresta', counter: { id: 'flores_luna', goal: 3 } },
      { id: 'misturar', description: 'Ajude a Luna a medir o mel', target: { npc: 'mei_floresta' } },
      { id: 'dobrar', description: 'Calcule o chá para o pote inteiro de mel', target: { npc: 'mei_floresta' } },
      { id: 'entregar', description: 'Leve o chá ao Guarda Roku, que anda nervoso', target: { npc: 'roku' } },
    ],
    rewards: { xp: 60, coins: 15, gems: 2, badges: ['Aprendiz de Curandeiro'] },
    lesson: 'Proporção é manter a mesma relação: se o chá dobra, o mel dobra junto.',
  },
  {
    id: 'maquina', chapter: 3, title: 'A Máquina Desgovernada', category: 'educativa', giver: 'kiko',
    description: 'O lançador de peixes do Kiko erra a cesta. Tudo por causa de um ângulo torto.',
    steps: [
      { id: 'observar', description: 'Observe o lançador e descubra quanto o braço precisa subir', target: { object: 'lancador_kiko' } },
      { id: 'ajustar', description: 'Ajuste o braço girando a manivela', target: { object: 'lancador_kiko' } },
      { id: 'testar', description: 'Teste o lançador', target: { object: 'lancador_kiko' } },
      { id: 'voltar', description: 'Conte ao Kiko que funcionou', target: { npc: 'kiko' } },
    ],
    rewards: { xp: 60, coins: 20, gems: 2, badges: ['Engenheiro de Ângulos'] },
    lesson: 'Ângulos medem giros. Antes de girar, descubra a diferença entre onde está e onde quer chegar.',
  },
  {
    id: 'fatias', chapter: 3, title: 'A Torta Fatiada', category: 'educativa', giver: 'chef_tofu',
    description: 'A Chef Hana fez uma torta de peixe, e alguns gatos não resistiram. Quanto sobrou?',
    steps: [
      { id: 'contar', description: 'Conte as fatias que sobraram na bandeja', target: { npc: 'chef_tofu' } },
      { id: 'metade', description: 'Separe metade da torta para o festival', target: { npc: 'chef_tofu' } },
      { id: 'entregar', description: 'Leve uma fatia ao Guarda Roku', target: { npc: 'roku' } },
    ],
    rewards: { xp: 50, coins: 15, gems: 2, badges: ['Fatiador de Frações'] },
    lesson: 'Frações contam partes de um inteiro. E frações diferentes podem valer o mesmo: 4/8 é metade, assim como 1/2.',
  },
  {
    id: 'horta', chapter: 3, title: 'A Horta da Vovó Mochi', category: 'educativa', giver: 'mochi',
    description: 'A Vovó Mochi quer plantar uma horta no canteiro de terra perto do rio, ao lado da Sora. Quanto de cerca? Quantas mudas?',
    steps: [
      { id: 'ver', description: 'Vá até o canteiro de terra perto do rio, ao lado da Sora', target: { object: 'horta_mochi' } },
      { id: 'cerca', description: 'Calcule a cerca em volta da horta', target: { object: 'horta_mochi' } },
      { id: 'mudas', description: 'Calcule quantas mudas cabem', target: { object: 'horta_mochi' } },
      { id: 'voltar', description: 'Conte à Vovó Mochi', target: { npc: 'mochi' } },
    ],
    rewards: { xp: 60, coins: 20, gems: 2, badges: ['Agrimensor Felino'] },
    lesson: 'Perímetro é o contorno (some os lados). Área é o espaço de dentro (conte os quadradinhos ou multiplique).',
  },
  {
    id: 'balanca', chapter: 3, title: 'A Balança do Templo', category: 'investigação', giver: 'mestre_kuma',
    description: 'O Mestre Kuma guarda uma balança antiga. Ele diz que ela ensina a pensar de trás para frente.',
    steps: [
      { id: 'pedras', description: 'Descubra o peso de cada pedra na balança', target: { object: 'balanca_templo' } },
      { id: 'desafio', description: 'Resolva o número escondido do Mestre Kuma', target: { object: 'balanca_templo' } },
      { id: 'voltar', description: 'Volte ao Mestre Kuma', target: { npc: 'mestre_kuma' } },
    ],
    rewards: { xp: 70, coins: 20, gems: 3, badges: ['Pensador Equilibrado'] },
    lesson: 'Numa balança equilibrada, o que você faz de um lado faz do outro. Assim dá para descobrir o que está escondido.',
  },
  {
    id: 'rival', chapter: 3, title: 'O Rival que Precisava de Ajuda', category: 'secundária', giver: 'taro',
    description: 'O Taro perdeu a corrida das argolas para a Luna e anda emburrado pela vila. Será que ele precisa de um amigo?',
    steps: [
      { id: 'ouvir', description: 'Converse com o Taro (escute antes de falar)', target: { npc: 'taro' } },
      { id: 'conselho', description: 'Peça um conselho ao Mestre Lótus', target: { npc: 'lotus' } },
      { id: 'juntos', description: 'Convide o Taro para treinar junto', target: { npc: 'taro' } },
    ],
    rewards: { xp: 50, coins: 10, gems: 1, badges: ['Amigo do Rival'] },
    lesson: 'Perder dói, e esconder a tristeza não faz ela sumir. Escutar, sem zoar, é o primeiro passo para ajudar.',
  },
];

// ── Dialogue routes added to existing villagers ───────────────────────────────
export interface Chapter3Routes {
  active: DialogueRoute[];
  offers: DialogueRoute[];
  offerMeta: { mission: string; when?: Condition }[];
}

export const CHAPTER3_ROUTES: Record<string, Chapter3Routes> = {
  bigodes: {
    active: [
      { when: { active: 'banquete', step: 'banquete.entregar' }, tree: say('Seu Bigodes', 'A Dona Neko comeu os bolinhos? E sorriu? *(enxuga uma lágrima)*\nO resto da divisão virou o melhor pedaço do banquete.', [
        { label: '🍥 O resto foi o melhor!', nextNodeId: null, action: 'STEP:banquete.voltar' },
      ]) },
      { when: { active: 'banquete', step: 'banquete.sobras' }, tree: say('Seu Bigodes', 'Dois bolinhos sobrando... A Dona Neko mora sozinha perto do galpão, a oeste.\nLeva para ela? Ela adora peixe.') },
      { when: { active: 'banquete', step: 'banquete.dividir' }, tree: say('Seu Bigodes', 'Seis para cada um, certo. Mas eu fiz 50! Sobrou alguma coisa?', [
        { label: '🧮 Calcular as sobras', nextNodeId: null, action: 'CHALLENGE:banquete_resto' }, bye('Já volto'),
      ]) },
      { when: { active: 'banquete' }, tree: say('Seu Bigodes', '50 bolinhos, 8 gatos da patrulha, todos iguais e ninguém parte bolinho!\nQuantos cada um ganha?', [
        { label: '🧮 Dividir os bolinhos', nextNodeId: null, action: 'CHALLENGE:banquete_divisao' }, bye('Já volto'),
      ]) },
    ],
    offers: [
      { when: { done: 'peixes', notStarted: 'banquete' }, tree: {
        start: {
          id: 'start', speaker: 'Seu Bigodes', mood: 'surprised',
          text: 'Shinichi! Fiz 50 bolinhos de peixe para os 8 gatos da patrulha do Roku.\nTodo mundo tem que ganhar igual, senão vira briga. Me ajuda a dividir?',
          options: [{ label: '🍥 Eu ajudo!', nextNodeId: null, action: 'START:banquete' }, bye('Depois')],
        },
      } },
    ],
    offerMeta: [{ mission: 'banquete', when: { done: 'peixes' } }],
  },
  neko: {
    active: [
      { when: { active: 'banquete', step: 'banquete.sobras', notStep: 'banquete.entregar' }, tree: {
        start: {
          id: 'start', speaker: 'Dona Neko', mood: 'surprised',
          text: '*(acorda)* Hm? Bolinhos do Bigodes? Para MIM?\nFaz tempo que ninguém lembra de mim no banquete...',
          options: [{ label: '🍥 Sobraram 2. Pensei em você.', nextNodeId: 'end', action: 'TAKE:bolinho:2' }],
        },
        end: {
          id: 'end', speaker: 'Dona Neko', mood: 'happy',
          text: '*(come devagarinho, de olhos fechados)* Hmmm. Obrigada, filhote.\nO resto da conta foi parar no lugar certo.',
          options: [{ label: '💛 Bom apetite!', nextNodeId: null, action: 'STEP:banquete.entregar' }],
        },
      } },
    ],
    offers: [],
    offerMeta: [],
  },
  mei_floresta: {
    active: [
      { when: { active: 'pocao', step: 'pocao.dobrar' }, tree: say('Luna', 'O chá ficou perfeito! O Guarda Roku anda tão nervoso... leva para ele?\n*(sussurra)* Diz que fui eu que fiz.') },
      { when: { active: 'pocao', step: 'pocao.misturar' }, tree: say('Luna', 'Agora quero usar o pote inteiro: 8 colheres de mel.\nQuantas xícaras de chá precisamos, sem mudar o sabor?', [
        { label: '🧮 Calcular o chá', nextNodeId: null, action: 'CHALLENGE:pocao_total' }, bye('Já volto'),
      ]) },
      { when: { active: 'pocao', step: 'pocao.flores' }, tree: say('Luna', 'As flores! Fiz 9 xícaras de chá. A receita pede 2 colheres de mel para cada 3 xícaras.\nQuantas colheres eu ponho?', [
        { label: '🧮 Medir o mel', nextNodeId: null, action: 'CHALLENGE:pocao_proporcao' }, bye('Já volto'),
      ]) },
      { when: { active: 'pocao' }, tree: say('Luna', 'As camomilas crescem aqui pela floresta, perto das argolas e do campinho.\nPreciso de 3. Use o faro (4) se não achar!') },
    ],
    offers: [
      { when: { done: 'mei_coragem', notStarted: 'pocao' }, tree: {
        start: {
          id: 'start', speaker: 'Luna', mood: 'happy',
          text: 'Shinichi! Depois que você me ajudou com o medo, comecei a estudar para ser curandeira.\nVou fazer um chá calmante, mas a proporção tem que ser certinha. Me ajuda?',
          options: [{ label: '🌼 Vamos fazer o chá!', nextNodeId: null, action: 'START:pocao' }, bye('Depois')],
        },
      } },
    ],
    offerMeta: [{ mission: 'pocao', when: { done: 'mei_coragem' } }],
  },
  roku: {
    active: [
      { when: { active: 'pocao', step: 'pocao.dobrar', notStep: 'pocao.entregar' }, tree: say('Guarda Roku', 'Um chá? Feito pela Luna? *(bebe)* ...Ahhh. Meu bigode parou de tremer.\nDiga a ela que é o melhor chá da vila. E que eu NÃO estava nervoso.', [
        { label: '🍵 Pode deixar', nextNodeId: null, action: 'TAKE:pocao_luna;STEP:pocao.entregar' },
      ]) },
      { when: { active: 'fatias', step: 'fatias.metade', notStep: 'fatias.entregar' }, tree: say('Guarda Roku', 'Uma fatia de torta? Para o guarda que protege a vila dia e noite?\n*(come em duas mordidas)* Isso foi... 1/8 de felicidade!', [
        { label: '🥧 Bom apetite, Roku!', nextNodeId: null, action: 'TAKE:fatia_torta;STEP:fatias.entregar' },
      ]) },
    ],
    offers: [],
    offerMeta: [],
  },
  kiko: {
    active: [
      { when: { active: 'maquina', step: 'maquina.testar' }, tree: say('Kiko', 'CAIU NA CESTA?! *(dança)* 45 graus! Eu sabia que era um problema de ângulo.\n...Eu não sabia. Mas agora sei!', [
        { label: '📐 Era só girar 15°!', nextNodeId: null, action: 'STEP:maquina.voltar' },
      ]) },
      { when: { active: 'maquina' }, tree: say('Kiko', 'O lançador fica ali perto da minha casa. O braço está torto, a bola voa para todo lado!\nOlha bem o ângulo dele.') },
    ],
    offers: [
      { when: { done: 'inventor', notStarted: 'maquina' }, tree: {
        start: {
          id: 'start', speaker: 'Kiko', mood: 'surprised',
          text: 'Shinichi! Inventei um lançador de peixes para encher a cesta da cantina.\nSó que ele acerta tudo... MENOS a cesta. Acho que o ângulo está errado.',
          options: [{ label: '📐 Vamos consertar!', nextNodeId: null, action: 'START:maquina' }, bye('Depois')],
        },
      } },
    ],
    offerMeta: [{ mission: 'maquina', when: { done: 'inventor' } }],
  },
  chef_tofu: {
    active: [
      { when: { active: 'fatias', step: 'fatias.metade' }, tree: say('Chef Hana', 'Metade guardada para o festival! Leva aquela fatia para o Guarda Roku?\nEle anda tão sério na patrulha...') },
      { when: { active: 'fatias', step: 'fatias.contar' }, tree: say('Chef Hana', 'Agora quero guardar METADE da torta inteira para o festival.\nQue fração é a metade das 8 fatias?', [
        { label: '🧮 Escolher a fração', nextNodeId: null, action: 'CHALLENGE:fatias_metade' }, bye('Já volto'),
      ]) },
      { when: { active: 'fatias' }, tree: say('Chef Hana', 'A torta está na bandeja, bem ali. Taro, Boku e Pipo comeram uma fatia cada!\nQue fração da torta sobrou?', [
        { label: '🧮 Contar as fatias', nextNodeId: null, action: 'CHALLENGE:fatias_sobra' }, bye('Já volto'),
      ]) },
    ],
    offers: [
      { when: { done: 'receita', notStarted: 'fatias' }, tree: {
        start: {
          id: 'start', speaker: 'Chef Hana', mood: 'surprised',
          text: 'Shinichi! Fiz uma torta de peixe em 8 fatias e virei as costas por UM minuto...\nTaro, Boku e Pipo atacaram! Me ajuda a fazer as contas do que sobrou?',
          options: [{ label: '🥧 Vamos contar!', nextNodeId: null, action: 'START:fatias' }, bye('Depois')],
        },
      } },
    ],
    offerMeta: [{ mission: 'fatias', when: { done: 'receita' } }],
  },
  mochi: {
    active: [
      { when: { active: 'horta', step: 'horta.mudas' }, tree: say('Vovó Mochi', '20 metros de cerca e 24 mudas! *(bate palminhas)* Vou plantar cenoura, abóbora e erva-de-gato.\nVocê é um anjo, querido. Um anjo ninja.', [
        { label: '🌱 Boa colheita, vovó!', nextNodeId: null, action: 'STEP:horta.voltar' },
      ]) },
      { when: { active: 'horta' }, tree: say('Vovó Mochi', 'A horta fica no canteiro de terra perto do rio, ao lado da Sora. Tem estacas a cada metro.\nVá lá medir para mim, minhas pernas já não andam tanto.') },
    ],
    offers: [
      { when: { done: 'ponte', notStarted: 'horta' }, tree: {
        start: {
          id: 'start', speaker: 'Vovó Mochi', mood: 'happy',
          text: 'Querido, depois de ver a vila lá do Mirante, deu vontade de plantar!\nMarquei uma horta de 6 por 4 metros. Quanto de cerca eu compro? Quantas mudas?',
          options: [{ label: '🌱 Eu meço para você!', nextNodeId: null, action: 'START:horta' }, bye('Depois')],
        },
      } },
    ],
    offerMeta: [{ mission: 'horta', when: { done: 'ponte' } }],
  },
  mestre_kuma: {
    active: [
      { when: { active: 'balanca', step: 'balanca.desafio' }, tree: say('Mestre Kuma', 'Hmm. Você desfez as contas de trás para frente.\nÉ assim que se acha o que está escondido: equilibrando, passo a passo.', [
        { label: '⚖️ Obrigado, Mestre.', nextNodeId: null, action: 'STEP:balanca.voltar' },
      ]) },
      { when: { active: 'balanca' }, tree: say('Mestre Kuma', 'A balança está ao lado do templo. Observe. Ela nunca mente.') },
    ],
    offers: [
      { when: { done: 'lanternas', notStarted: 'balanca' }, tree: {
        start: {
          id: 'start', speaker: 'Mestre Kuma',
          text: 'Hmm. Você enxerga padrões. Agora quero ver se enxerga o que está ESCONDIDO.\nAo lado do templo há uma balança antiga. Equilíbrio é uma forma de verdade.',
          options: [{ label: '⚖️ Vou até a balança', nextNodeId: null, action: 'START:balanca' }, bye('Depois')],
        },
      } },
    ],
    offerMeta: [{ mission: 'balanca', when: { done: 'lanternas' } }],
  },
  lotus: {
    active: [
      { when: { active: 'rival', step: 'rival.ouvir', notStep: 'rival.conselho' }, tree: {
        start: {
          id: 'start', speaker: 'Mestre Lótus',
          text: 'O Taro? Hmpf. Perder dói mais em quem quer muito vencer.\nAjudar não é fazer por ele, nem dizer que ele é o melhor. É ficar do lado enquanto ele tenta de novo.',
          options: [{ label: '🙇 Entendi, Mestre.', nextNodeId: null, action: 'STEP:rival.conselho' }],
        },
      } },
    ],
    offers: [],
    offerMeta: [],
  },
  taro: {
    active: [
      { when: { active: 'rival', step: 'rival.conselho' }, tree: {
        start: {
          id: 'start', speaker: 'Taro',
          text: 'Você de novo. ...Tá. Eu treino com você. MAS se eu errar a argola, você não ri.',
          options: [
            { label: '"Prometido. E se eu errar, você também não ri."', nextNodeId: 'deal' },
            { label: '"Relaxa, você vai ganhar fácil da próxima vez."', nextNodeId: 'easy' },
          ],
        },
        easy: {
          id: 'easy', speaker: 'Taro', mood: 'sad',
          text: '"Fácil"? Eu treinei MUITO e perdi. Não é fácil. *(cruza os braços)*',
          options: [{ label: '"Desculpa. Não é fácil mesmo. Vamos treinar juntos?"', nextNodeId: 'deal' }],
        },
        deal: {
          id: 'deal', speaker: 'Taro', mood: 'happy',
          text: '*(meio sorriso)* Combinado. Rival e parceiro de treino.\nE vou contar para a Luna que ela foi muito bem. Mas só um pouquinho.',
          options: [{ label: '🤝 Parceiros de treino!', nextNodeId: null, action: 'STEP:rival.juntos' }],
        },
      } },
      { when: { active: 'rival', step: 'rival.ouvir' }, tree: say('Taro', 'Já falou com o Mestre Lótus? Não que eu me importe. Só perguntando.') },
      { when: { active: 'rival' }, tree: {
        start: {
          id: 'start', speaker: 'Taro', mood: 'angry',
          text: 'O que foi? Veio rir porque a Luna ganhou a corrida das argolas? Pode rir. Eu nem ligo.',
          options: [
            { label: '"Hahaha, perdeu para a Luna!"', nextNodeId: 'tease' },
            { label: '"Parece que você liga, sim. Quer falar sobre isso?"', nextNodeId: 'listen' },
            { label: '(ir embora sem dizer nada)', nextNodeId: null },
          ],
        },
        tease: {
          id: 'tease', speaker: 'Taro', mood: 'sad',
          text: '*(abaixa as orelhas)* ...Valeu. Era exatamente isso que eu precisava ouvir.',
          options: [{ label: '"Desculpa, Taro. Isso foi feio. Quer falar sobre isso?"', nextNodeId: 'listen' }],
        },
        listen: {
          id: 'listen', speaker: 'Taro', mood: 'sad',
          text: '*(silêncio)* ...Eu treinei todo dia. Achei que ia ganhar.\nE se eu nunca for bom o suficiente?',
          options: [{ label: '"Vou pedir um conselho ao Mestre Lótus. Já volto."', nextNodeId: null, action: 'STEP:rival.ouvir' }],
        },
      } },
    ],
    offers: [
      { when: { done: 'chuva_peixes', notStarted: 'rival' }, tree: say('Taro', '*(chuta uma pedrinha)* Hmph. Não estou de mau humor. Por que perguntaria isso?', [
        { label: '👂 "Aconteceu alguma coisa?"', nextNodeId: null, action: 'START:rival' }, bye('Deixar ele sozinho'),
      ]) },
    ],
    offerMeta: [{ mission: 'rival', when: { done: 'chuva_peixes' } }],
  },
};

// ── World objects ─────────────────────────────────────────────────────────────
export const CHAPTER3_OBJECTS: WorldObject[] = [
  ...FLOWERS.map((pos, i): WorldObject => ({
    id: `flor_${i}`,
    kind: 'pickup_herb',
    position: pos,
    label: 'Flor de camomila',
    when: { active: 'pocao' },
    hideWhen: { flag: `got_flor_${i}` },
    actions: `FLAG:got_flor_${i};GIVE:flor_camomila;COUNT:flores_luna`,
  })),
  {
    id: 'horta_mochi',
    kind: 'examine',
    position: [HORTA.x, 0, HORTA.z],
    label: 'Medir a horta',
    name: 'Horta da Vovó Mochi',
    radius: 4.2,
    usableWhen: { active: 'horta', notStep: 'horta.mudas' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Horta da Vovó Mochi',
        text: 'Um retângulo de terra fofa marcado com estacas, uma a cada metro.\nDe um lado contam-se 6 metros; do outro, 4 metros.',
        options: [
          { label: '📏 Calcular a cerca', nextNodeId: null, action: 'STEP:horta.ver;CHALLENGE:horta_perimetro', when: { notStep: 'horta.cerca' } },
          { label: '🌱 Calcular as mudas', nextNodeId: null, action: 'CHALLENGE:horta_area', when: { step: 'horta.cerca' } },
          { label: 'Volto depois', nextNodeId: null },
        ],
      },
    },
  },
  {
    id: 'lancador_kiko',
    kind: 'examine',
    position: [LAUNCHER.x, 0, LAUNCHER.z],
    label: 'Mexer no lançador',
    name: 'Lançador do Kiko',
    radius: 2.2,
    usableWhen: { active: 'maquina', notStep: 'maquina.testar' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Lançador do Kiko',
        text: 'Um braço de madeira com um transferidor pintado do lado. A cesta fica 3 metros à frente.\nO ponteiro marca 30°. Escrito à mão: "a bola só cai na cesta a 45°".',
        options: [
          { label: '📐 Calcular o giro', nextNodeId: null, action: 'CHALLENGE:maquina_giro', when: { notStep: 'maquina.observar' } },
          { label: '🔧 Girar a manivela', nextNodeId: null, action: 'CHALLENGE:maquina_cliques', when: { step: 'maquina.observar', notStep: 'maquina.ajustar' } },
          { label: '🚀 Testar o lançador!', nextNodeId: null, action: 'SFX:launch;STEP:maquina.testar', when: { step: 'maquina.ajustar' } },
          { label: 'Volto depois', nextNodeId: null },
        ],
      },
    },
  },
  {
    id: 'balanca_templo',
    kind: 'examine',
    position: BALANCE,
    label: 'Observar a balança',
    name: 'Balança do Templo',
    radius: 2.2,
    usableWhen: { active: 'balanca', notStep: 'balanca.desafio' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Balança do Templo',
        text: 'Uma balança de bronze, perfeitamente equilibrada.\nDe um lado: 3 pedras iguais e um peso marcado "4". Do outro: um peso marcado "19".',
        options: [
          { label: '⚖️ Descobrir o peso da pedra', nextNodeId: null, action: 'CHALLENGE:balanca_pedra', when: { notStep: 'balanca.pedras' } },
          { label: '🔢 Ler o enigma do Mestre Kuma', nextNodeId: null, action: 'CHALLENGE:balanca_mista', when: { step: 'balanca.pedras' } },
          { label: 'Volto depois', nextNodeId: null },
        ],
      },
    },
  },
  {
    id: 'torta_hana',
    kind: 'examine',
    position: PIE,
    label: 'Olhar a torta',
    name: 'Torta da Chef Hana',
    radius: 1.6,
    usableWhen: { active: 'fatias', notStep: 'fatias.contar' },
    dialogue: say('Torta da Chef Hana', 'Uma bandeja redonda cortada em 8 fatias iguais.\nAlgumas fatias sumiram... sobrou cheirinho de peixe e migalhas.', [bye('Ok')]),
  },
];
