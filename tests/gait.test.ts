import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { gaitFor, naturalSpeed, measureGait, stretchStride } from '../src/game/entities/gait';
import { blobForHeight } from '../src/game/entities/contactBlob';

/** Etapa 5: feet locked to the ground (gait timing) and the contact shadow. */

describe('tempo da passada (gaitFor)', () => {
  const gait = { natural: 0.5, gain: 1 };

  it('abaixo do ritmo máximo: o clipe toca exatamente em velocidade / passada, sem deslizar', () => {
    const g = gaitFor(1.2, gait, 3);
    expect(g.timeScale).toBeCloseTo(2.4, 6);
    expect(g.stretch).toBe(1);
    expect(g.slide).toBe(0);
  });

  it('acima do ritmo máximo: alonga a passada em vez de acelerar, e o pé continua preso', () => {
    const g = gaitFor(1.8, gait, 3, 1.35);
    expect(g.timeScale).toBeLessThanOrEqual(3 + 1e-9);
    expect(g.stretch).toBeGreaterThan(1);
    // covered ground = stride × time scale = speed
    expect(0.5 * (1 + (g.stretch - 1)) * g.timeScale).toBeCloseTo(1.8, 6);
    expect(g.slide).toBeCloseTo(0, 6);
  });

  it('o alongamento usa o ganho medido do clipe (um clipe que rende menos precisa de mais alongamento)', () => {
    const weak = gaitFor(1.8, { natural: 0.5, gain: 0.5 }, 3, 2);
    const strong = gaitFor(1.8, { natural: 0.5, gain: 1.5 }, 3, 2);
    expect(weak.stretch).toBeGreaterThan(strong.stretch);
    expect(weak.slide).toBeCloseTo(0, 6);
    expect(strong.slide).toBeCloseTo(0, 6);
  });

  it('além dos dois limites, informa quanto ainda desliza', () => {
    const g = gaitFor(4, gait, 3, 1.2);
    expect(g.timeScale).toBe(3);
    expect(g.stretch).toBe(1.2);
    expect(g.slide).toBeCloseTo(1 - (0.5 * 1.2 * 3) / 4, 6);
  });
});

/** A one-legged test rig: hip → thigh (swinging ±A around x) → foot at the end of a leg of length L. */
function leg(A = 0.3, L = 0.5) {
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'hips';
  const thigh = new THREE.Bone();
  thigh.name = 'thighL';
  const foot = new THREE.Bone();
  foot.name = 'footL';
  foot.position.set(0, -L, 0);
  hips.position.set(0, L, 0);
  root.add(hips);
  hips.add(thigh);
  thigh.add(foot);
  root.updateMatrixWorld(true);
  const times: number[] = [];
  const values: number[] = [];
  const q = new THREE.Quaternion();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), A * Math.sin(2 * Math.PI * t));
    times.push(t);
    values.push(q.x, q.y, q.z, q.w);
  }
  const clip = new THREE.AnimationClip('walk', 1, [new THREE.QuaternionKeyframeTrack('thighL.quaternion', times, values)]);
  return { root, clip, thigh };
}

describe('passada natural medida dos pés', () => {
  it('bate com a velocidade analítica do pé no ponto mais baixo (L · A · 2π)', () => {
    const { root, clip } = leg(0.3, 0.5);
    const v = naturalSpeed(root, clip, ['footL'], 1, 400);
    expect(v).toBeGreaterThan(0.5 * 0.3 * 2 * Math.PI * 0.9);
    expect(v).toBeLessThan(0.5 * 0.3 * 2 * Math.PI * 1.02);
  });

  it('a escala do modelo no jogo multiplica a passada', () => {
    const { root, clip } = leg();
    expect(naturalSpeed(root, clip, ['footL'], 2)).toBeCloseTo(2 * naturalSpeed(root, clip, ['footL'], 1), 5);
  });

  it('o ganho do alongamento é medido (aqui o ângulo é pequeno: perto de 1)', () => {
    const { root, clip, thigh } = leg(0.2);
    const g = measureGait(root, clip, ['footL'], [{ bone: thigh, rest: thigh.quaternion.clone() }]);
    expect(g.gain).toBeGreaterThan(0.85);
    expect(g.gain).toBeLessThan(1.15);
  });

  it('stretchStride escala o ângulo de cada osso a partir do repouso', () => {
    const bone = new THREE.Bone();
    const rest = bone.quaternion.clone();
    bone.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.4);
    stretchStride([{ bone, rest }], 1.5);
    const angle = 2 * Math.acos(Math.min(1, Math.abs(bone.quaternion.w)));
    expect(angle).toBeCloseTo(0.6, 5);
  });
});

describe('sombra de contato do gato', () => {
  it('no chão é cheia; no alto encolhe e enfraquece, mas ainda marca o pouso', () => {
    expect(blobForHeight(0)).toEqual([1, 1]);
    const [s4, o4] = blobForHeight(4);
    const [s8, o8] = blobForHeight(8);
    expect(s4).toBeGreaterThan(s8);
    expect(o4).toBeGreaterThan(o8);
    expect(o8).toBeGreaterThan(0.2);
    expect(blobForHeight(20)).toEqual(blobForHeight(8));
  });
});

describe('agachar aditivo do gato', () => {
  it('tornar aditivo um clone não muda os clipes que compartilham arrays com o original (a escala do idle virou 0)', () => {
    // the GLB stores identical keyframe arrays once: both clips point at the same scale values
    const shared = new Float32Array([1, 1, 1, 1, 1, 1]);
    const idle = new THREE.AnimationClip('idle', 1, [new THREE.VectorKeyframeTrack('hips.scale', [0, 1], shared)]);
    const crouch = new THREE.AnimationClip('crouch', 1, [new THREE.VectorKeyframeTrack('hips.scale', [0, 1], shared)]);
    THREE.AnimationUtils.makeClipAdditive(crouch.clone(), 0, idle);
    expect(Array.from(idle.tracks[0].values)).toEqual([1, 1, 1, 1, 1, 1]);
  });
});
