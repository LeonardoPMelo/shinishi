import * as THREE from 'three';

/**
 * Foot-slide math for the locomotion clips (Etapa 5).
 *
 * A clip's natural ground speed is how fast its planted feet slide backward when it plays at time scale 1:
 * for a foot to stay put, the body must move forward at exactly that speed. The game measures it once
 * per model at load (instead of hand-tuned constants, which were 16–30% off for the cat and made the
 * villagers' bodies move more than twice as fast as their feet), then plays each clip at
 * `speed / natural`.
 */

/**
 * Natural ground speed of `clip` (m/s at `scale`), from the given foot bones of `root`. Uses its own
 * mixer, so the caller's animation state is untouched; restores the pose by updating its own action only.
 */
export function naturalSpeed(
  root: THREE.Object3D, clip: THREE.AnimationClip, feet: string[], scale = 1, samples = 120,
  stretch = 1, swing: SwingBone[] = [],
) {
  const bones = feet.map((n) => root.getObjectByName(n)).filter(Boolean) as THREE.Object3D[];
  if (!bones.length || clip.duration <= 0) return 0;
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.play();
  const track: THREE.Vector3[][] = bones.map(() => []);
  const dt = clip.duration / samples;
  const inv = new THREE.Matrix4();
  for (let i = 0; i <= samples; i++) {
    mixer.setTime(i * dt);
    stretchStride(swing, stretch);
    root.updateMatrixWorld(true);
    inv.copy(root.matrixWorld).invert();
    bones.forEach((b, k) => track[k].push(new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv).multiplyScalar(scale)));
  }
  action.stop();
  mixer.uncacheRoot(root);
  const speeds = track.map((pts) => {
    const ys = pts.map((p) => p.y);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    // planted: the lowest 12% of the foot's height range
    const limit = lo + (hi - lo) * 0.12;
    let dist = 0;
    let time = 0;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].y > limit || pts[i - 1].y > limit) continue;
      dist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      time += dt;
    }
    return time > 0 ? dist / time : 0;
  });
  return speeds.reduce((a, b) => a + b, 0) / speeds.length;
}

export type SwingBone = { bone: THREE.Object3D; rest: THREE.Quaternion };

/** A clip's measured gait: natural ground speed, and how much stride a stretch adds (see `measureGait`). */
export interface Gait {
  natural: number;
  /** Stride growth per unit of stretch: stride(k) = natural · (1 + gain · (k − 1)). */
  gain: number;
}

/**
 * Measures a clip's gait. Stretching the swing bones does not lengthen every stride by the same factor
 * (measured: the cat's walk gains 0.55 per unit, its run 0.83, a villager's walk 1.6), so the gain is
 * measured too, at a stretch of 1.3.
 */
export function measureGait(root: THREE.Object3D, clip: THREE.AnimationClip, feet: string[], swing: SwingBone[], scale = 1): Gait {
  const natural = naturalSpeed(root, clip, feet, scale);
  if (natural <= 1e-4 || !swing.length) return { natural, gain: 0 };
  const stretched = naturalSpeed(root, clip, feet, scale, 120, 1.3, swing);
  return { natural, gain: Math.max(0, (stretched / natural - 1) / 0.3) };
}

/**
 * Time scale and stride stretch for moving at `speed` with a clip of the given gait. When the exact time
 * scale would make the legs cycle faster than `maxScale` (frantic), the stride is lengthened instead, up to
 * `maxStretch` (the legs swing wider), so the feet still don't slide. Past both limits the feet slide by
 * whatever is left: `slide` is that fraction (0 = feet locked to the ground).
 */
export function gaitFor(speed: number, gait: Gait, maxScale: number, maxStretch = 1) {
  const { natural, gain } = gait;
  if (natural <= 1e-4 || speed <= 1e-4) return { timeScale: 1, stretch: 1, slide: 0 };
  const exact = speed / natural;
  if (exact <= maxScale || gain <= 0) {
    const timeScale = Math.min(exact, gain <= 0 ? Math.max(maxScale, exact) : maxScale);
    return { timeScale, stretch: 1, slide: Math.max(0, 1 - (natural * timeScale) / speed) };
  }
  // stride needed at the top cadence, as a stretch through the measured gain
  const want = exact / maxScale;
  const stretch = Math.min(maxStretch, 1 + (want - 1) / gain);
  const stride = natural * (1 + gain * (stretch - 1));
  const timeScale = Math.min(maxScale, speed / stride);
  return { timeScale, stretch, slide: Math.max(0, 1 - (stride * timeScale) / speed) };
}

const qa = new THREE.Quaternion();
const qi = new THREE.Quaternion();

/**
 * Lengthens a stride after the mixer has posed the bones: each swing bone's rotation away from its rest
 * pose is scaled by `k` (k > 1 extrapolates along the same arc). How much longer the stride gets depends
 * on the clip (measureGait measures it).
 */
export function stretchStride(bones: SwingBone[], k: number) {
  if (Math.abs(k - 1) < 1e-3) return;
  for (const { bone, rest } of bones) {
    // delta = rest⁻¹ · current, scaled along its own arc, put back on the rest pose
    qa.copy(rest).invert().multiply(bone.quaternion);
    qi.identity().slerp(qa, k);
    bone.quaternion.copy(rest).multiply(qi);
  }
}
