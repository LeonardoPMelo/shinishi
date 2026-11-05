import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ASSETS } from '../src/game/assets/catalog';
import { DEER_CLIPS, deerAsset, deerClipFor, deerKind, type DeerKind } from '../src/game/world/DeerModel';
import { CLEARING_DEER, FAWN_SCALE } from '../src/data/clearing';

/** The deer's Blender models (tools/blender/build_fauna.py) and the contract with world/DeerModel.tsx. */
const ROOT = resolve(__dirname, '..');
const KINDS: DeerKind[] = ['cervo', 'cerva', 'filhote'];

function glbJson(file: string) {
  const b = readFileSync(file);
  expect(b.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  const len = b.readUInt32LE(12);
  expect(b.readUInt32LE(16)).toBe(0x4e4f534a); // 'JSON'
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8')) as {
    animations?: { name: string }[]; materials?: { name: string }[]; skins?: unknown[]; nodes: { name?: string }[];
    accessors: { count: number }[]; meshes: { primitives: { indices?: number }[] }[];
  };
}

describe('modelos dos cervos', () => {
  it('cada cervo tem o seu modelo no catálogo, e o arquivo existe, comprimido (< 200 KB)', () => {
    for (const k of KINDS) {
      const name = deerAsset(k);
      expect(ASSETS[name], name).toBeDefined();
      expect(readFileSync(resolve(ROOT, 'public/assets/models/characters', `${name}.glb`)).length, name).toBeLessThan(200_000);
    }
  });

  it('cada modelo tem esqueleto com pescoço e duas peças por perna, as cinco animações e materiais conhecidos', () => {
    const known = new Set(['fur', 'pad', 'wood', 'eye', 'gloss']);
    for (const k of KINDS) {
      const j = glbJson(resolve(ROOT, 'public/assets/models/characters', `${deerAsset(k)}.glb`));
      expect(j.skins?.length, k).toBe(1);
      expect((j.animations ?? []).map((a) => a.name).sort(), k).toEqual([...DEER_CLIPS].sort());
      const mats = (j.materials ?? []).map((m) => m.name);
      for (const m of mats) expect(known.has(m), `${k}: ${m}`).toBe(true);
      // only the stag carries antlers
      expect(mats.includes('wood'), k).toBe(k === 'cervo');
      const bones = new Set(j.nodes.map((n) => n.name));
      for (const b of ['body', 'neck', 'head', 'tail.1', 'tail.2', 'ear.L', 'ear.R']) expect(bones.has(b), `${k}: ${b}`).toBe(true);
      for (const l of ['FL', 'FR', 'BL', 'BR']) {
        expect(bones.has(`leg.${l}`), `${k}: leg.${l}`).toBe(true);
        expect(bones.has(`leg.${l}.2`), `${k}: leg.${l}.2`).toBe(true);
      }
      // light enough for a herd: under 15k triangles (the creatures are 8–12k)
      const tris = j.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + (p.indices !== undefined ? j.accessors[p.indices].count / 3 : 0), 0);
      expect(tris, k).toBeLessThan(15_000);
    }
  });

  it('os filhotes da clareira continuam sendo os pequenos, e só um cervo tem chifres', () => {
    const kinds = CLEARING_DEER.map((d, i) => deerKind(d.s, i === 0));
    expect(kinds.filter((k) => k === 'filhote').length).toBe(CLEARING_DEER.filter((d) => d.s < FAWN_SCALE).length);
    expect(kinds.filter((k) => k === 'cervo').length).toBe(1);
  });

  it('o estado escolhe a animação: fugir corre, andar anda, gato perto fica alerta, sozinho pasta e olha em volta', () => {
    expect(deerClipFor('flee', 1, 5.5, 0, 0)).toBe('run');
    expect(deerClipFor('walk', 20, 5.5, 0, 0)).toBe('walk');
    expect(deerClipFor('return', 20, 5.5, 0, 0)).toBe('walk');
    expect(deerClipFor('graze', 7, 5.5, 0, 0)).toBe('alert');
    const seen = new Set(Array.from({ length: 100 }, (_, i) => deerClipFor('graze', 30, 5.5, i, 0)));
    expect([...seen].sort()).toEqual(['graze', 'idle']);
  });
});
