import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NPC_DEFINITIONS, NPCS_BY_ID } from '../src/data/npcs';
import { MISSIONS } from '../src/data/missions';
import { ASSETS } from '../src/game/assets/catalog';

/** Village cast: every NPC id mapped to a model points at a real, compressed GLB; the new faces have a job. */

const ROOT = resolve(__dirname, '..');
// VillagerModel.tsx pulls in three/drei, so the mapping is read from the source instead of imported
const src = readFileSync(resolve(ROOT, 'src/game/entities/VillagerModel.tsx'), 'utf8');
const block = src.slice(src.indexOf('VILLAGER_ASSETS'), src.indexOf('};', src.indexOf('VILLAGER_ASSETS')));
const MAP = Object.fromEntries([...block.matchAll(/^\s+(\w+): '(\w+)',/gm)].map((m) => [m[1], m[2]]));

describe('elenco em GLB', () => {
  it('todos os moradores e NPCs novos têm modelo próprio', () => {
    const withoutModel = NPC_DEFINITIONS.filter((n) => !MAP[n.id]).map((n) => n.id);
    expect(withoutModel).toEqual([]);
  });

  it('cada modelo está no catálogo e o arquivo existe, comprimido (< 400 KB)', () => {
    for (const [id, asset] of Object.entries(MAP)) {
      expect(NPCS_BY_ID[id], `NPC ${id}`).toBeDefined();
      expect(ASSETS[asset as keyof typeof ASSETS], `catálogo ${asset}`).toBeDefined();
      const file = resolve(ROOT, 'public/assets/models/characters', `${asset}.glb`);
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file).length).toBeLessThan(400_000);
    }
  });
});

describe('NPCs novos (Liria, Kaito, Tsubaki)', () => {
  it('têm falas soltas, conversa e dicas ligadas a missões reais', () => {
    for (const id of ['liria', 'kaito', 'tsubaki']) {
      const npc = NPCS_BY_ID[id];
      expect(npc, id).toBeDefined();
      expect(npc.barks?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(npc.routes.length).toBeGreaterThanOrEqual(3);
      for (const r of npc.routes) {
        for (const key of ['active', 'done'] as const) {
          const m = r.when?.[key];
          for (const mid of ([] as string[]).concat(m ?? [])) expect(MISSIONS[mid], `${id}: missão ${mid}`).toBeDefined();
        }
        for (const st of ([] as string[]).concat(r.when?.step ?? [], r.when?.notStep ?? [])) {
          const [mid, sid] = st.split('.');
          expect(MISSIONS[mid]?.steps.some((s) => s.id === sid), `${id}: passo ${st}`).toBe(true);
        }
      }
    }
  });
});
