import * as THREE from 'three';

/**
 * Soft contact shadow under a character (Etapa 5). The sun's shadow only reaches near the camera and is
 * sharp-edged; this dark, blurred oval sits on the ground right under the feet so a character always looks
 * grounded, and for the cat it also shows where a jump will land. The villagers had a hard-edged black
 * disc that read as a sticker on the ground.
 */
let texture: THREE.CanvasTexture | null = null;

export function blobTexture() {
  if (texture) return texture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // dense core under the feet, long soft falloff (no visible edge)
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.75)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/** A flat, unlit, see-through decal material (no depth writes; drawn just over the ground). */
export function blobMaterial(opacity: number) {
  return new THREE.MeshBasicMaterial({
    color: '#1a1424',
    alphaMap: blobTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/**
 * How the cat's blob follows a jump: smaller and fainter the higher it is above the ground under it, but
 * still a clear landing mark up high (a quarter of its strength at 8 m). Returns [scale, opacity factor].
 */
export function blobForHeight(h: number): [number, number] {
  const k = Math.min(1, Math.max(0, h) / 8);
  return [1 - k * 0.4, 1 - k * 0.75];
}
