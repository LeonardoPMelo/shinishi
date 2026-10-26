import type { DialogueTree, Item, Mission } from '../types';
import type { WorldObject } from './world';
import { FRACTION_DOOR, GONG_TABLET, MIRROR_GRID, SHRINE } from '../systems/temple';

/**
 * Capítulo 4 — O Templo dos Enigmas. The region and its puzzles live in game/world/TempleOfRiddles.tsx
 * (rules in systems/temple.ts); this file holds the mission, the hint plaques and the shrine altar.
 * Each plaque offers the same three-step help as the math challenges: observe → hint → example.
 */

export const TEMPLE_ITEMS: Item[] = [
  { id: 'pergaminho_enigmas', name: 'Pergaminho dos Enigmas', icon: '📜', description: 'Guardado no santuário do templo. Tem três desenhos: um espelho, um disco em fatias e um gongo.' },
];

/** What each puzzle runs when solved (the world component calls these; validateData registers them). */
export const TEMPLE_SOLVE_ACTIONS = {
  espelhos: 'STEP:templo.espelhos;SKILL:geometria;XP:20;SFX:chime',
  fracoes: 'STEP:templo.fracoes;SKILL:fracoes;XP:20;SFX:chime',
  gongos: 'STEP:templo.gongos;SKILL:padroes;XP:20;SFX:chime',
};

export const TEMPLE_MISSIONS: Mission[] = [
  {
    id: 'templo', chapter: 4, title: 'O Templo dos Enigmas', category: 'principal', giver: 'tsubaki',
    description: 'Atrás do pagode existe um templo antigo, fechado há muitos anos. A Tsubaki diz que só quem resolve os três enigmas pode abrir o santuário.',
    steps: [
      { id: 'portao', description: 'Peça à Tsubaki para abrir o portão do templo', target: { npc: 'tsubaki' } },
      { id: 'espelhos', description: 'Espelhos da Luz: leve o raio da lanterna até o cristal', after: ['portao'], target: { object: 'placa_espelhos' } },
      { id: 'fracoes', description: 'Porta das Frações: acenda a fração pedida no disco', after: ['portao'], target: { object: 'placa_fracoes' } },
      { id: 'gongos', description: 'Gongos da Sequência: toque os números que continuam o padrão', after: ['portao'], target: { object: 'placa_gongos' } },
      { id: 'santuario', description: 'Abra o santuário no fundo do templo', after: ['espelhos', 'fracoes', 'gongos'], target: { object: 'altar_enigmas' } },
      { id: 'voltar', description: 'Conte à Tsubaki o que encontrou', after: ['santuario'], target: { npc: 'tsubaki' } },
    ],
    rewards: { xp: 120, coins: 50, gems: 5, badges: ['Mestre dos Enigmas'] },
    lesson: 'Enigma não se resolve no chute: observe, encontre a regra, teste uma ideia e confira. Errar no caminho faz parte.',
    onComplete: 'SFX:fireworks',
  },
];

const help = (name: string, observe: string, hint: string, example: string): DialogueTree => ({
  start: {
    id: 'start', speaker: name,
    text: 'Uma placa de pedra com letras gastas. Dá para ler três partes, uma de cada vez.',
    options: [
      { label: '👀 Observar', nextNodeId: 'observe' },
      { label: '💡 Uma dica', nextNodeId: 'hint' },
      { label: '📝 Um exemplo', nextNodeId: 'example' },
      { label: 'Voltar ao enigma', nextNodeId: null },
    ],
  },
  observe: { id: 'observe', speaker: name, text: `👀 ${observe}`, options: [{ label: '💡 Quero uma dica', nextNodeId: 'hint' }, { label: 'Vou tentar!', nextNodeId: null }] },
  hint: { id: 'hint', speaker: name, text: `💡 ${hint}`, options: [{ label: '📝 Me mostre um exemplo', nextNodeId: 'example' }, { label: 'Vou tentar!', nextNodeId: null }] },
  example: { id: 'example', speaker: name, text: `📝 ${example}`, options: [{ label: 'Entendi! Vou tentar.', nextNodeId: null }] },
});

