import * as THREE from 'three';

/**
 * Japanese hip roof (yosemune) with a concave slope and upturned corners.
 * Built from four grid faces so the tile texture follows each slope.
 *
 * w, d   : footprint of the walls
 * h      : roof height
 * overhang: eave overhang beyond the walls
 * upturn : how much the corners curl up
 */
export function createJapaneseRoof(w: number, d: number, h: number, overhang = 0.7, upturn = 0.35, segS = 10, segT = 6) {
  const W = w / 2 + overhang;
  const D = d / 2 + overhang;
  const alongX = W >= D;
  const half = Math.abs(W - D);
  const R1 = alongX ? new THREE.Vector3(-half, h, 0) : new THREE.Vector3(0, h, -half);
  const R2 = alongX ? new THREE.Vector3(half, h, 0) : new THREE.Vector3(0, h, half);

  // Each face: eave from A to B, ridge from RA to RB (counter-clockwise seen from outside).
  const faces: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(-W, 0, D), new THREE.Vector3(W, 0, D), alongX ? R1 : R2, alongX ? R2 : R2],
    [new THREE.Vector3(W, 0, D), new THREE.Vector3(W, 0, -D), alongX ? R2 : R2, alongX ? R2 : R1],
    [new THREE.Vector3(W, 0, -D), new THREE.Vector3(-W, 0, -D), alongX ? R2 : R1, alongX ? R1 : R1],
    [new THREE.Vector3(-W, 0, -D), new THREE.Vector3(-W, 0, D), alongX ? R1 : R1, alongX ? R1 : R2],
  ];

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const tmpE = new THREE.Vector3();
  const tmpR = new THREE.Vector3();
  const p = new THREE.Vector3();

  for (const [A, B, RA, RB] of faces) {
    const base = positions.length / 3;
    const eaveLen = A.distanceTo(B);
    const slopeLen = Math.hypot(h, Math.min(W, D));
    for (let j = 0; j <= segT; j++) {
      const t = j / segT;
      for (let i = 0; i <= segS; i++) {
        const s = i / segS;
        tmpE.lerpVectors(A, B, s);
        tmpR.lerpVectors(RA, RB, s);
        p.lerpVectors(tmpE, tmpR, t);
        // Concave profile: shallow near the eave, steep near the ridge.
        p.y = h * Math.pow(t, 1.45);
        // Corners curl upward.
        const corner = Math.pow(Math.abs(2 * s - 1), 5);
        p.y += upturn * corner * Math.pow(1 - t, 2);
        positions.push(p.x, p.y, p.z);
        uvs.push((s * eaveLen) / 1.4, (t * slopeLen) / 1.4);
      }
    }
    for (let j = 0; j < segT; j++) {
      for (let i = 0; i < segS; i++) {
        const a = base + j * (segS + 1) + i;
        const b = a + 1;
        const c = a + segS + 1;
        const e = c + 1;
        indices.push(a, b, c, b, e, c);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return { geometry: geo, ridge: [R1, R2] as const, eave: { W, D } };
}
