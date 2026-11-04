import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ENEMIES, type EnemyKind } from '../src/systems/combat';
import { ASSETS } from '../src/game/assets/catalog';
import { ENEMY_CLIPS, clipFor, enemyAsset } from '../src/game/world/EnemyModel';

/** The creatures' Blender models (tools/blender/build_enemies.py) and the contract with world/EnemyModel.tsx. */
const ROOT = resolve(__dirname, '..');

/** The JSON chunk of a GLB (the binary chunk is not needed to check names). */
function glbJson(file: string) {
  const b = readFileSync(file);
  expect(b.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  const len = b.readUInt32LE(12);
  expect(b.readUInt32LE(16)).toBe(0x4e4f534a); // 'JSON'
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8')) as {
    animations?: { name: string }[]; materials?: { name: string }[]; skins?: unknown[]; nodes: { name?: string }[];
  };
}

const KINDS = Object.keys(ENEMIES) as EnemyKind[];

describe('modelos dos bichos das terras selvagens', () => {
  it('cada tipo tem o seu modelo no catálogo, e o arquivo existe, comprimido (< 200 KB)', () => {
    for (const k of KINDS) {
      const name = enemyAsset(k);
      expect(ASSETS[name], name).toBeDefined();
      const file = resolve(ROOT, 'public/assets/models/characters', `${name}.glb`);
      expect(readFileSync(file).length, name).toBeLessThan(200_000);
    }
  });

  it('cada modelo tem esqueleto, as sete animações e os materiais que o jogo conhece', () => {
    const known = new Set(['fur', 'cloth', 'leather', 'metal', 'pad', 'wood', 'eye', 'gloss', 'pupil', 'mouth', 'glass']);
    for (const k of KINDS) {
      const j = glbJson(resolve(ROOT, 'public/assets/models/characters', `${enemyAsset(k)}.glb`));
      expect(j.skins?.length, k).toBe(1);
      const clips = (j.animations ?? []).map((a) => a.name).sort();
      expect(clips, k).toEqual([...ENEMY_CLIPS].sort());
      for (const m of j.materials ?? []) expect(known.has(m.name), `${k}: ${m.name}`).toBe(true);
      const bones = new Set(j.nodes.map((n) => n.name));
      for (const b of ['body', 'head', 'tail.1', 'tail.2']) expect(bones.has(b), `${k}: ${b}`).toBe(true);
      // the spirit floats: no legs
      for (const b of ['leg.FL', 'leg.FR', 'leg.BL', 'leg.BR']) expect(bones.has(b), `${k}: ${b}`).toBe(k !== 'espirito');
    }
  });

  it('o estado escolhe a animação: dormir, tonto, preparo, ataque, correr, andar e parado', () => {
    expect(clipFor('sleep', 0, 1, 3)).toBe('sleep');
    expect(clipFor('calm', 0, 1, 3)).toBe('sleep');
    expect(clipFor('stunned', 0, 1, 3)).toBe('stunned');
    expect(clipFor('defeated', 0, 1, 3)).toBe('stunned');
    expect(clipFor('windup', 0, 1, 3)).toBe('windup');
    expect(clipFor('attack', 8, 1, 3)).toBe('attack');
    expect(clipFor('chase', 3, 1, 3)).toBe('run');
    expect(clipFor('patrol', 1, 1, 3)).toBe('walk');
    expect(clipFor('patrol', 0, 1, 3)).toBe('idle');
    // the boar does not walk (walk speed 0): moving slowly still walks, fast runs
    expect(clipFor('chase', 1, 0, 3)).toBe('walk');
    expect(clipFor('chase', 2.5, 0, 3)).toBe('run');
  });
});
