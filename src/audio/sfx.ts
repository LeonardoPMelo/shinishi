import { audio, loadAudioFile, AUDIO_FILES } from './engine';
import { FILE_GAIN } from './fileLevels';
import { blip, bell, koto, meowVoice, noiseBurst, taiko, shamisen, midiToFreq } from './instruments';
import { stinger } from './music';

/**
 * PROVISIONAL synthesized sound effects. Any name can be replaced by a licensed file via
 * AUDIO_FILES (`sfx:<name>`). Every recipe varies pitch/volume slightly so repeats feel natural.
 */

type Recipe = (dest: AudioNode, t: number, v: number, opts: SfxOptions) => void;

export interface SfxOptions {
  position?: [number, number, number];
  pitch?: number;
}

interface Rule {
  /** Minimum seconds between two plays of this sound. */
  gap?: number;
  /** Max simultaneous instances. */
  max?: number;
  bus?: 'sfx' | 'ambient';
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Exported for loudness checks (dev tools match licensed files to these levels). */
export const recipes: Record<string, Recipe> = {
  step_grass: (d, t, v) => noiseBurst(d, t, { dur: 0.07, vel: 0.12 * v, type: 'lowpass', from: rnd(900, 1300), to: 500 }),
  step_stone: (d, t, v) => {
    noiseBurst(d, t, { dur: 0.04, vel: 0.12 * v, type: 'bandpass', from: rnd(2200, 3000), q: 2 });
    blip(d, t, rnd(180, 230), { type: 'sine', dur: 0.04, vel: 0.06 * v });
  },
  step_wood: (d, t, v) => {
    blip(d, t, rnd(320, 380), { type: 'triangle', dur: 0.06, vel: 0.12 * v, slide: 0.8 });
    noiseBurst(d, t, { dur: 0.04, vel: 0.05 * v, from: 1500 });
  },
  jump: (d, t, v) => {
    noiseBurst(d, t, { dur: 0.18, vel: 0.12 * v, from: 600, to: 2400, q: 1.5 });
    if (Math.random() < 0.18) meowVoice(d, t + 0.02, rnd(560, 640), 'mrrp', 0.25 * v, 0.2);
  },
  double_jump: (d, t, v) => {
    noiseBurst(d, t, { dur: 0.25, vel: 0.18 * v, from: 900, to: 5000, q: 3 });
    blip(d, t, 700, { type: 'sine', dur: 0.2, slide: 2, vel: 0.12 * v });
  },
  land: (d, t, v) => {
    blip(d, t, 90, { type: 'sine', dur: 0.12, slide: 0.6, vel: 0.25 * v });
    noiseBurst(d, t, { dur: 0.08, vel: 0.12 * v, type: 'lowpass', from: 800 });
  },
  splash: (d, t, v) => {
    noiseBurst(d, t, { dur: 0.5, vel: 0.35 * v, from: 3000, to: 600, q: 0.8 });
    for (let i = 0; i < 5; i++) blip(d, t + 0.05 + i * rnd(0.04, 0.08), rnd(600, 1400), { type: 'sine', dur: 0.06, slide: 1.8, vel: 0.08 * v });
    meowVoice(d, t + 0.15, 700, 'mew', 0.4 * v, 0.35);
  },
  player_meow: (d, t, v) => {
    const kinds = ['meow', 'mrrp', 'happy'] as const;
    meowVoice(d, t, rnd(560, 680), kinds[Math.floor(Math.random() * kinds.length)], 0.45 * v, rnd(0.35, 0.5));
  },
  purr: (d, t, v) => {
    const ctx = audio.ctx!;
    if (!audio.claimVoice()) return;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 26;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18 * v, t + 0.4);
    g.gain.setValueAtTime(0.18 * v, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(f).connect(g).connect(d);
    o.start(t);
    o.stop(t + 2.3);
    o.onended = () => audio.releaseVoice();
  },
  faro: (d, t, v) => {
    noiseBurst(d, t, { dur: 0.12, vel: 0.15 * v, from: 2500, q: 4 });
    noiseBurst(d, t + 0.15, { dur: 0.12, vel: 0.15 * v, from: 2800, q: 4 });
    [84, 88, 91, 96].forEach((m, i) => bell(d, t + 0.3 + i * 0.06, midiToFreq(m), 0.25 * v, 1));
  },
  denied: (d, t, v) => blip(d, t, 260, { type: 'sine', dur: 0.15, slide: 0.8, vel: 0.12 * v }),
  // Stage 4 abilities (provisional synthesized sounds, like the rest of the set)
  shuriken: (d, t, v) => {
    noiseBurst(d, t, { dur: 0.16, vel: 0.14 * v, type: 'bandpass', from: 2500, to: 6500, q: 4 });
    blip(d, t, 1800, { type: 'triangle', dur: 0.05, slide: 1.4, vel: 0.05 * v });
  },
  target_hit: (d, t, v) => {
    blip(d, t, 140, { type: 'sine', dur: 0.12, slide: 0.7, vel: 0.22 * v });
    noiseBurst(d, t, { dur: 0.06, vel: 0.12 * v, type: 'lowpass', from: 1600 });
    blip(d, t + 0.04, 1320, { type: 'sine', dur: 0.12, vel: 0.06 * v });
  },
  dash: (d, t, v) => {
    noiseBurst(d, t, { dur: 0.22, vel: 0.2 * v, from: 400, to: 3200, q: 1.2 });
    blip(d, t, 300, { type: 'sine', dur: 0.15, slide: 2.2, vel: 0.08 * v });
  },
  potion: (d, t, v) => {
    for (let i = 0; i < 6; i++) blip(d, t + i * 0.05, 520 + i * 140, { type: 'sine', dur: 0.09, slide: 1.3, vel: 0.07 * v });
    noiseBurst(d, t, { dur: 0.3, vel: 0.05 * v, type: 'highpass', from: 4000 });
  },
  ui_open: (d, t, v) => {
    noiseBurst(d, t, { dur: 0.14, vel: 0.06 * v, from: 1200, to: 3000 });
    koto(d, t + 0.02, midiToFreq(76), 0.3 * v);
  },
  ui_close: (d, t, v) => koto(d, t, midiToFreq(69), 0.25 * v),
  ui_select: (d, t, v) => blip(d, t, rnd(1150, 1250), { type: 'sine', dur: 0.05, vel: 0.1 * v }),
  blip: (d, t, v, o) => blip(d, t, (o.pitch ?? 500) * rnd(0.92, 1.12), { type: 'square', dur: 0.035, vel: 0.035 * v }),
  coin: (d, t, v) => {
    bell(d, t, midiToFreq(rnd(0, 1) > 0.5 ? 95 : 93), 0.3 * v, 0.6);
    bell(d, t + 0.07, midiToFreq(100), 0.3 * v, 0.8);
  },
  item: (d, t, v) => [76, 81, 88].forEach((m, i) => koto(d, t + i * 0.06, midiToFreq(m), 0.45 * v)),
  pickup_fish: (d, t, v) => {
    blip(d, t, 500, { type: 'sine', dur: 0.12, slide: 2.2, vel: 0.2 * v });
    noiseBurst(d, t + 0.05, { dur: 0.1, vel: 0.1 * v, from: 2000 });
  },
  chest: (d, t, v) => {
    blip(d, t, 140, { type: 'sawtooth', dur: 0.25, slide: 1.4, vel: 0.08 * v });
    [72, 76, 79, 84].forEach((m, i) => bell(d, t + 0.25 + i * 0.07, midiToFreq(m + 12), 0.25 * v, 1));
  },
  mechanism: (d, t, v) => {
    for (let i = 0; i < 6; i++) blip(d, t + i * 0.08, rnd(180, 260), { type: 'square', dur: 0.04, vel: 0.07 * v });
    noiseBurst(d, t + 0.5, { dur: 0.2, vel: 0.12 * v, from: 400 });
  },
  boom: (d, t, v) => {
    taiko(d, t, 0.9 * v, 0.6);
    noiseBurst(d, t, { dur: 0.9, vel: 0.35 * v, type: 'lowpass', from: 3000, to: 200 });
    stinger('comic');
    meowVoice(d, t + 0.7, 820, 'mew', 0.3 * v, 0.3);
  },
  poof: (d, t, v) => noiseBurst(d, t, { dur: 0.5, vel: 0.3 * v, from: 3000, to: 300, q: 0.7 }),
  fizzle: (d, t, v) => {
    noiseBurst(d, t, { dur: 0.4, vel: 0.15 * v, from: 4000, to: 800, q: 2 });
    blip(d, t + 0.1, 440, { type: 'sine', dur: 0.3, slide: 0.5, vel: 0.12 * v });
  },
  wish: (d, t, v) => {
    blip(d, t, 900, { type: 'sine', dur: 0.15, slide: 0.4, vel: 0.15 * v });
    noiseBurst(d, t + 0.18, { dur: 0.15, vel: 0.12 * v, from: 2500 });
    bell(d, t + 0.4, midiToFreq(88), 0.25 * v, 1.4);
  },
  temple_bell: (d, t, v) => {
    bell(d, t, midiToFreq(50), 0.9 * v, 5);
    bell(d, t, midiToFreq(62), 0.4 * v, 4);
  },
  ring: (d, t, v) => {
    [76, 83, 88].forEach((m, i) => bell(d, t + i * 0.05, midiToFreq(m), 0.3 * v, 0.9));
    noiseBurst(d, t, { dur: 0.25, vel: 0.12 * v, from: 1000, to: 6000, q: 2 });
  },
  challenge_correct: (d, t, v) => {
    [72, 76, 79, 84].forEach((m, i) => shamisen(d, t + i * 0.08, midiToFreq(m), 0.5 * v));
    bell(d, t + 0.35, midiToFreq(96), 0.3 * v, 1.5);
  },
  challenge_wrong: (d, t, v) => {
    // Friendly "hmm?" — never a buzzer.
    blip(d, t, 520, { type: 'sine', dur: 0.18, slide: 0.75, vel: 0.15 * v });
    meowVoice(d, t + 0.18, 560, 'mrrp', 0.25 * v, 0.3);
  },
  voice_meow: (d, t, v) => meowVoice(d, t, rnd(600, 720), 'meow', 0.4 * v, rnd(0.35, 0.5)),
  voice_meow_low: (d, t, v) => meowVoice(d, t, rnd(380, 450), 'meow', 0.45 * v, rnd(0.45, 0.6)),
  voice_meow_high: (d, t, v) => meowVoice(d, t, rnd(800, 920), Math.random() < 0.5 ? 'mew' : 'happy', 0.4 * v, 0.32),
  voice_woof: (d, t, v) => {
    const ctx = audio.ctx!;
    if (!audio.claimVoice()) return;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(170, t + 0.14);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(f).connect(g).connect(d);
    o.start(t);
    o.stop(t + 0.18);
    o.onended = () => audio.releaseVoice();
  },
  voice_squeak: (d, t, v) => {
    blip(d, t, rnd(1300, 1500), { type: 'sine', dur: 0.08, slide: 1.4, vel: 0.2 * v });
    blip(d, t + 0.1, rnd(1500, 1700), { type: 'sine', dur: 0.07, slide: 1.3, vel: 0.15 * v });
  },
  voice_chitter: (d, t, v) => {
    for (let i = 0; i < 4; i++) blip(d, t + i * 0.06, rnd(900, 1300), { type: 'triangle', dur: 0.04, slide: 1.5, vel: 0.15 * v });
  },
  voice_grunt: (d, t, v) => {
    blip(d, t, 110, { type: 'sawtooth', dur: 0.35, slide: 0.85, vel: 0.12 * v });
    noiseBurst(d, t, { dur: 0.3, vel: 0.06 * v, type: 'lowpass', from: 400 });
  },
  voice_snore: (d, t, v) => {
    noiseBurst(d, t, { dur: 0.9, vel: 0.22 * v, type: 'lowpass', from: 300, to: 700, attack: 0.4 });
    blip(d, t + 0.1, 70, { type: 'sawtooth', dur: 0.8, slide: 1.2, vel: 0.08 * v });
  },
  bird: (d, t, v) => {
    const base = rnd(2600, 4200);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) blip(d, t + i * rnd(0.09, 0.14), base * rnd(0.9, 1.1), { type: 'sine', dur: 0.07, slide: rnd(0.7, 1.4), vel: 0.08 * v });
  },
  chime: (d, t, v) => [0, 1, 2].forEach((i) => bell(d, t + i * rnd(0.08, 0.2), midiToFreq(84 + [0, 3, 7, 10, 12][Math.floor(Math.random() * 5)]), 0.12 * v, 1.6)),
  // Kiko's launcher: a spring "boing" and a whoosh
  launch: (d, t, v) => {
    blip(d, t, 180, { type: 'triangle', dur: 0.25, slide: 2.4, vel: 0.12 * v });
    noiseBurst(d, t + 0.05, { dur: 0.6, vel: 0.06 * v, type: 'bandpass', from: 600, to: 2600, q: 0.8 });
  },
  thwack: (d, t, v) => {
    blip(d, t, rnd(240, 300), { type: 'triangle', dur: 0.07, slide: 0.7, vel: 0.2 * v });
    noiseBurst(d, t, { dur: 0.05, vel: 0.1 * v, from: 1800 });
  },
  sizzle: (d, t, v) => noiseBurst(d, t, { dur: 1.2, vel: 0.06 * v, type: 'highpass', from: 4000, attack: 0.2 }),
  boing: (d, t, v) => {
    blip(d, t, 180, { type: 'sine', dur: 0.35, slide: 3.2, vel: 0.3 * v });
    blip(d, t + 0.05, 260, { type: 'triangle', dur: 0.25, slide: 2.4, vel: 0.12 * v });
  },
  kick: (d, t, v) => {
    blip(d, t, 140, { type: 'sine', dur: 0.08, slide: 0.6, vel: 0.35 * v });
    noiseBurst(d, t, { dur: 0.05, vel: 0.12 * v, from: 1200 });
  },
  // Etapa 9 (synthesized, provisional): a water drop in the cave
  drip: (d, t, v) => blip(d, t, rnd(1500, 1900), { type: 'sine', dur: 0.12, slide: 0.45, vel: 0.07 * v }),
  // Etapa 7 (synthesized, like the other ability sounds): the paw swipe's whoosh and the "ouch" of a hit taken
  swipe: (d, t, v) => noiseBurst(d, t, { dur: 0.14, vel: 0.16 * v, from: 2600, to: 700, q: 1.4 }),
  hurt: (d, t, v) => {
    blip(d, t, 520, { type: 'triangle', dur: 0.18, slide: 0.55, vel: 0.2 * v });
    noiseBurst(d, t, { dur: 0.08, vel: 0.1 * v, from: 900 });
  },
  goal: (d, t, v) => {
    [72, 76, 79, 84, 88].forEach((m, i) => bell(d, t + i * 0.06, midiToFreq(m), 0.3 * v, 1));
    meowVoice(d, t + 0.35, 760, 'happy', 0.35 * v, 0.45);
  },
  flop: (d, t, v) => {
    blip(d, t, rnd(300, 380), { type: 'sine', dur: 0.06, slide: 0.6, vel: 0.14 * v });
    noiseBurst(d, t, { dur: 0.12, vel: 0.08 * v, from: 2500, to: 900 });
  },
  // a Gema do Saber: a quick crystal arpeggio with a soft shimmer
  gem: (d, t, v) => {
    [88, 92, 95, 100].forEach((m, i) => bell(d, t + i * 0.055, midiToFreq(m), 0.16 * v, 1.1));
    noiseBurst(d, t + 0.05, { dur: 0.5, vel: 0.025 * v, type: 'highpass', from: 7000, attack: 0.05 });
  },
  fireworks: (d, t, v) => blip(d, t, 600, { type: 'sine', dur: 0.6, slide: 3, vel: 0.08 * v }),
  firework_pop: (d, t, v) => {
    noiseBurst(d, t, { dur: 0.35, vel: 0.35 * v, type: 'lowpass', from: 3000, to: 300 });
    for (let i = 0; i < 4; i++) blip(d, t + 0.15 + i * 0.05, rnd(2000, 4000), { type: 'sine', dur: 0.05, vel: 0.05 * v });
  },
  giggle: (d, t, v) => {
    for (let i = 0; i < 3; i++) blip(d, t + i * 0.09, rnd(1100, 1400), { type: 'triangle', dur: 0.06, slide: 1.3, vel: 0.12 * v });
  },
  chatter: (d, t, v) => {
    for (let i = 0; i < 6; i++) {
      blip(d, t + i * rnd(0.08, 0.14), rnd(220, 420), { type: 'triangle', dur: 0.06, slide: rnd(0.8, 1.2), vel: 0.035 * v });
    }
  },
};

