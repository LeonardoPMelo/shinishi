import { audio } from './engine';
import { playSfx } from './sfx';
import { CAMPFIRE, WILD_RIVER, w } from '../data/wild';

/** PROVISIONAL synthesized ambience. Positional where it helps the player find things. */

type V3 = [number, number, number];

const WATER_SPOTS: { pos: V3; gain: number; tone: number }[] = [
  { pos: [0, 1, 0], gain: 0.35, tone: 1400 },
  { pos: [0, 0.3, 23], gain: 0.45, tone: 900 },
  { pos: [-8, 0.3, 23], gain: 0.3, tone: 800 },
  { pos: [9, 0.3, 23], gain: 0.3, tone: 850 },
  { pos: [16.8, 1.5, 23], gain: 0.8, tone: 650 },
  { pos: [-14.2, 0.3, -17.2], gain: 0.25, tone: 1600 },
];

/**
 * The wild lands' river and waterfall (Etapa 9): the village's water spots are far away there, so the river
 * would run silent. Samples along it, and the fall itself, louder and lower.
 */
const WILD_WATER: { pos: V3; gain: number; tone: number }[] = [
  ...[30, 14, -2, -18, -30].map((z) => ({ pos: w((WILD_RIVER.x0 + WILD_RIVER.x1) / 2, z, 0.3), gain: 0.35, tone: 780 })),
  { pos: w((WILD_RIVER.x0 + WILD_RIVER.x1) / 2, -38, 3), gain: 1.1, tone: 520 },
];

const HOUSES: V3[] = [[-8.5, 2, -8.5], [9.5, 2, -10], [11.5, 2, -1.5], [6.5, 2, 12], [-13.5, 2, -2.5], [13.5, 2, 7], [-3, 2, 14]];
const MARKET: V3 = [8.6, 1, -1.5];
const CANTINA: V3 = [-6.6, 1, -6.8];
const TRAINING: V3 = [-7, 1, 28.3];
const NEKO: V3 = [-16.2, 0.6, 19.6];

export interface AmbienceContext {
  x: number;
  z: number;
  inGarden: boolean;
  inForest: boolean;
  active: boolean;
  /** 'outdoor', a house's id, or 'selvagem' (game/systems/zone.ts). */
  zone: string;
  /** In the wild lands: the place's name (data/wild.ts), for the cave and the windy lookout. */
  area: string | null;
  nekoSleeping: boolean;
  npcPositions: { pos: V3; voice: string }[];
}

class Ambience {
  private started = false;
  private wind!: GainNode;
  private windFilter!: BiquadFilterNode;
  private timers: Record<string, number> = {};

  private loopNoise() {
    const ctx = audio.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = audio.noise;
    src.loop = true;
    src.start(0, Math.random() * 1.5);
    return src;
  }

  private lfo(target: AudioParam, rate: number, depth: number) {
    const ctx = audio.ctx!;
    const o = ctx.createOscillator();
    o.frequency.value = rate;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
  }

  start() {
    if (this.started || !audio.ready) return;
    this.started = true;
    const ctx = audio.ctx!;

    // Wind through the trees: slowly breathing filtered noise.
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 500;
    this.lfo(this.windFilter.frequency, 0.07, 250);
    this.wind = ctx.createGain();
    this.wind.gain.value = 0.09;
    const gust = ctx.createGain();
    gust.gain.value = 0.7;
    this.lfo(gust.gain, 0.05, 0.3);
    this.loopNoise().connect(this.windFilter).connect(gust).connect(this.wind).connect(audio.buses.ambient);

    // Running water, placed in the world.
    for (const spot of [...WATER_SPOTS, ...WILD_WATER]) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = spot.tone;
      f.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.value = spot.gain;
      this.lfo(g.gain, 0.3 + Math.random() * 0.3, spot.gain * 0.25);
      this.loopNoise().connect(f).connect(g).connect(audio.spatial(...spot.pos, 'ambient', 1.5, 30));
    }
  }

  private due(key: string, now: number, min: number, max: number) {
    if ((this.timers[key] ?? 0) > now) return false;
    this.timers[key] = now + min + Math.random() * (max - min);
    return true;
  }

  update(c: AmbienceContext) {
    if (!audio.ready) return;
    this.start();
    const t = audio.time;
    // where the cat is decides the room the sound lives in (Etapa 9): houses and the cave are closed and
    // echo; the windy lookout is all wind
    const indoors = c.zone !== 'outdoor' && c.zone !== 'selvagem';
    const cave = c.area === 'Caverna da Névoa';
    const lookout = c.area === 'Mirante do Vento';
    const wind = indoors ? 0.015 : cave ? 0.03 : lookout ? 0.2 : c.inGarden ? 0.03 : c.active ? 0.09 : 0.05;
    this.wind.gain.setTargetAtTime(wind, t, 0.8);
    audio.setReverb(cave ? 0.5 : indoors ? 0.28 : c.inGarden ? 0.32 : 0.16);
    if (!c.active) return;

    const near = (p: V3, r: number) => Math.hypot(p[0] - c.x, p[2] - c.z) < r;
    const around = (r: number, y = 1): V3 => {
      const a = Math.random() * Math.PI * 2;
      const d = r * (0.5 + Math.random() * 0.5);
      return [c.x + Math.cos(a) * d, y, c.z + Math.sin(a) * d];
    };

    // inside: the Sede's garden chimes and the academy's training yard (pendência 11)
    if (c.zone === 'sede' && this.due('sede', t, 10, 20)) playSfx('chime', { position: around(7, 2) });
    if (c.zone === 'academia' && this.due('dojo', t, 3, 7)) playSfx('thwack', { position: around(8) });
    // the cave drips; the camp fire crackles
    if (cave && this.due('drip', t, 1.2, 3.5)) playSfx('drip', { position: around(6, 2.5) });
    if (c.zone === 'selvagem' && near(CAMPFIRE.at, 9) && this.due('fire', t, 1.5, 3.5)) playSfx('sizzle', { position: CAMPFIRE.at });

    if (!indoors && !cave && this.due('bird', t, c.inForest ? 1.8 : 3, c.inForest ? 5 : 8)) {
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 9;
      playSfx('bird', { position: [c.x + Math.cos(a) * r, 5 + Math.random() * 3, c.z + Math.sin(a) * r] });
    }
    const house = HOUSES[Math.floor(Math.random() * HOUSES.length)];
    if (near(house, 18) && this.due('chime', t, 9, 22)) playSfx('chime', { position: house });
    if (near(MARKET, 16) && this.due('chatter', t, 2.5, 6)) playSfx('chatter', { position: [MARKET[0] + Math.random() * 2 - 1, 1, MARKET[2] + Math.random() * 3 - 1.5] });
    if (near(CANTINA, 14) && this.due('sizzle', t, 4, 9)) playSfx('sizzle', { position: CANTINA });
    if (near(TRAINING, 20) && this.due('thwack', t, 2, 5)) playSfx('thwack', { position: TRAINING });
    if (c.nekoSleeping && near(NEKO, 16) && this.due('snore', t, 2.6, 3.4)) playSfx('voice_snore', { position: NEKO });

    if (this.due('npcvoice', t, 10, 22)) {
      const candidates = c.npcPositions.filter((n) => near(n.pos, 14) && !near(n.pos, 2.5) && n.voice !== 'snore');
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      if (pick) playSfx(`voice_${pick.voice}`, { position: pick.pos });
    }
  }
}

export const ambience = new Ambience();
