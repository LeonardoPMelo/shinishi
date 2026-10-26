import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FILE_GAIN } from '../src/audio/fileLevels';
import { recipes } from '../src/audio/sfx';

/** Licensed audio: every file in the manifest exists, replaces a real sound name, and has a measured level. */

const AUDIO = resolve(__dirname, '../public/assets/audio');
const manifest = JSON.parse(readFileSync(resolve(AUDIO, 'manifest.json'), 'utf8')) as { sfx: Record<string, string>; music: Record<string, string> };
const MUSIC_IDS = ['menu', 'village', 'forest', 'training', 'investigation', 'puzzle', 'emotional', 'festival', 'comic', 'secret'];

describe('áudio licenciado', () => {
  it('cada arquivo do manifest existe e é áudio de verdade (não vazio)', () => {
    for (const file of [...Object.values(manifest.sfx), ...Object.values(manifest.music)]) {
      const p = resolve(AUDIO, file);
      expect(existsSync(p), file).toBe(true);
      expect(readFileSync(p).length, file).toBeGreaterThan(1000);
    }
  });

  it('cada efeito substitui um som que o jogo realmente toca, e cada música um trecho que existe', () => {
    for (const name of Object.keys(manifest.sfx)) expect(recipes[name], `sfx ${name}`).toBeDefined();
    for (const id of Object.keys(manifest.music)) expect(MUSIC_IDS, `música ${id}`).toContain(id);
  });

  it('todo arquivo tem um nível medido, e todo nível pertence a um arquivo', () => {
    const keys = [...Object.keys(manifest.sfx).map((n) => `sfx:${n}`), ...Object.keys(manifest.music).map((n) => `music:${n}`)];
    for (const k of keys) {
      expect(FILE_GAIN[k], k).toBeGreaterThan(0);
      expect(FILE_GAIN[k], k).toBeLessThanOrEqual(1);
    }
    for (const k of Object.keys(FILE_GAIN)) expect(keys, k).toContain(k);
  });

  it('os créditos citam cada arquivo usado', () => {
    const credits = readFileSync(resolve(AUDIO, 'CREDITOS.md'), 'utf8');
    for (const file of [...Object.values(manifest.sfx), ...Object.values(manifest.music)]) {
      expect(credits, file).toContain(file.split('/')[1]);
    }
  });
});
