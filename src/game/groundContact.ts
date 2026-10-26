import * as THREE from 'three';

/**
 * Contact shadows on the ground (Etapa 2). The sun's shadow map only reaches ~22 m around the cat and
 * blurs small things away, so rocks and stones looked pasted onto the grass. Everything that rests on the
 * ground stamps a soft dark blob into this low-resolution map (4 px per meter over the whole terrain),
 * which the ground shader multiplies in. Static: blobs are only ever added.
 */
export const CONTACT = { minX: -56, minZ: -40, w: 112, d: 112, ppu: 4 };

let canvas: HTMLCanvasElement | null = null;
let texture: THREE.CanvasTexture | null = null;

function ensure() {
  if (texture) return;
  canvas = document.createElement('canvas');
  canvas.width = CONTACT.w * CONTACT.ppu;
  canvas.height = CONTACT.d * CONTACT.ppu;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
}

/** The map the ground samples (red channel = how occluded, 0..1). */
export function contactTexture() {
  ensure();
  return texture!;
}

const stamped = new WeakSet<THREE.Object3D>();
const box = new THREE.Box3();

/**
 * Contact shadow for a static mesh that stands on the ground (Etapa 3: houses, posts, barrels, fences...),
 * from its world bounding box. Skips flat pieces (paving, decals), raised ones (roofs, shelves, lanterns
 * on posts) and huge ones; each mesh is stamped once even if its area is merged again later.
 */
export function addMeshContact(mesh: THREE.Mesh) {
  if (stamped.has(mesh)) return;
  stamped.add(mesh);
  const g = mesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  if (!g.boundingBox) return;
  box.copy(g.boundingBox).applyMatrix4(mesh.matrixWorld);
  const h = box.max.y - box.min.y;
  const sx = box.max.x - box.min.x;
  const sz = box.max.z - box.min.z;
  if (box.min.y > 0.12 || h < 0.12 || Math.max(sx, sz) > 7 || Math.max(sx, sz) < 0.08) return;
  addGroundContact((box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2, Math.max(sx, sz) * 0.6 + 0.08, 0.28);
}

/**
 * Stamps a soft contact shadow of radius `r` (m) centred at (x, z). `strength` is the darkness at the
 * centre (0..1); overlapping blobs add up, capped at full.
 */
export function addGroundContact(x: number, z: number, r: number, strength = 0.55) {
  ensure();
  const ctx = canvas!.getContext('2d')!;
  const px = (x - CONTACT.minX) * CONTACT.ppu;
  const py = (z - CONTACT.minZ) * CONTACT.ppu;
  const pr = Math.max(1.5, r * CONTACT.ppu);
  const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
  const s = Math.max(0, Math.min(1, strength));
  g.addColorStop(0, `rgba(255,255,255,${s})`);
  g.addColorStop(0.55, `rgba(255,255,255,${s * 0.55})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  ctx.globalCompositeOperation = 'source-over';
  // several stamps in one frame still mean a single upload
  texture!.needsUpdate = true;
}
