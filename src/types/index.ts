export type GamePhase = 'menu' | 'playing' | 'paused' | 'dialogue' | 'challenge';

export type PlayerRank = 'Aprendiz' | 'Explorador' | 'Guardião' | 'Mestre das Patas';

export type Vec3 = [number, number, number];

export interface PlayerStats {
  xp: number;
  level: number;
  rank: PlayerRank;
  coins: number;
  /** Gemas do Saber: earned by solving challenges (learning currency, separate from coins). */
  gems: number;
  hp: number;
  maxHp: number;
  completedMissions: string[];
  badges: string[];
}

export interface MissionProgress {
  status: 'active' | 'done';
  steps: string[];
}

/** Everything about the world that changes as the player plays. Persisted. */
export interface Progress {
  missions: Record<string, MissionProgress>;
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  inventory: Record<string, number>;
  abilities: string[];
  tracked: string | null;
  /** Learning record per skill (see data/skills.ts). */
  learning: Record<string, SkillRecord>;
  /** Challenges already solved (rewards are paid once). */
  solved: string[];
  /** Worn items by slot (replaces the old `veste_<item>` flags, converted on load by store/saveSanitize.ts). */
  equipped: Partial<Record<EquipSlot, string>>;
}

export interface SkillRecord {
  /** Challenges solved in this skill. */
  solved: number;
  /** Solved on the first try. */
  firstTry: number;
  /** Wrong answers given (mistakes are practice, never punished). */
  wrong: number;
}

/**
 * A condition is satisfied when every listed clause holds.
 * Step references use the form "missionId.stepId".
 */
export interface Condition {
  active?: string;
  done?: string | string[];
  notStarted?: string;
  notDone?: string;
  step?: string | string[];
  notStep?: string | string[];
  flag?: string | string[];
  notFlag?: string | string[];
  item?: { id: string; count?: number };
  counter?: { id: string; atLeast: number };
  ability?: string;
  coins?: number;
}

/**
 * Action strings, separated by ";" when combined:
 *   START:missionId          STEP:missionId.stepId     FLAG:name    UNFLAG:name
 *   GIVE:itemId[:n]          TAKE:itemId[:n]           COINS:n      XP:n
 *   COUNT:counterId[:n]      ABILITY:id                CHALLENGE:challengeId
 *   TRACK:missionId          SFX:name                  CLOSE
 *   GEMS:n
 */
export type ActionString = string;

export interface DialogueOption {
  label: string;
  nextNodeId: string | null;
  action?: ActionString;
  when?: Condition;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  options?: DialogueOption[];
  onEnter?: ActionString;
  mood?: 'happy' | 'sad' | 'surprised' | 'angry' | 'neutral';
}

export type DialogueTree = Record<string, DialogueNode>;

export interface DialogueRoute {
  when?: Condition;
  tree: DialogueTree;
  start?: string;
}

export type Skill = 'adicao' | 'subtracao' | 'multiplicacao' | 'divisao' | 'fracoes' | 'proporcoes' | 'geometria' | 'algebra' | 'padroes' | 'logica' | 'leitura';

export interface Challenge {
  id: string;
  title: string;
  /** Which skill this exercises (learning record, Saberes panel). */
  skill: Skill;
  story: string;
  question: string;
  kind: 'number' | 'choice';
  answer: number;
  choices?: string[];
  /** Help in three steps, after each wrong answer or on request: what to look at… */
  observe: string;
  /** …then the hint itself… */
  hint: string;
  /** …then an equivalent problem solved step by step. */
  example: string;
  successText: string;
  onSuccess: ActionString;
}

export type StepTarget =
  | { npc: string }
  | { object: string }
  | { position: Vec3 };

export interface MissionStep {
  id: string;
  description: string;
  /** Step ids (same mission) that must be done before this one shows up. Default: the previous step. */
  after?: string[];
  target?: StepTarget;
  /** Optional progress counter shown next to the description. */
  counter?: { id: string; goal: number };
}

export type MissionCategory = 'principal' | 'secundária' | 'exploração' | 'treinamento' | 'investigação' | 'cômica' | 'educativa';

