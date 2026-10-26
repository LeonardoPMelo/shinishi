import { audio } from './engine';

/**
 * Synthesized instruments — PROVISIONAL placeholders until licensed/recorded audio exists.
 * Inspired by the palette of ninja anime soundtracks (shakuhachi, shamisen, koto, taiko)
 * plus a playful "meow" lead for the feline humor.
 */

export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function finish(node: AudioScheduledSourceNode, end: number) {
  node.onended = () => audio.releaseVoice();
  node.stop(end);
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number, sustain = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + attack + decay);
}

function noiseSource(t: number, dur: number) {
  const ctx = audio.ctx!;
  const src = ctx.createBufferSource();
  src.buffer = audio.noise;
  src.loop = true;
  src.loopStart = Math.random();
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur);
  return src;
}

export type Dest = AudioNode;

/** Bright plucked lute with a short buzz. */
export function shamisen(dest: Dest, t: number, freq: number, vel = 0.5) {
  if (!audio.claimVoice()) return;
  const ctx = audio.ctx!;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(freq * 1.01, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 4;
  f.frequency.setValueAtTime(4200, t);
  f.frequency.exponentialRampToValueAtTime(700, t + 0.25);
  const g = ctx.createGain();
  env(g, t, vel * 0.32, 0.004, 0.45);
  o.connect(f).connect(g).connect(dest);
  o.start(t);
  finish(o, t + 0.55);
}

/** Softer, longer plucked zither. */
export function koto(dest: Dest, t: number, freq: number, vel = 0.5) {
  if (!audio.claimVoice()) return;
  const ctx = audio.ctx!;
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2.005;
  const g = ctx.createGain();
  env(g, t, vel * 0.3, 0.005, 1.4);
  const g2 = ctx.createGain();
  g2.gain.value = 0.25;
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(dest);
  o.start(t);
  o2.start(t);
  o2.stop(t + 1.5);
  finish(o, t + 1.5);
}

/** Breathy bamboo flute with vibrato and a scoop into the note. */
export function shakuhachi(dest: Dest, t: number, freq: number, dur: number, vel = 0.5) {
  if (!audio.claimVoice()) return;
  const ctx = audio.ctx!;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq * 0.94, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.2;
  const vibGain = ctx.createGain();
  vibGain.gain.setValueAtTime(0, t);
  vibGain.gain.linearRampToValueAtTime(freq * 0.012, t + Math.min(dur, 0.6));
  vib.connect(vibGain).connect(o.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel * 0.26, t + 0.09);
  g.gain.setValueAtTime(vel * 0.24, t + Math.max(0.1, dur - 0.15));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
  const breath = noiseSource(t, dur + 0.25);
  const bf = ctx.createBiquadFilter();
  bf.type = 'bandpass';
  bf.frequency.value = freq * 2;
  bf.Q.value = 2;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(vel * 0.08, t);
  bg.gain.exponentialRampToValueAtTime(vel * 0.015, t + 0.25);
  breath.connect(bf).connect(bg).connect(g);
  o.connect(g).connect(dest);
  o.start(t);
  vib.start(t);
  vib.stop(t + dur + 0.25);
  finish(o, t + dur + 0.25);
}

export function taiko(dest: Dest, t: number, vel = 0.7, pitch = 1) {
  if (!audio.claimVoice()) return;
  const ctx = audio.ctx!;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(110 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(48 * pitch, t + 0.3);
  const g = ctx.createGain();
  env(g, t, vel * 0.9, 0.003, 0.5);
  o.connect(g).connect(dest);
  const n = noiseSource(t, 0.12);
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 900;
  const ng = ctx.createGain();
  env(ng, t, vel * 0.35, 0.002, 0.08);
  n.connect(nf).connect(ng).connect(dest);
  o.start(t);
  finish(o, t + 0.6);
}

export function kick(dest: Dest, t: number, vel = 0.7) {
  if (!audio.claimVoice()) return;
  const ctx = audio.ctx!;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const g = ctx.createGain();
  env(g, t, vel * 0.85, 0.002, 0.28);
  o.connect(g).connect(dest);
  o.start(t);
  finish(o, t + 0.32);
}

export function snare(dest: Dest, t: number, vel = 0.6) {
  if (!audio.claimVoice()) return;
  const ctx = audio.ctx!;
  const n = noiseSource(t, 0.2);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 1400;
  const g = ctx.createGain();
  env(g, t, vel * 0.4, 0.002, 0.16);
  n.connect(f).connect(g).connect(dest);
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
  const og = ctx.createGain();
  env(og, t, vel * 0.3, 0.002, 0.08);
  o.connect(og).connect(dest);
  o.start(t);
  finish(o, t + 0.2);
}

/** Hand percussion: 'h' shaker/hat, 'w' woodblock, 'c' clap. */
export function perc(dest: Dest, t: number, kind: 'h' | 'w' | 'c', vel = 0.5) {
  if (!audio.claimVoice()) return;
  const ctx = audio.ctx!;
  if (kind === 'w') {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(1250 + Math.random() * 60, t);
    const g = ctx.createGain();
    env(g, t, vel * 0.3, 0.001, 0.06);
    o.connect(g).connect(dest);
    o.start(t);
    finish(o, t + 0.1);
    return;
  }
  const n = noiseSource(t, kind === 'c' ? 0.15 : 0.08);
  const f = ctx.createBiquadFilter();
  f.type = kind === 'c' ? 'bandpass' : 'highpass';
  f.frequency.value = kind === 'c' ? 1600 : 7000;
  const g = ctx.createGain();
  env(g, t, vel * (kind === 'c' ? 0.35 : 0.14), 0.001, kind === 'c' ? 0.12 : 0.05);
  n.connect(f).connect(g).connect(dest);
  n.onended = () => audio.releaseVoice();
}

export function bass(dest: Dest, t: number, freq: number, dur: number, vel = 0.6) {
  if (!audio.claimVoice()) return;
  const ctx = audio.ctx!;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = freq;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(260, t + 0.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel * 0.22, t + 0.01);
  g.gain.exponentialRampToValueAtTime(vel * 0.12, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(dest);
  o.start(t);
  finish(o, t + dur + 0.02);
}

export function pad(dest: Dest, t: number, freqs: number[], dur: number, vel = 0.4) {
  const ctx = audio.ctx!;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel * 0.07, t + Math.min(0.8, dur * 0.4));
  g.gain.setValueAtTime(vel * 0.07, t + dur * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1100;
  f.connect(g).connect(dest);
  for (const fr of freqs) {
    for (const det of [-6, 6]) {
      if (!audio.claimVoice()) continue;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = fr;
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      finish(o, t + dur + 0.7);
    }
  }
}

/** Bell / chime with inharmonic partials (temple bells, wind chimes, rewards). */
export function bell(dest: Dest, t: number, freq: number, vel = 0.5, length = 1.6) {
  const ctx = audio.ctx!;
  const g = ctx.createGain();
  g.connect(dest);
  [[1, 1], [2.76, 0.35], [5.4, 0.18], [0.5, 0.25]].forEach(([mult, amp]) => {
    if (!audio.claimVoice()) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    const og = ctx.createGain();
    env(og, t, vel * 0.22 * amp, 0.002, length / mult ** 0.3);
    o.connect(og).connect(g);
    o.start(t);
    finish(o, t + length + 0.1);
  });
}

/**
 * The comic "meow lead": a formant-filtered saw that glides like a cat's "miau".
 * contour: 'meow' (rise-fall), 'mrrp' (short rise), 'mew' (high & short), 'sad' (falling).
 */
export function meowVoice(dest: Dest, t: number, base: number, contour: 'meow' | 'mrrp' | 'mew' | 'sad' | 'happy' = 'meow', vel = 0.5, length = 0.45) {
  if (!audio.claimVoice(true)) return;
  const ctx = audio.ctx!;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  const fq = o.frequency;
  const d = length;
  fq.setValueAtTime(base * 0.85, t);
  switch (contour) {
    case 'mrrp':
      fq.linearRampToValueAtTime(base * 1.25, t + d * 0.6);
      fq.linearRampToValueAtTime(base * 1.4, t + d);
      break;
    case 'mew':
      fq.setValueAtTime(base * 1.3, t);
      fq.linearRampToValueAtTime(base * 1.55, t + d * 0.5);
      fq.linearRampToValueAtTime(base * 1.2, t + d);
      break;
    case 'sad':
      fq.linearRampToValueAtTime(base * 1.1, t + d * 0.3);
      fq.linearRampToValueAtTime(base * 0.7, t + d);
      break;
    case 'happy':
      fq.linearRampToValueAtTime(base * 1.5, t + d * 0.45);
      fq.linearRampToValueAtTime(base * 1.25, t + d * 0.7);
      fq.linearRampToValueAtTime(base * 1.6, t + d);
      break;
    default:
      fq.linearRampToValueAtTime(base * 1.35, t + d * 0.45);
      fq.linearRampToValueAtTime(base * 0.9, t + d);
  }
  const vib = ctx.createOscillator();
  vib.frequency.value = 7;
  const vg = ctx.createGain();
  vg.gain.value = base * 0.02;
  vib.connect(vg).connect(fq);
  // Two formants sweeping "m-e-o-w".
  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass';
  f1.Q.value = 6;
  f1.frequency.setValueAtTime(500, t);
  f1.frequency.linearRampToValueAtTime(950, t + d * 0.4);
  f1.frequency.linearRampToValueAtTime(600, t + d);
  const f2 = ctx.createBiquadFilter();
  f2.type = 'bandpass';
  f2.Q.value = 8;
  f2.frequency.setValueAtTime(1500, t);
  f2.frequency.linearRampToValueAtTime(2300, t + d * 0.4);
  f2.frequency.linearRampToValueAtTime(1100, t + d);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel * 0.9, t + 0.05);
  g.gain.setValueAtTime(vel * 0.8, t + d * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
  o.connect(f1).connect(g);
  o.connect(f2).connect(g);
  g.connect(dest);
  o.start(t);
  vib.start(t);
  vib.stop(t + d + 0.1);
  finish(o, t + d + 0.1);
}

/** Filtered noise burst (whooshes, splashes, rustles). */
export function noiseBurst(dest: Dest, t: number, opts: {
  dur: number; vel?: number; type?: BiquadFilterType; from?: number; to?: number; q?: number; attack?: number;
}) {
  if (!audio.claimVoice()) return;
  const ctx = audio.ctx!;
  const n = noiseSource(t, opts.dur + 0.05);
  const f = ctx.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.Q.value = opts.q ?? 1;
  f.frequency.setValueAtTime(opts.from ?? 1000, t);
  f.frequency.exponentialRampToValueAtTime(opts.to ?? opts.from ?? 1000, t + opts.dur);
  const g = ctx.createGain();
  env(g, t, opts.vel ?? 0.3, opts.attack ?? 0.005, opts.dur);
  n.connect(f).connect(g).connect(dest);
  n.onended = () => audio.releaseVoice();
}

/** Simple pitched blip (UI, dialogue voices, coins). */
export function blip(dest: Dest, t: number, freq: number, opts: { type?: OscillatorType; dur?: number; vel?: number; slide?: number } = {}) {
  if (!audio.claimVoice()) return;
  const ctx = audio.ctx!;
  const o = ctx.createOscillator();
  o.type = opts.type ?? 'triangle';
  o.frequency.setValueAtTime(freq, t);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(freq * opts.slide, t + (opts.dur ?? 0.1));
  const g = ctx.createGain();
  env(g, t, opts.vel ?? 0.25, 0.003, opts.dur ?? 0.1);
  o.connect(g).connect(dest);
  o.start(t);
  finish(o, t + (opts.dur ?? 0.1) + 0.05);
}
