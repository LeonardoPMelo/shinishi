import { audio, loadAudioFile } from './engine';
import { FILE_GAIN } from './fileLevels';
import { shamisen, koto, shakuhachi, taiko, kick, snare, perc, bass, pad, bell, meowVoice, midiToFreq, blip, noiseBurst } from './instruments';

/**
 * PROVISIONAL procedural soundtrack. These are short looping themes written as note patterns
 * and played by synthesized instruments — not final recorded music. Each can be replaced by a
 * licensed file through AUDIO_FILES (engine.ts) using the same track id.
 *
 * Notation (one bar = 8 eighth-notes, space separated):
 *   number = scale degree (5 = one octave up, negatives go down)   . = rest   - = hold
 * Drums (one bar = 16 sixteenths): T taiko, t small taiko, K kick, S snare, h hat, w woodblock, c clap.
 */

export type TrackId =
  | 'menu' | 'village' | 'forest' | 'training' | 'investigation'
  | 'puzzle' | 'emotional' | 'festival' | 'comic' | 'secret';

type Inst = 'shamisen' | 'koto' | 'shakuhachi' | 'bell' | 'arp';

interface Part {
  inst: Inst;
  bars: string[];
  octave?: number;
  vel?: number;
  from?: number;
  every?: number;
}

interface DrumPart {
  bars: string[];
  vel?: number;
  from?: number;
}

interface TrackDef {
  bpm: number;
  root: number;
  scale: number[];
  /** Chords as semitones relative to root, one per bar. */
  chords: number[][];
  parts: Part[];
  drums?: DrumPart[];
  bass?: { pattern: string; vel?: number; from?: number };
  pad?: { vel?: number; from?: number };
  meows?: number;
}

const YO = [0, 2, 5, 7, 9];
const MAJ_PENTA = [0, 2, 4, 7, 9];
const MIN_PENTA = [0, 3, 5, 7, 10];
const HIRAJOSHI = [0, 2, 3, 7, 8];
const IN_SCALE = [0, 1, 5, 7, 8];

