import { useAudioSettings } from './audioSettings';
import { asset } from '../assetPath';

/**
 * Central audio graph:  sources → (music | sfx | ambient) bus → duck → master → destination.
 * The AudioContext is created only after the first user gesture (browser autoplay policy).
 * Every sound is optional: if Web Audio is unavailable the game keeps running silently.
 */
class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  buses!: Record<'music' | 'sfx' | 'ambient', GainNode>;
  musicDuck!: GainNode;
  ambientDuck!: GainNode;
  reverb!: ConvolverNode;
  reverbSend!: GainNode;
  noise!: AudioBuffer;
  private unlockListeners: Array<() => void> = [];
  private activeVoices = 0;
  readonly maxVoices = 72;
  failed = false;

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  get time() {
    return this.ctx?.currentTime ?? 0;
  }

  onUnlock(fn: () => void) {
    if (this.ready) fn();
    else this.unlockListeners.push(fn);
  }

  /** Called from a real user gesture. Never auto-starts audio. */
  unlock() {
    if (this.failed) return;
    try {
      if (!this.ctx) this.build();
      const ctx = this.ctx!;
      if (ctx.state !== 'running') {
        ctx.resume().then(() => this.flushUnlock()).catch(() => undefined);
      } else this.flushUnlock();
    } catch (err) {
      this.failed = true;
      console.warn('[audio] Web Audio indisponível; o jogo segue sem som.', err);
    }
  }

  private flushUnlock() {
    const list = this.unlockListeners;
    this.unlockListeners = [];
    list.forEach((fn) => fn());
  }

  private build() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;

    this.master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;
    this.master.connect(limiter).connect(ctx.destination);

    this.musicDuck = ctx.createGain();
    this.ambientDuck = ctx.createGain();
    this.buses = { music: ctx.createGain(), sfx: ctx.createGain(), ambient: ctx.createGain() };
    this.buses.music.connect(this.musicDuck).connect(this.master);
    this.buses.ambient.connect(this.ambientDuck).connect(this.master);
    this.buses.sfx.connect(this.master);

    // Small generated room reverb, used for music tails and enclosed places.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(1.8);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.18;
    this.reverbSend.connect(this.reverb).connect(this.master);

    this.noise = this.makeNoise(2);
    this.applySettings();
    useAudioSettings.subscribe(() => this.applySettings());

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => undefined);
      else this.ctx.resume().catch(() => undefined);
    });
  }

  applySettings() {
    if (!this.ctx) return;
    const s = useAudioSettings.getState();
    const t = this.ctx.currentTime;
    const set = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, t, 0.05);
    set(this.master, s.muted ? 0 : s.master);
    set(this.buses.music, s.musicMuted ? 0 : s.music * 0.7);
    set(this.buses.sfx, s.sfxMuted ? 0 : s.sfx);
    set(this.buses.ambient, s.ambientMuted ? 0 : s.ambient * 0.8);
  }

  /** Temporarily lower music/ambience (pause menu, dialogue). */
  duck(music: number, ambient: number, seconds = 0.4) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicDuck.gain.setTargetAtTime(music, t, seconds / 3);
    this.ambientDuck.gain.setTargetAtTime(ambient, t, seconds / 3);
  }

  setReverb(amount: number) {
    if (!this.ctx) return;
    this.reverbSend.gain.setTargetAtTime(amount, this.ctx.currentTime, 0.4);
  }

  /** Voice budget so busy moments never pile up hundreds of nodes. */
  claimVoice(important = false): boolean {
    if (!important && this.activeVoices >= this.maxVoices) return false;
    this.activeVoices++;
    return true;
  }

  releaseVoice() {
    this.activeVoices = Math.max(0, this.activeVoices - 1);
  }

  private makeNoise(seconds: number) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private makeImpulse(seconds: number) {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  /** Positional output: returns a node to connect into (panner → bus). */
  spatial(x: number, y: number, z: number, bus: 'sfx' | 'ambient', refDistance = 3, maxDistance = 40) {
    const ctx = this.ctx!;
    const p = ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = refDistance;
    p.maxDistance = maxDistance;
    p.rolloffFactor = 1.3;
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } else p.setPosition(x, y, z);
    p.connect(this.buses[bus]);
    return p;
  }

  setListener(x: number, y: number, z: number, fx: number, fy: number, fz: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener;
    if (l.positionX) {
      const t = ctx.currentTime;
      l.positionX.setTargetAtTime(x, t, 0.05);
      l.positionY.setTargetAtTime(y, t, 0.05);
      l.positionZ.setTargetAtTime(z, t, 0.05);
      l.forwardX.setTargetAtTime(fx, t, 0.05);
      l.forwardY.setTargetAtTime(fy, t, 0.05);
      l.forwardZ.setTargetAtTime(fz, t, 0.05);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      l.setPosition(x, y, z);
      l.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }
}

export const audio = new AudioEngine();

// Optional recorded/licensed files. Leave empty to use the synthesized placeholders.
// Keys: "music:<trackId>" or "sfx:<name>"; values: URLs under /assets/audio/ (e.g. '/assets/audio/music/village.ogg').
export const AUDIO_FILES: Partial<Record<string, string>> = {};

/**
 * Files dropped in public/assets/audio/{sfx,music}/ are listed in manifest.json by
 * `npm run audio:manifest`; loading it here makes them replace the synthesized sounds
 * with no code change. A missing or broken manifest just keeps the placeholders.
 */
// (unit tests have no server to fetch from; they read the manifest from disk instead)
export const audioManifest = (import.meta.env.MODE === 'test' ? Promise.reject(new Error('test')) : fetch(asset('assets/audio/manifest.json')))
  .then((r) => (r.ok ? r.json() : null))
  .then((m: { sfx?: Record<string, string>; music?: Record<string, string> } | null) => {
    for (const [kind, entries] of Object.entries({ sfx: m?.sfx, music: m?.music })) {
      for (const [name, file] of Object.entries(entries ?? {})) AUDIO_FILES[`${kind}:${name}`] = asset(`assets/audio/${file}`);
    }
    return Object.keys(AUDIO_FILES).length;
  })
  .catch(() => 0);

const fileCache = new Map<string, Promise<AudioBuffer | null>>();

/** Loads a file once; resolves to null on any failure so callers fall back to synthesis. */
export function loadAudioFile(key: string): Promise<AudioBuffer | null> {
  const url = AUDIO_FILES[key];
  if (!url || !audio.ctx) return Promise.resolve(null);
  if (!fileCache.has(key)) {
    fileCache.set(
      key,
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((data) => audio.ctx!.decodeAudioData(data))
        .catch((err) => {
          console.warn(`[audio] falha ao carregar "${url}", usando som sintetizado.`, err);
          return null;
        })
    );
  }
  return fileCache.get(key)!;
}
