import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { foldCharacter } from '../src/game/entities/characterMaterials';

/**
 * foldCharacter (Etapa 1b) turns every rigid part of a villager into skinned geometry merged per
 * material. The merged mesh must put each vertex where the original part was, in any pose.
 */
function rig() {
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  const arm = new THREE.Bone();
  arm.position.set(0.5, 1, 0);
  hips.add(arm);
  root.add(hips);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([hips, arm]);
  const fur = new THREE.MeshBasicMaterial();
  fur.name = 'fur';
  // a skinned body (all on the hips) and a rigid "hat" riding the arm bone
  const bodyGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const n = bodyGeo.attributes.position.count;
  bodyGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4), 4));
  bodyGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  const body = new THREE.SkinnedMesh(bodyGeo, fur);
  root.add(body);
  body.bind(skeleton);
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), fur);
  hat.position.set(0, 0.2, 0.05);
  hat.rotation.y = 0.4;
  arm.add(hat);
  root.updateMatrixWorld(true);
  return { root, arm, hat };
}

const skinned = (m: THREE.SkinnedMesh, i: number) => {
  const v = new THREE.Vector3().fromBufferAttribute(m.geometry.attributes.position as THREE.BufferAttribute, i);
  m.applyBoneTransform(i, v);
  return v.applyMatrix4(m.matrixWorld);
};

describe('moradores fundidos por material', () => {
  it('a peça rígida vira parte da malha com pele e segue o osso em outra pose', () => {
    const { root, arm, hat } = rig();
    const hatCorner = new THREE.Vector3().fromBufferAttribute(hat.geometry.attributes.position as THREE.BufferAttribute, 0);
    const hatOnArm = hat.matrix.clone();
    foldCharacter(root, []);
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
    expect(meshes).toHaveLength(1);
    const merged = meshes[0] as THREE.SkinnedMesh;
    expect(merged.isSkinnedMesh).toBe(true);
    // traversal order: the hat (under the bones) is merged first
    const first = 0;
    arm.rotation.set(0.7, -0.3, 1.1);
    arm.position.y = 1.3;
    root.updateMatrixWorld(true);
    merged.skeleton.update();
    const expected = hatCorner.clone().applyMatrix4(arm.matrixWorld.clone().multiply(hatOnArm));
    expect(skinned(merged, first).distanceTo(expected)).toBeLessThan(1e-4);
  });

  it('mantém o par de LOD: a malha fundida troca entre geometria cheia e leve', () => {
    const { root } = rig();
    let body!: THREE.SkinnedMesh;
    root.traverse((o) => ((o as THREE.SkinnedMesh).isSkinnedMesh ? (body = o as THREE.SkinnedMesh) : null));
    const low = body.geometry.clone();
    const pairs = foldCharacter(root, [{ mesh: body, full: body.geometry, low }]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].mesh.name).toBe('fur_unido');
    expect(pairs[0].low).not.toBe(pairs[0].full);
  });
});