const rules: Record<string, Rule> = {
  step_grass: { gap: 0.09, max: 2 }, step_stone: { gap: 0.09, max: 2 }, step_wood: { gap: 0.09, max: 2 },
  jump: { gap: 0.15 }, double_jump: { gap: 0.15 }, land: { gap: 0.2 },
  splash: { gap: 0.8 }, player_meow: { gap: 0.6 }, purr: { gap: 20 },
  blip: { gap: 0.045, max: 2 }, coin: { gap: 0.08, max: 3 }, ui_select: { gap: 0.05 },
  gem: { gap: 0.3 }, ui_open: { gap: 0.15 }, ui_close: { gap: 0.15 }, item: { gap: 0.2 },
  temple_bell: { gap: 2.5 }, shuriken: { gap: 0.1, max: 3 }, target_hit: { gap: 0.08 }, dash: { gap: 0.2 }, potion: { gap: 0.5 }, wish: { gap: 0.5 }, chest: { gap: 0.5 },
  bird: { gap: 0.6, max: 2, bus: 'ambient' }, chime: { gap: 2, bus: 'ambient' }, thwack: { gap: 0.4, bus: 'ambient' },
  sizzle: { gap: 1, bus: 'ambient' }, firework_pop: { gap: 0.1, max: 3 }, flop: { gap: 0.3 }, giggle: { gap: 1.2 }, boing: { gap: 0.15 }, swipe: { gap: 0.12 }, hurt: { gap: 0.3 }, drip: { gap: 0.4, bus: 'ambient' }, chatter: { gap: 0.6, bus: 'ambient' }, voice_snore: { gap: 1.5 },
};

