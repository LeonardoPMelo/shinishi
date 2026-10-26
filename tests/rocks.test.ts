import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { rockGeometry, type RockKind } from '../src/game/rockGeometry';

/** Etapa 2: the rock generator that replaced the plain dodecahedrons. */
const KINDS: RockKind[] = ['boulder', 'flat', 'slab', 'pebble'];

const box = (g: THREE.BufferGeometry) => new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);

describe('gerador de rochas', () => {
  it('cada tipo tem o tamanho da peça que substitui (raio ~1) e atributos válidos', () => {
    for (const kind of KINDS) {
      for (let v = 0; v < 6; v++) {
        const g = rockGeometry(v, kind);
        const b = box(g);
        const size = b.getSize(new THREE.Vector3());
        expect(size.x, `${kind} ${v}`).toBeGreaterThan(1.0);
        expect(size.x, `${kind} ${v}`).toBeLessThan(2.4);
        for (const name of ['position', 'normal', 'color']) {
          const a = g.getAttribute(name) as THREE.BufferAttribute;
          expect(a, name).toBeDefined();
          expect(Array.from(a.array as Float32Array).every(Number.isFinite), `${kind} ${v} ${name}`).toBe(true);
        }
      }
    }
  });

  it('o mesmo pedido devolve a mesma geometria (cache) e variantes diferentes têm formas diferentes', () => {
    expect(rockGeometry(3, 'boulder')).toBe(rockGeometry(3, 'boulder'));
    const a = box(rockGeometry(0, 'boulder')).getSize(new THREE.Vector3());
    const b = box(rockGeometry(1, 'boulder')).getSize(new THREE.Vector3());
    expect(a.distanceTo(b)).toBeGreaterThan(0.01);
  });

  it('a pedra de passagem é baixa e tem o topo plano para pisar', () => {
    for (let v = 0; v < 6; v++) {
      const g = rockGeometry(v, 'slab');
      const b = box(g);
      const size = b.getSize(new THREE.Vector3());
      expect(size.y / Math.max(size.x, size.z), `slab ${v}`).toBeLessThan(0.5);
      // many vertices on the highest plane: a flat top, not a dome
      const pos = g.attributes.position as THREE.BufferAttribute;
      let top = 0;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > b.max.y - 0.04) top++;
      expect(top, `slab ${v}`).toBeGreaterThan(12);
    }
  });

  it('a base fica mais escura que o topo (a rocha assenta no chão) e o musgo esverdeia o topo', () => {
    const g = rockGeometry(2, 'boulder');
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = g.attributes.color as THREE.BufferAttribute;
    const b = box(g);
    let low = 0, nl = 0, high = 0, nh = 0;
    for (let i = 0; i < pos.count; i++) {
      const lum = col.getX(i) + col.getY(i) + col.getZ(i);
      if (pos.getY(i) < b.min.y + 0.1) { low += lum; nl++; }
      if (pos.getY(i) > b.max.y - 0.1) { high += lum; nh++; }
    }
    expect(low / nl).toBeLessThan((high / nh) * 0.8);
    const mossy = rockGeometry(2, 'boulder', { moss: true }).attributes.color as THREE.BufferAttribute;
    let greener = 0;
    for (let i = 0; i < mossy.count; i++) if (mossy.getY(i) - mossy.getX(i) > col.getY(i) - col.getX(i) + 0.05) greener++;
    expect(greener).toBeGreaterThan(10);
  });
});