export const TRACKS: Record<TrackId, TrackDef> = {
  menu: {
    bpm: 74, root: 62, scale: HIRAJOSHI,
    chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]],
    parts: [
      { inst: 'shakuhachi', bars: ['3 - - 4 3 - 2 -', '1 - - - 0 - - -', '2 - 3 - 5 - - 4', '3 - - - - - . .'], vel: 0.55 },
      { inst: 'arp', bars: ['0 1 2 3 2 1 0 1'], octave: 12, vel: 0.22 },
    ],
    pad: { vel: 0.6 },
    drums: [{ bars: ['T.......t.......', '................', 'T.......t.......', '........t...t...'], vel: 0.35, from: 1 }],
  },
  village: {
    bpm: 104, root: 67, scale: YO,
    chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2], [0, 4, 7], [-3, 0, 4], [-7, -3, 0], [0, 4, 7]],
    parts: [
      {
        inst: 'shamisen', vel: 0.5,
        bars: ['3 . 4 5 4 . 3 2', '1 - 3 . 2 - . .', '2 . 3 4 5 . 4 3', '4 - - - . . 3 4', '5 . 6 5 4 . 3 2', '3 - 2 . 1 - . .', '2 . 1 2 3 . 4 2', '0 - - - . . . .'],
      },
      { inst: 'arp', bars: ['0 . 2 . 1 . 2 .'], octave: 12, vel: 0.18, from: 1 },
      { inst: 'shakuhachi', bars: ['5 - - - - - - -', '4 - - - - - - -', '5 - - - - - - -', '6 - - - - - - -'], vel: 0.25, from: 2, every: 2 },
    ],
    bass: { pattern: 'R . . R F . R .', vel: 0.45 },
    pad: { vel: 0.35, from: 1 },
    drums: [
      { bars: ['w...h.h.w..wh.h.'], vel: 0.45 },
      { bars: ['T...............', '................', '................', '........t.t.....'], vel: 0.45, from: 1 },
    ],
    meows: 0.35,
  },
  forest: {
    bpm: 112, root: 64, scale: MIN_PENTA,
    chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7]],
    parts: [
      { inst: 'koto', bars: ['0 2 3 . 4 3 2 .', '3 . 2 0 1 . . .', '0 2 3 5 4 . 3 2', '3 - - - . . . .'], vel: 0.55 },
      { inst: 'shakuhachi', bars: ['5 - - - 4 - - -', '3 - - - - - - -', '5 - - - 7 - - -', '6 - - - - - - -'], vel: 0.3, from: 1, every: 2 },
    ],
    bass: { pattern: 'R . R . F . R .', vel: 0.4 },
    pad: { vel: 0.3 },
    drums: [
      { bars: ['h.h.w.h.h.hwh.h.'], vel: 0.35 },
      { bars: ['K.......K.......'], vel: 0.4, from: 1 },
    ],
    meows: 0.15,
  },
  training: {
    bpm: 138, root: 64, scale: MIN_PENTA,
    chords: [[0, 3, 7], [3, 7, 10], [5, 9, 12], [-2, 2, 5]],
    parts: [
      { inst: 'shamisen', bars: ['0 0 3 0 5 0 4 3', '0 0 3 0 5 7 5 4', '0 0 3 0 5 0 4 3', '7 5 4 3 2 3 . .'], vel: 0.5 },
      { inst: 'shakuhachi', bars: ['5 - - 7 - 6 5 -', '4 - - - 3 - - -', '5 - - 7 - 8 7 -', '9 - - - - - . .'], vel: 0.4, from: 1 },
    ],
    bass: { pattern: 'R R . R F R . F', vel: 0.55 },
    drums: [
      { bars: ['K..hS..hK.KhS..h'], vel: 0.55 },
      { bars: ['T...t...T...t.tt'], vel: 0.5 },
    ],
  },
  investigation: {
    bpm: 88, root: 62, scale: IN_SCALE,
    chords: [[0, 7], [0, 7], [1, 8], [0, 7]],
    parts: [
      { inst: 'koto', bars: ['0 . . 2 . . . .', '. . 3 . 1 . . .', '0 . . 2 . 4 . .', '3 . . . . . . .'], vel: 0.5 },
      { inst: 'bell', bars: ['. . . . . . . .', '. . . . . . . .', '. . . . . . . .', '. . . . . . 7 .'], vel: 0.35, from: 1 },
    ],
    bass: { pattern: 'R . . . . . . .', vel: 0.4 },
    pad: { vel: 0.45 },
    drums: [
      { bars: ['w.......w...w...'], vel: 0.3 },
      { bars: ['T...............', '................'], vel: 0.35, from: 2 },
    ],
  },
  puzzle: {
    bpm: 84, root: 69, scale: YO,
    chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
    parts: [
      { inst: 'arp', bars: ['0 1 2 3 2 1 2 1'], vel: 0.22 },
      { inst: 'bell', bars: ['. . . . . . . .', '5 . . . . . . .', '. . . . . . . .', '4 . . . . . . .'], vel: 0.25, from: 1 },
    ],
    bass: { pattern: 'R . . . . . . .', vel: 0.3 },
    pad: { vel: 0.4 },
  },
  emotional: {
    bpm: 66, root: 62, scale: MAJ_PENTA,
    chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
    parts: [
      { inst: 'shakuhachi', bars: ['2 - - 3 4 - - -', '3 - 2 - 1 - - -', '0 - 1 2 3 - 4 -', '2 - - - - - . .'], vel: 0.55 },
      { inst: 'arp', bars: ['0 . 1 . 2 . 1 .'], octave: 12, vel: 0.18 },
    ],
    pad: { vel: 0.55 },
    bass: { pattern: 'R . . . F . . .', vel: 0.3 },
  },
  festival: {
    bpm: 132, root: 65, scale: YO,
    chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
    parts: [
      { inst: 'shamisen', bars: ['5 4 5 6 5 4 2 4', '5 - 4 2 1 - . .', '2 4 5 4 2 1 0 1', '2 - - - 5 - - -'], vel: 0.55 },
      { inst: 'bell', bars: ['10 . . . . . . .', '. . . . . . . .', '9 . . . . . . .', '. . . . 10 . . .'], vel: 0.3 },
      { inst: 'arp', bars: ['0 2 1 2 0 2 1 2'], octave: 12, vel: 0.15, from: 1 },
    ],
    bass: { pattern: 'R . F . R . F .', vel: 0.5 },
    drums: [
      { bars: ['K.h.ShhhK.h.S.hc'], vel: 0.5 },
      { bars: ['T.......T.t.....'], vel: 0.45 },
    ],
    meows: 0.6,
  },
  comic: {
    bpm: 120, root: 60, scale: MAJ_PENTA,
    chords: [[0, 4, 7], [-5, -1, 2], [0, 4, 7], [-5, -1, 2]],
    parts: [
      { inst: 'koto', bars: ['0 . 2 . 4 . . .', '3 . 1 . -1 . . .', '0 . 2 . 4 . 5 .', '. . . . 7 . . .'], vel: 0.55 },
    ],
    bass: { pattern: 'R . F . R . F .', vel: 0.5 },
    drums: [{ bars: ['w...w...w...c...', 'w...w...w.w.c...', 'w...w...w...c...', '........c.c.c...'], vel: 0.45 }],
    meows: 0.9,
  },
  secret: {
    bpm: 70, root: 57, scale: IN_SCALE,
    chords: [[0, 7], [1, 8], [0, 7], [-2, 5]],
    parts: [
      { inst: 'koto', bars: ['0 . . . 3 . . .', '2 . . 1 . . . .', '0 . 3 . 4 . . .', '5 . . . . . . .'], vel: 0.45 },
      { inst: 'bell', bars: ['7 . . . . . . .', '. . . . 8 . . .'], vel: 0.3 },
    ],
    pad: { vel: 0.6 },
  },
};