export interface Mission {
  id: string;
  title: string;
  /** Campaign chapter (1, 2, ...). */
  chapter: number;
  category: MissionCategory;
  giver?: string;
  description: string;
  steps: MissionStep[];
  rewards: {
    xp: number;
    coins: number;
    gems?: number;
    badges?: string[];
    items?: Record<string, number>;
    ability?: string;
  };
  /** Shown on the completion screen. */
  lesson: string;
  /** Extra actions run when the mission completes (flags that change the world). */
  onComplete?: ActionString;
}

/** What an item is for (Etapa 2 da expansão): decides where it shows, whether it can be sold, used or worn. */
export type ItemCategory = 'missao' | 'consumivel' | 'equipamento' | 'ferramenta' | 'colecionavel' | 'cosmetico';
export type ItemRarity = 'comum' | 'raro' | 'epico' | 'lendario';
/** Where a worn item goes; one item per slot. */
export type EquipSlot = 'faixa' | 'coleira' | 'mochila';

/** What using an item does. Each effect is handled in one place (systems/inventory.ts `useItem`). */
export type ItemEffect =
  /** Faster and higher jumps for a while (the energy potion). */
  | { kind: 'impulso'; seconds: number }
  /** Higher jumps only, for a while (grilled fish; Etapa 6). */
  | { kind: 'salto'; seconds: number }
  /** The Faro at once, longer, without waiting for it to recharge (catnip tea; Etapa 6). */
  | { kind: 'faro'; seconds: number };

/**
 * What a worn item does while it is worn (Etapa 6), read by the game code that it changes:
 *  - faro_longo: the Faro lasts longer and recharges faster (Shinichi.tsx);
 *  - detector: a compass to the nearest Golden Paw not yet found (HUD).
 */
export type ItemPassive = 'faro_longo' | 'detector';

export interface Item {
  id: string;
  name: string;
  icon: string;
  description: string;
  hidden?: boolean;
  /** Missing = 'missao' (story items: never sold, never used up by the player). */
  category?: ItemCategory;
  rarity?: ItemRarity;
  /** Coins a shop pays for one; missing = cannot be sold. */
  sellPrice?: number;
  /** Using it spends one and applies the effect. */
  use?: ItemEffect;
  /** Wearable: the slot it goes in. */
  slot?: EquipSlot;
  /** Wearable band color (the 'faixa' slot paints Shinichi's headband). */
  band?: string;
  /** Collar colour and charm (the 'coleira' slot, drawn on Shinichi's neck). */
  collar?: { color: string; charm: 'sino' | 'folha' };
  /** What it does while worn. */
  passive?: ItemPassive;
  /** One line on what it is for, shown in the shops and the bag ("Pula mais alto por 20 s"). */
  effectText?: string;
}

export type Species = 'cat' | 'dog' | 'rabbit' | 'tanuki' | 'bear';

export interface NPCLook {
  species: Species;
  fur: string;
  belly: string;
  scale: number;
  wide?: number;
  mask?: string;
  stripes?: string;
  eyes?: 'round' | 'closed' | 'sleepy' | 'sharp';
  outfit?: string;
  accessory?: 'chef' | 'happi' | 'scarf' | 'leaf' | 'monk' | 'sage' | 'rival' | 'inventor' | 'guard' | 'explorer' | 'sleeper' | 'mystery' | 'vendor' | 'granny' | 'kid' | 'tinker' | 'parkour' | 'shrine';
}

export interface NPCDefinition {
  id: string;
  name: string;
  role: string;
  position: Vec3;
  look: NPCLook;
  voice: 'meow' | 'meow_low' | 'meow_high' | 'woof' | 'squeak' | 'chitter' | 'grunt' | 'snore';
  routes: DialogueRoute[];
  /** Walk between these points when the player is not nearby. */
  patrol?: Vec3[];
  /** Shown only while this holds. */
  visibleWhen?: Condition;
  /** Short lines said aloud when the player walks past. */
  barks?: string[];
  /** Missions this NPC can start; drives the "!" marker. */
  offers?: { mission: string; when?: Condition }[];
  faceRotation?: number;
  /** Walking speed along the patrol (default 1.3). */
  speed?: number;
}
