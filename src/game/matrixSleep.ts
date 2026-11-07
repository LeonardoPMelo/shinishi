import * as THREE from 'three';

/**
 * three.js recomputes the world matrix of every object in the scene every frame, hidden or not. Here that
 * was ~9,500 objects and ~7 ms of an Aspire 3's frame, and over a third of them sat in hidden subtrees: the
 * interiors, the wild lands, the zones you are not in, villagers and creatures past their draw distance.
 *
 * This keeps three's own updateMatrixWorld, with one change: below an object that is hidden, the children
 * are refreshed only once every SLEEP frames (each subtree on its own frame, so the work is spread out and
 * never lands on one frame). A subtree that becomes visible is fully refreshed on that same frame, before
 * it is drawn, because the check reads `visible` as it walks.
 *
 * Safe because nothing in the game reads a hidden object's matrixWorld for gameplay: the culls and the
 * physics use getWorldPosition / updateWorldMatrix, which compute it on demand.
 */
const SLEEP = 30;
let frame = 0;
let enabled = true;
// dev A/B switch: __matrixSleep(false) restores three's behaviour
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__matrixSleep = (on: boolean) => (enabled = on);

const proto = THREE.Object3D.prototype as THREE.Object3D & { __sleepPatched?: boolean };

if (!proto.__sleepPatched) {
  proto.__sleepPatched = true;
  proto.updateMatrixWorld = function updateMatrixWorld(this: THREE.Object3D, force?: boolean) {
    if (this.matrixAutoUpdate) this.updateMatrix();

    if (this.matrixWorldNeedsUpdate || force) {
      if (this.parent === null) {
        this.matrixWorld.copy(this.matrix);
        frame++; // the scene root: once per frame
      } else {
        this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
      }
      this.matrixWorldNeedsUpdate = false;
      force = true;
    }

    // hidden: its children are not drawn this frame; refresh them now and then so nothing goes stale for long
    if (this.visible === false && enabled && (this.id + frame) % SLEEP !== 0) return;

    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i];
      if (child.matrixWorldAutoUpdate === true || force === true) child.updateMatrixWorld(force);
    }
  };
}

export {};
