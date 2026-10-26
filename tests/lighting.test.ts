import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LIGHTING } from '../src/game/timeOfDay';
import { skySH, skyIntensity } from '../src/game/skyLight';

/** Etapa 3: the sky light probe that replaced the hemisphere + ambient pair. */
const lum = (v: THREE.Vector3) => 0.2126 * v.x + 0.7152 * v.y + 0.0722 * v.z;

describe('luz do céu (sonda)', () => {
  for (const name of ['entardecer', 'dia'] as const) {
    const l = LIGHTING[name];
    const sh = skySH(l);
    const k = skyIntensity(l, sh);
    const at = (x: number, y: number, z: number) => sh.getIrradianceAt(new THREE.Vector3(x, y, z).normalize(), new THREE.Vector3()).multiplyScalar(k);

    it(`${name}: mesma luz média da sombra que a luz hemisférica antiga`, () => {
      // the old pair on a face turned up: hemi sky * intensity + ambient
      const old = new THREE.Color(l.hemi.sky).multiplyScalar(l.hemi.intensity).add(new THREE.Color(l.ambient.color).multiplyScalar(l.ambient.intensity));
      const oldUp = 0.2126 * old.r + 0.7152 * old.g + 0.0722 * old.b;
      // calibrated on the whole upper hemisphere, so the face turned up stays within 35% of before
      expect(lum(at(0, 1, 0)) / oldUp).toBeGreaterThan(0.65);
      expect(lum(at(0, 1, 0)) / oldUp).toBeLessThan(1.35);
    });

    it(`${name}: a face voltada para o sol recebe mais luz do céu que a oposta`, () => {
      const [sx, , sz] = l.sky.sunDir;
      const toward = at(sx, 0, sz);
      const away = at(-sx, 0, -sz);
      expect(lum(toward)).toBeGreaterThan(lum(away));
    });

    it(`${name}: o céu ilumina mais de cima que de baixo`, () => {
      expect(lum(at(0, 1, 0))).toBeGreaterThan(lum(at(0, -1, 0)));
    });
  }

  it('no entardecer, a sombra que olha para o sol é mais quente (mais vermelho que azul)', () => {
    const l = LIGHTING.entardecer;
    const sh = skySH(l);
    const [sx, , sz] = l.sky.sunDir;
    const e = sh.getIrradianceAt(new THREE.Vector3(sx, 0.1, sz).normalize(), new THREE.Vector3());
    expect(e.x).toBeGreaterThan(e.z);
  });
});