const lastPlayed = new Map<string, number>();
const playing = new Map<string, number>();

export function playSfx(name: string, opts: SfxOptions = {}) {
  if (!audio.ready) return;
  const recipe = recipes[name] ?? (name.endsWith('_run') ? recipes[name.replace('_run', '')] : undefined);
  if (!recipe) return;
  const base = name.replace('_run', '');
  const rule = rules[base] ?? {};
  const t = audio.time;
  if (rule.gap && t - (lastPlayed.get(base) ?? -99) < rule.gap) return;
  if (rule.max && (playing.get(base) ?? 0) >= rule.max) return;
  lastPlayed.set(base, t);
  playing.set(base, (playing.get(base) ?? 0) + 1);
  setTimeout(() => playing.set(base, Math.max(0, (playing.get(base) ?? 1) - 1)), 400);

  const bus = rule.bus ?? 'sfx';
  const dest = opts.position ? audio.spatial(...opts.position, bus) : audio.buses[bus];
  const v = name.endsWith('_run') ? 1.25 : 1;

  if (AUDIO_FILES[`sfx:${base}`]) {
    loadAudioFile(`sfx:${base}`).then((buf) => {
      if (!buf) return recipe(dest, audio.time + 0.005, v, opts);
      const src = audio.ctx!.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.95 + Math.random() * 0.1;
      // level-matched to the synthesized mix (fileLevels.ts), with the same small variation as the recipes
      const g = audio.ctx!.createGain();
      g.gain.value = (FILE_GAIN[`sfx:${base}`] ?? 1) * v * (0.92 + Math.random() * 0.16);
      src.connect(g).connect(dest);
      src.start();
    });
    return;
  }
  recipe(dest, t + 0.005, v, opts);
}