interface NoteEvent { pos: number; deg: number; len: number }

function parseBar(bar: string): NoteEvent[] {
  const tokens = bar.trim().split(/\s+/);
  const out: NoteEvent[] = [];
  tokens.forEach((tok, i) => {
    if (tok === '.' || tok === '-') return;
    let len = 1;
    while (tokens[i + len] === '-') len++;
    out.push({ pos: i, deg: Number(tok), len });
  });
  return out;
}

const degreeToSemis = (scale: number[], deg: number) => {
  const n = scale.length;
  const oct = Math.floor(deg / n);
  return scale[((deg % n) + n) % n] + oct * 12;
};

/**
 * Loop points that skip silence at the ends of a file (encoders and recorders often pad a few
 * milliseconds), so a track meant to loop seamlessly doesn't get a tiny gap every time round.
 */
const loopCache = new WeakMap<AudioBuffer, [number, number]>();
function loopBounds(buf: AudioBuffer): [number, number] {
  const hit = loopCache.get(buf);
  if (hit) return hit;
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const loud = (i: number) => chans.some((d) => Math.abs(d[i]) > 0.001);
  let a = 0;
  while (a < buf.length - 1 && !loud(a)) a++;
  let e = buf.length - 1;
  while (e > a && !loud(e)) e--;
  // only trim real padding (over 5 ms); a track that starts on a quiet note keeps its first sample
  const start = a / buf.sampleRate > 0.005 ? a / buf.sampleRate : 0;
  const end = (buf.length - 1 - e) / buf.sampleRate > 0.005 ? (e + 1) / buf.sampleRate : buf.duration;
  const bounds: [number, number] = [start, end];
  loopCache.set(buf, bounds);
  return bounds;
}

class TrackPlayer {
  readonly out: GainNode;
  private step = 0;
  private loop = 0;
  private nextTime: number;
  stopped = false;
  private parsed: { part: Part; bars: NoteEvent[][] }[];
  private file: AudioBufferSourceNode | null = null;

