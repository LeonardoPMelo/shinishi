import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../src/game/matrixSleep';
import { AUTO_LADDER, renderProfile } from '../src/store/uiSettings';

/**
 * Hidden subtrees stop recomputing their world matrices every frame (src/game/matrixSleep.ts, 2026-11):
 * ~3,400 of the ~9,500 objects sat in hidden zones, rooms and culled villagers.
 */
describe('matrizes de quem está escondido', () => {
  function world() {
    const scene = new THREE.Scene();
    const room = new THREE.Group();
    const lamp = new THREE.Mesh();
    room.add(lamp);
    scene.add(room);
    return { scene, room, lamp };
  }

  it('um grupo escondido não refaz a matriz dos filhos a cada quadro', () => {
    const { scene, room, lamp } = world();
    scene.updateMatrixWorld();
    room.visible = false;
    let refreshed = 0;
    for (let f = 0; f < 60; f++) {
      lamp.position.x = f + 1; // moves while hidden
      scene.updateMatrixWorld();
      if (lamp.matrixWorld.elements[12] === f + 1) refreshed++;
    }
    // only on its sleep tick (once every 30 frames), not 60 times
    expect(refreshed).toBeGreaterThan(0);
    expect(refreshed).toBeLessThanOrEqual(3);
  });

  it('ao aparecer, é atualizado no mesmo quadro, antes de ser desenhado', () => {
    const { scene, room, lamp } = world();
    room.visible = false;
    for (let f = 0; f < 5; f++) scene.updateMatrixWorld();
    lamp.position.set(3, 2, 1);
    room.visible = true;
    scene.updateMatrixWorld();
    expect(lamp.matrixWorld.elements[12]).toBe(3);
    expect(lamp.matrixWorld.elements[13]).toBe(2);
  });

  it('o próprio grupo escondido continua com a matriz em dia (as distâncias de corte leem ela)', () => {
    const { scene, room } = world();
    room.visible = false;
    room.position.x = 7;
    scene.updateMatrixWorld();
    expect(room.matrixWorld.elements[12]).toBe(7);
  });

  it('getWorldPosition de um filho escondido continua certo (física e cortes usam isso)', () => {
    const { scene, room, lamp } = world();
    room.visible = false;
    room.position.x = 2;
    lamp.position.x = 5;
    scene.updateMatrixWorld();
    expect(lamp.getWorldPosition(new THREE.Vector3()).x).toBe(7);
  });
});

describe('pelo do Shinichi por degrau', () => {
  it('as camadas de pelo só diminuem ao descer a escada, e somem no último degrau e na Baixa', () => {
    for (let i = 1; i < AUTO_LADDER.length; i++) expect(AUTO_LADDER[i].fur).toBeLessThanOrEqual(AUTO_LADDER[i - 1].fur);
    expect(AUTO_LADDER[0].fur).toBe(10);
    expect(AUTO_LADDER[AUTO_LADDER.length - 1].fur).toBe(0);
    expect(renderProfile('baixa', 0).fur).toBe(0);
    expect(renderProfile('alta', 0).fur).toBe(10);
  });
});
