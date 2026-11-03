import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { addDistanceFade, chunkInstanced, vegFade } from '../src/game/vegetation';

/** The small plants fade out with distance (game/vegetation.ts). */
function field(n: number, spread: number) {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.3), new THREE.MeshBasicMaterial(), n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    m.makeTranslation((i * 7.3) % spread, 0, (i * 13.1) % spread);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, new THREE.Color(i % 2 ? '#ff0000' : '#00ff00'));
  }
  return mesh;
}

describe('vegetação por distância', () => {
  it('as células guardam todas as plantas, cada uma uma vez, com a cor dela', () => {
    const src = field(500, 90);
    const g = chunkInstanced(src, 30);
    const parts = g.children as THREE.InstancedMesh[];
    expect(parts.reduce((s, p) => s + p.count, 0)).toBe(500);
    expect(parts.length).toBe(9);
    const seen = new Set<string>();
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    for (const part of parts) {
      for (let i = 0; i < part.count; i++) {
        part.getMatrixAt(i, m);
        p.setFromMatrixPosition(m);
        seen.add(`${p.x.toFixed(2)},${p.z.toFixed(2)}`);
      }
      expect(part.instanceColor).not.toBeNull();
      expect(part.boundingSphere).not.toBeNull();
    }
    expect(seen.size).toBe(new Set(Array.from({ length: 500 }, (_, i) => `${((i * 7.3) % 90).toFixed(2)},${((i * 13.1) % 90).toFixed(2)}`)).size);
  });

  it('só as células de capim e flores entram no corte por distância (moitas e pedras não)', () => {
    const cut = chunkInstanced(field(50, 60));
    const kept = chunkInstanced(field(50, 60), 30, false);
    expect(cut.children.every((c) => c.userData.vegCell)).toBe(true);
    expect(kept.children.some((c) => c.userData.vegCell)).toBe(false);
  });

  it('o encolhimento entra depois do shader que o material já tinha, e o programa ganha outra chave', () => {
    const mat = new THREE.MeshToonMaterial();
    const calls: string[] = [];
    mat.onBeforeCompile = () => { calls.push('own'); };
    mat.customProgramCacheKey = () => 'own-key';
    addDistanceFade(mat);
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}',
      fragmentShader: '',
    };
    mat.onBeforeCompile(shader as never, {} as never);
    expect(calls).toEqual(['own']);
    expect(shader.uniforms.uVegFade).toBe(vegFade);
    expect(shader.vertexShader).toContain('smoothstep(uVegFade.x, uVegFade.y');
    expect(shader.vertexShader.indexOf('uVegFade.x')).toBeLessThan(shader.vertexShader.indexOf('#include <project_vertex>'));
    expect(mat.customProgramCacheKey()).toBe('own-key-vegfade');
  });

  it('as distâncias começam antes da neblina (42 m) e terminam perto dela', () => {
    const [near, far] = [vegFade.value.x, vegFade.value.y];
    expect(near).toBeGreaterThanOrEqual(25);
    expect(far).toBeLessThanOrEqual(42);
    expect(far).toBeGreaterThan(near);
  });
});