  constructor(readonly id: TrackId, readonly def: TrackDef, startAt: number) {
    const ctx = audio.ctx!;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(audio.buses.music);
    const send = ctx.createGain();
    send.gain.value = 0.5;
    this.out.connect(send).connect(audio.reverbSend);
    this.nextTime = startAt;
    this.parsed = def.parts.map((part) => ({ part, bars: part.bars.map(parseBar) }));
    loadAudioFile(`music:${id}`).then((buf) => {
      if (!buf || this.stopped) return;
      this.file = ctx.createBufferSource();
      this.file.buffer = buf;
      this.file.loop = true;
      const [loopStart, loopEnd] = loopBounds(buf);
      this.file.loopStart = loopStart;
      this.file.loopEnd = loopEnd;
      const level = ctx.createGain();
      level.gain.value = FILE_GAIN[`music:${id}`] ?? 1;
      this.file.connect(level).connect(this.out);
      this.file.start(audio.time, loopStart);
    });
  }

  get barCount() {
    return this.def.chords.length;
  }

  fade(to: number, seconds: number) {
    const t = audio.time;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(to, t + seconds);
  }

  stopAfter(seconds: number) {
    this.fade(0, seconds);
    setTimeout(() => {
      this.stopped = true;
      this.file?.stop();
      this.out.disconnect();
    }, seconds * 1000 + 300);
  }

  tick(horizon: number) {
    if (this.stopped || this.file) return;
    const sixteenth = 60 / this.def.bpm / 4;
    while (this.nextTime < horizon) {
      this.schedule(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
      if (this.step >= this.barCount * 16) {
        this.step = 0;
        this.loop++;
      }
    }
  }

  private schedule(step: number, t: number, sixteenth: number) {
    const d = this.def;
    const bar = Math.floor(step / 16);
    const inBar = step % 16;
    const chord = d.chords[bar];
    const rootFreq = (semi: number) => midiToFreq(d.root + semi);
    const dest = this.out;

    for (const drum of d.drums ?? []) {
      if (this.loop < (drum.from ?? 0)) continue;
      const pattern = drum.bars[bar % drum.bars.length];
      const ch = pattern[inBar];
      const v = (drum.vel ?? 0.5) * (0.85 + Math.random() * 0.2);
      if (ch === 'T') taiko(dest, t, v);
      else if (ch === 't') taiko(dest, t, v * 0.6, 1.5);
      else if (ch === 'K') kick(dest, t, v);
      else if (ch === 'S') snare(dest, t, v);
      else if (ch === 'h') perc(dest, t, 'h', v);
      else if (ch === 'w') perc(dest, t, 'w', v);
      else if (ch === 'c') perc(dest, t, 'c', v);
    }

    if (inBar % 2 !== 0) return;
    const eighth = inBar / 2;
    const eighthDur = sixteenth * 2;

    if (d.pad && eighth === 0 && this.loop >= (d.pad.from ?? 0)) {
      pad(dest, t, chord.map((s) => rootFreq(s - 12)), eighthDur * 8, d.pad.vel ?? 0.4);
    }

    if (d.bass && this.loop >= (d.bass.from ?? 0)) {
      const tok = d.bass.pattern.split(/\s+/)[eighth];
      const root = chord[0];
      const semi = tok === 'R' ? root : tok === 'F' ? root + 7 : tok === 'O' ? root + 12 : null;
      if (semi !== null) bass(dest, t, rootFreq(semi - 24), eighthDur * 1.6, d.bass.vel ?? 0.5);
    }

    for (const { part, bars } of this.parsed) {
      if (this.loop < (part.from ?? 0)) continue;
      if (part.every && this.loop % part.every !== 0) continue;
      const events = bars[bar % bars.length];
      for (const ev of events) {
        if (ev.pos !== eighth) continue;
        const vel = (part.vel ?? 0.5) * (0.9 + Math.random() * 0.15);
        const oct = part.octave ?? 0;
        if (part.inst === 'arp') {
          const tones = [...chord, chord[0] + 12];
          const semi = tones[Math.abs(ev.deg) % tones.length];
          koto(dest, t, rootFreq(semi + oct), vel);
          continue;
        }
        const freq = rootFreq(degreeToSemis(d.scale, ev.deg) + oct);
        if (part.inst === 'shamisen') shamisen(dest, t, freq, vel);
        else if (part.inst === 'koto') koto(dest, t, freq, vel);
        else if (part.inst === 'bell') bell(dest, t, freq, vel);
        else shakuhachi(dest, t, freq, eighthDur * ev.len * 0.95, vel);
      }
    }

    // Feline humor: an occasional "miau" fill on the last beat of a phrase.
    if (d.meows && eighth === 6 && bar % 4 === 3 && this.loop > 0 && Math.random() < d.meows) {
      const contours = ['meow', 'mrrp', 'mew', 'happy'] as const;
      meowVoice(dest, t, rootFreq(degreeToSemis(d.scale, 5)), contours[Math.floor(Math.random() * contours.length)], 0.22, 0.4);
    }
  }
}

/** Plays one track at a time with crossfades; never restarts the track that is already playing. */
class MusicDirector {
  private current: TrackPlayer | null = null;
  private fading: TrackPlayer[] = [];
  private wanted: TrackId | null = null;
  private timer: number | null = null;

