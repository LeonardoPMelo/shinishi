import type { Challenge } from '../types';
import { CHAPTER3_CHALLENGES } from './chapter3';
import { EAST_CHALLENGES } from './east';
import { WEST_CHALLENGES } from './west';
import { SOUTH_CHALLENGES } from './south';
import { REDESIGN_CHALLENGES } from './redesign';
import { INTERIOR_CHALLENGES } from './interiors';
import { ACADEMY_CHALLENGES } from './academy';
import { SEDE_CHALLENGES } from './mikage';
import { WILD_CHALLENGES } from './wild';

const list: Challenge[] = [
  {
    id: 'estoque_caixotes',
    title: 'Os Caixotes Vazios',
    skill: 'multiplicacao',
    kind: 'number',
    story:
      'No estoque da cantina há 6 caixotes vazios.\n' +
      'Cada etiqueta diz: "8 peixes frescos".\n\nQuantos peixes havia ao todo?',
    question: '6 caixotes × 8 peixes = ?',
    answer: 48,
    hint: 'Conte de 8 em 8, seis vezes: 8, 16, 24...\nOu pense: 5 caixotes são 40 peixes. E mais um?',
    observe: 'São 6 caixotes e todos têm a mesma quantidade. Grupos iguais pedem multiplicação.',
    example: 'Parecido: 4 caixotes com 5 peixes cada.\n5 + 5 + 5 + 5 = 20, ou seja, 4 × 5 = 20.',
    successText:
      '📦 Isso! 6 × 8 = 48 peixes. Bate com o que a Chef Hana disse.\n\n' +
      'E no canto do caixote... tufos de pelo listrado, cinza e marrom.',
    onSuccess: 'FLAG:pista_pelo;STEP:peixes.estoque',
  },
  {
    id: 'peixes_divisao',
    skill: 'divisao',
    title: 'Enigma dos Peixes',
    kind: 'number',
    story:
      'Os 6 caixotes guardavam 48 peixes, e a Chef Hana ia dividir tudo igualmente\n' +
      'entre 8 famílias da Vila das Patas.\n\nQuantos peixes cada família receberia?',
    question: '48 ÷ 8 = ?',
    answer: 6,
    hint: 'Se 8 famílias recebem a mesma quantidade, divida 48 por 8.\nTente contar de 8 em 8 até chegar a 48!',
    observe: '48 peixes repartidos IGUALMENTE entre 8 famílias: todas recebem a mesma quantidade.',
    example: 'Parecido: 12 peixes para 4 famílias. Dando um peixe para cada família, rodada por rodada:\n4, 8, 12 → foram 3 rodadas. Cada família ganha 3 (12 ÷ 4 = 3).',
    successText:
      '🐟 Correto! 48 ÷ 8 = 6 peixes por família!\n\n' +
      'Então quem pegou os 48 levou a porção de 8 famílias inteiras...',
    onSuccess: 'STEP:peixes.solve_math',
  },
  {
    id: 'receita_ordem',
    skill: 'leitura',
    title: 'A Ordem da Receita',
    kind: 'choice',
    story:
      'A receita do Bolinho Supremo molhou e os passos ficaram embaralhados:\n' +
      '"Assar por 10 minutos", "Misturar arroz e peixe", "Modelar em forma de pata".',
    question: 'Qual é a ordem certa?',
    choices: [
      'Assar → Misturar → Modelar',
      'Misturar → Modelar → Assar',
      'Modelar → Assar → Misturar',
    ],
    answer: 1,
    hint: 'Pense no que precisa existir antes de cada passo.\nDá para modelar algo que ainda não foi misturado?',
    observe: 'Leia cada passo e pergunte: o que precisa existir ANTES dele?',
    example: 'Parecido: um sanduíche. Primeiro corto o pão, depois coloco o recheio, por último fecho.\nNão dá para fechar um pão que ainda não foi cortado.',
    successText: '📜 Perfeito! Primeiro misturar, depois modelar, por último assar.\nPlanejar a ordem das etapas evita bolinhos desastrosos!',
    onSuccess: 'STEP:receita.ordenar',
  },
  {
    id: 'cestos_peixes',
    skill: 'divisao',
    title: 'Os Cestos do Taro',
    kind: 'number',
    story: 'Você recolheu 12 peixes saltitantes. Cada cesto do mercado cabe exatamente 3 peixes.',
    question: '12 peixes ÷ 3 por cesto = ? cestos',
    answer: 4,
    hint: 'Faça grupos de 3: 3, 6, 9, 12... quantos grupos você contou?',
    observe: 'Cada cesto leva exatamente 3 peixes. A pergunta é: quantos grupos de 3 cabem em 12?',
    example: 'Parecido: 10 meias guardadas em pares (grupos de 2).\n2, 4, 6, 8, 10 → contei 5 grupos. São 5 pares (10 ÷ 2 = 5).',
    successText: '🧺 Isso! 4 cestos cheinhos. Nenhum peixe sobrando para pular por aí.',
    onSuccess: 'STEP:chuva_peixes.cestos',
  },
  {
    id: 'lanternas_sequencia',
    skill: 'padroes',
    title: 'A Sequência da Lápide',
    kind: 'choice',
    story:
      'Na lápide antiga está escrito:\n"2 · 4 · 8 · ?"\n\nQuatro lanternas de pedra têm números gravados: 10, 12, 16 e 20.',
    question: 'Qual número continua a sequência?',
    choices: ['10', '12', '16', '20'],
    answer: 2,
    hint: 'Veja como cada número se relaciona com o anterior.\n2 → 4 → 8... o que acontece a cada passo?',
    observe: 'Compare cada número com o anterior: ele SOMA sempre a mesma coisa ou MULTIPLICA?',
    example: 'Parecido: 3, 6, 12, 24...\n3 × 2 = 6, 6 × 2 = 12, 12 × 2 = 24. Cada um é o dobro do anterior, então o próximo é 48.',
    successText: '🏮 Cada número é o dobro do anterior: 2, 4, 8, 16!\nAgora acenda a lanterna certa.',
    onSuccess: 'FLAG:sequencia_entendida;STEP:lanternas.lapide',
  },
  {
    id: 'engrenagens',
    skill: 'divisao',
    title: 'A Matemática das Engrenagens',
    kind: 'choice',
    story:
      'A máquina do Kiko tem uma engrenagem grande com 24 dentes ligada a uma\nengrenagem pequena com 8 dentes.',
    question: 'Quando a grande dá 1 volta, quantas voltas dá a pequena?',
    choices: ['2 voltas', '3 voltas', '8 voltas', '24 voltas'],
    answer: 1,
    hint: 'Cada dente da grande empurra um dente da pequena.\n24 dentes passam... quantas vezes cabem 8 dentes em 24?',
    observe: 'Numa volta da engrenagem grande passam 24 dentes. A pequena completa uma volta a cada 8 dentes.',
    example: 'Parecido: grande com 12 dentes, pequena com 4.\nA cada 4 dentes a pequena dá uma volta: 4, 8, 12 → 3 voltas (12 ÷ 4 = 3).',
    successText: '⚙️ Isso! 24 ÷ 8 = 3 voltas. A pequena gira mais rápido!',
    onSuccess: 'STEP:inventor.calcular',
  },
  {
    id: 'kenzo_preco',
    skill: 'multiplicacao',
    title: 'As Contas do Boku (1/2)',
    kind: 'number',
    story: 'A Dona Neko quer comprar 3 maçãs. Cada maçã custa 4 moedas.',
    question: '3 × 4 = ? moedas',
    answer: 12,
    hint: 'Some 4 moedas três vezes: 4 + 4 + 4.',
    observe: 'São 3 maçãs e todas custam o mesmo: 4 moedas cada.',
    example: 'Parecido: 2 peixes de 5 moedas.\n5 + 5 = 10 moedas, ou seja, 2 × 5 = 10.',
    successText: '🍎 12 moedas! Agora ela vai pagar...',
    onSuccess: 'STEP:contas.preco',
  },
  {
    id: 'kenzo_troco',
    skill: 'subtracao',
    title: 'As Contas do Boku (2/2)',
    kind: 'number',
    story: 'A Dona Neko pagou com uma nota de 20 moedas. As maçãs custaram 12.',
    question: '20 − 12 = ? moedas de troco',
    answer: 8,
    hint: 'Comece em 12 e conte quanto falta para chegar a 20.',
    observe: 'Ela pagou MAIS do que o preço. O troco é o que sobra depois de pagar as maçãs.',
    example: 'Parecido: algo custa 7 e a pessoa paga com 10.\nDe 7 até 10 faltam 3 (8, 9, 10). O troco é 3 (10 − 7 = 3).',
    successText: '🪙 Troco certinho: 8 moedas! O Boku está impressionado.',
    onSuccess: 'STEP:contas.troco;TAKE:moedas_neko',
  },
  {
    id: 'tabuas_degraus',
    skill: 'multiplicacao',
    title: 'Quantas tábuas?',
    kind: 'number',
    story: 'A escada do Mirante precisa de 6 degraus novos. Cada degrau usa 2 tábuas, uma do lado da outra.',
    question: '6 degraus × 2 tábuas = ? tábuas',
    answer: 12,
    hint: 'Conte de 2 em 2, seis vezes: 2, 4, 6...',
    observe: 'Cada degrau usa 2 tábuas, e são 6 degraus iguais.',
    example: 'Parecido: 5 banquinhos com 3 pernas cada.\n3 + 3 + 3 + 3 + 3 = 15 pernas (5 × 3 = 15).',
    successText: '🪵 12 tábuas! Planejar antes de comprar evita viagens extras ao mercado.',
    onSuccess: 'STEP:ponte.contar',
  },
  {
    id: 'tabuas_preco',
    skill: 'multiplicacao',
    title: 'Comprando as tábuas',
    kind: 'number',
    story: 'O Boku vende cada tábua por 3 moedas. Você precisa de 12 tábuas.',
    question: '12 tábuas × 3 moedas = ? moedas',
    answer: 36,
    hint: '10 tábuas custam 30 moedas. E as 2 que faltam?',
    observe: 'O preço total é: quantidade de tábuas × preço de UMA tábua.',
    example: 'Parecido: 11 balas de 2 moedas.\nSepare em 10 + 1: 10 × 2 = 20 e 1 × 2 = 2. Total: 20 + 2 = 22.',
    successText: '🪙 36 moedas, conta certinha! O Boku embrulha as tábuas com laço.',
    onSuccess: 'COINS:-36;GIVE:tabua:12;STEP:ponte.comprar',
  },
  {
    id: 'cofre_codigo',
    skill: 'logica',
    title: 'O código do cofre',
    kind: 'number',
    story: 'Bilhete 1: patas de dois gatos.  Bilhete 2: metade de dez.\nBilhete 3: lanternas de pedra na margem, ao lado da ponte.\n\nJunte os três números, na ordem, para formar o código.',
    question: 'Código de 3 dígitos = ?',
    answer: 853,
    hint: 'Dois gatos têm 4 + 4 patas. Metade de 10 é... E as lanternas: conte quantas há na margem do rio!',
    observe: 'Cada bilhete vale UM algarismo, e a ordem dos bilhetes é a ordem do código.',
    example: 'Parecido: bilhetes "metade de 4", "patas de um gato" e "nenhum peixe".\nMetade de 4 = 2, um gato tem 4 patas, nenhum = 0 → código 2 4 0.',
    successText: '🔓 CLIQUE! 8 · 5 · 3. O cofre abriu. Lá dentro: uma medalha e um bilhete "não esquecer o código (de novo)".',
    onSuccess: 'GIVE:medalha;STEP:cofre.abrir',
  },
];

list.push(...CHAPTER3_CHALLENGES, ...EAST_CHALLENGES, ...WEST_CHALLENGES, ...SOUTH_CHALLENGES, ...REDESIGN_CHALLENGES, ...INTERIOR_CHALLENGES, ...ACADEMY_CHALLENGES, ...SEDE_CHALLENGES, ...WILD_CHALLENGES);

export const CHALLENGES: Record<string, Challenge> = Object.fromEntries(list.map((c) => [c.id, c]));