const [gx, gz] = MIRROR_GRID.origin;

export const TEMPLE_OBJECTS: WorldObject[] = [
  {
    id: 'placa_espelhos', kind: 'examine', position: [gx + 1.8, 0, gz + 7.6], label: 'Ler a placa dos Espelhos', name: 'Espelhos da Luz',
    when: { step: 'templo.portao' }, radius: 1.6,
    dialogue: help('Espelhos da Luz',
      'A luz da lanterna anda sempre em linha reta. Siga o raio com o olho: em que estátuas ele precisa virar para chegar ao cristal?',
      'Cada toque gira o espelho 45°. Um espelho inclinado (45° ou 135°) faz a luz virar um canto reto, 90°. De lado (0°) a luz passa direto; de frente (90°) ela volta.',
      'Um raio indo para a direita bate num espelho a 45° e vira para um lado; a 135°, vira para o outro. Teste um espelho de cada vez e veja para onde o raio vai.'),
  },
  {
    id: 'placa_fracoes', kind: 'examine', position: [FRACTION_DOOR[0] + 3.4, 0, FRACTION_DOOR[2] + 6.4], label: 'Ler a placa das Frações', name: 'Porta das Frações',
    when: { step: 'templo.portao' }, radius: 1.6,
    dialogue: help('Porta das Frações',
      'O disco da porta tem 8 fatias iguais. Cada placa do chão acende uma parte do disco. Quantas fatias a porta pede?',
      'Transforme tudo em oitavos: ½ = 4/8, ¼ = 2/8, ⅛ = 1/8, ⅜ = 3/8. Depois some as placas em que você está pisando.',
      'Se a porta pedisse ½ (4/8), daria para pisar na placa ½... ou juntar ⅜ + ⅛ = 4/8. Frações diferentes, mesmo tanto! Quando o disco estiver certo, puxe a alavanca.'),
  },
  {
    id: 'placa_gongos', kind: 'examine', position: [GONG_TABLET[0] + 2.4, 0, GONG_TABLET[2] + 0.6], label: 'Ler a placa dos Gongos', name: 'Gongos da Sequência',
    when: { step: 'templo.portao' }, radius: 1.6,
    dialogue: help('Gongos da Sequência',
      'A tábua mostra uma fila de números. Compare cada número com o anterior: o que muda de um para o outro?',
      'Procure a regra: o número cresce somando sempre o mesmo valor? Ou dobra a cada passo? Use a regra para descobrir os próximos e toque esses gongos, em ordem.',
      'Na fila 3, 7, 11, 15 a regra é somar 4, então os próximos seriam 19 e 23. Na fila 3, 6, 12 a regra é dobrar, então o próximo seria 24.'),
  },
  {
    id: 'altar_enigmas', kind: 'examine', position: [SHRINE[0], 0, SHRINE[2] + 0.4], label: 'Pegar o pergaminho do altar', name: 'Santuário',
    when: { step: ['templo.espelhos', 'templo.fracoes', 'templo.gongos'] },
    hideWhen: { step: 'templo.santuario' }, radius: 1.8,
    dialogue: {
      start: {
        id: 'start', speaker: 'Santuário',
        text: 'As portas do santuário se abriram sozinhas. No altar, um pergaminho brilha com três desenhos:\num espelho, um disco em fatias e um gongo.\n\nEmbaixo, uma frase: "Quem observa, encontra a regra. Quem encontra a regra, abre qualquer porta."',
        options: [{ label: '📜 Guardar o pergaminho', nextNodeId: null, action: 'GIVE:pergaminho_enigmas;STEP:templo.santuario;SFX:chest' }],
      },
    },
  },
];