  request(id: TrackId | null, fadeSeconds = 2.2) {
    this.wanted = id;
    if (!audio.ready) {
      audio.onUnlock(() => this.request(this.wanted, 1.5));
      return;
    }
    if (this.current?.id === id) return;
    if (this.current) {
      this.current.stopAfter(fadeSeconds);
      this.fading.push(this.current);
      this.current = null;
    }
    if (id) {
      const player = new TrackPlayer(id, TRACKS[id], audio.time + 0.12);
      player.fade(1, fadeSeconds);
      this.current = player;
    }
    this.ensureTimer();
  }

  get playing(): TrackId | null {
    return this.current?.id ?? null;
  }

  private ensureTimer() {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => {
      if (!audio.ready) return;
      const horizon = audio.time + 0.15;
      this.current?.tick(horizon);
      this.fading = this.fading.filter((p) => !p.stopped);
      this.fading.forEach((p) => p.tick(horizon));
    }, 25);
  }
}

export const music = new MusicDirector();

// ── Stingers: short one-shot musical phrases ────────────────────────────────

export type StingerId = 'victory' | 'step' | 'levelUp' | 'secret' | 'missionStart' | 'comic' | 'learn';

export function stinger(id: StingerId) {
  if (!audio.ready) return;
  const dest = audio.buses.music;
  const t = audio.time + 0.03;
  const n = (m: number) => midiToFreq(m);
  switch (id) {
    case 'victory': {
      [67, 71, 74, 79].forEach((m, i) => shamisen(dest, t + i * 0.09, n(m), 0.6));
      taiko(dest, t, 0.8);
      taiko(dest, t + 0.36, 0.8);
      bell(dest, t + 0.36, n(91), 0.5, 2.2);
      bell(dest, t + 0.36, n(86), 0.4, 2.2);
      pad(dest, t + 0.36, [n(55), n(59), n(62), n(67)], 1.6, 0.8);
      meowVoice(dest, t + 0.9, n(79), 'happy', 0.35, 0.5);
      break;
    }
    case 'step':
      [79, 83, 86].forEach((m, i) => koto(dest, t + i * 0.08, n(m), 0.55));
      break;
    case 'missionStart':
      taiko(dest, t, 0.7);
      [62, 65, 69].forEach((m, i) => shamisen(dest, t + 0.1 + i * 0.1, n(m), 0.5));
      shakuhachi(dest, t + 0.42, n(74), 0.7, 0.5);
      break;
    case 'levelUp':
      [72, 76, 79, 84, 88].forEach((m, i) => bell(dest, t + i * 0.07, n(m), 0.4, 1.2));
      break;
    case 'secret':
      [69, 72, 76, 81, 84].forEach((m, i) => koto(dest, t + i * 0.12, n(m), 0.5));
      bell(dest, t + 0.6, n(93), 0.45, 2.5);
      break;
    case 'learn':
      noiseBurst(dest, t, { dur: 0.5, vel: 0.25, from: 400, to: 4000, q: 2 });
      [64, 67, 71, 76].forEach((m, i) => bell(dest, t + 0.2 + i * 0.08, n(m + 12), 0.35, 1.2));
      break;
    case 'comic':
      blip(dest, t, 400, { type: 'sine', dur: 0.5, slide: 3, vel: 0.3 });
      blip(dest, t + 0.5, 1200, { type: 'sine', dur: 0.4, slide: 0.3, vel: 0.3 });
      break;
  }
}
