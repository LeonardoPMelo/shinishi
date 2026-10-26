import * as THREE from 'three';

/**
 * Hand-painted-looking procedural textures, generated once on a canvas.
 * They are light and mostly neutral so each material's color tints them
 * (the same wood texture becomes dark cedar or light pine).
 */

export type TexName = 'wood' | 'planks' | 'tiles' | 'stone' | 'plaster' | 'thatch' | 'bark' | 'cobble';

const cache = new Map<TexName, THREE.CanvasTexture>();

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function canvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return { c, ctx: c.getContext('2d')! };
}

const painters: Record<TexName, (ctx: CanvasRenderingContext2D, s: number, r: () => number) => void> = {
  wood: (ctx, s, r) => {
    ctx.fillStyle = '#E9E2D8';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      const x = r() * s;
      ctx.strokeStyle = `rgba(110,80,55,${0.08 + r() * 0.16})`;
      ctx.lineWidth = 1 + r() * 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= s; y += 16) ctx.lineTo(x + Math.sin(y * 0.05 + i) * 3, y);
      ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = 'rgba(90,60,40,0.18)';
      ctx.beginPath();
      ctx.ellipse(r() * s, r() * s, 3 + r() * 4, 7 + r() * 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  planks: (ctx, s, r) => {
    ctx.fillStyle = '#E6DED2';
    ctx.fillRect(0, 0, s, s);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const x0 = (i / n) * s;
      ctx.fillStyle = `rgba(255,255,255,${r() * 0.12})`;
      ctx.fillRect(x0, 0, s / n, s);
      ctx.fillStyle = 'rgba(70,45,30,0.45)';
      ctx.fillRect(x0, 0, 2, s);
      for (let k = 0; k < 8; k++) {
        ctx.strokeStyle = `rgba(110,80,55,${0.08 + r() * 0.12})`;
        ctx.beginPath();
        const gx = x0 + 6 + r() * (s / n - 12);
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx + (r() - 0.5) * 6, s);
        ctx.stroke();
      }
    }
  },
  tiles: (ctx, s, r) => {
    ctx.fillStyle = '#D6D6DE';
    ctx.fillRect(0, 0, s, s);
    const cols = 8;
    const rows = 8;
    const cw = s / cols;
    const rh = s / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cw;
        const y = row * rh;
        const g = ctx.createLinearGradient(x, 0, x + cw, 0);
        const v = 0.92 + r() * 0.08;
        g.addColorStop(0, `rgba(${80 * v},${80 * v},${95 * v},0.55)`);
        g.addColorStop(0.45, `rgba(255,255,255,${0.25 * v})`);
        g.addColorStop(1, `rgba(60,60,75,0.6)`);
        ctx.fillStyle = g;
        ctx.fillRect(x + 1, y, cw - 2, rh);
        ctx.fillStyle = 'rgba(40,40,55,0.55)';
        ctx.fillRect(x, y + rh - 3, cw, 3);
      }
    }
  },
  stone: (ctx, s, r) => {
    ctx.fillStyle = '#8F8A80';
    ctx.fillRect(0, 0, s, s);
    let y = 0;
    while (y < s) {
      const h = 22 + r() * 18;
      let x = -r() * 30;
      while (x < s) {
        const w = 30 + r() * 34;
        const shade = 190 + Math.floor(r() * 45);
        ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 12})`;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.roundRect(x + 5, y + 4, w - 14, 5, 3);
        ctx.fill();
        x += w;
      }
      y += h;
    }
  },
  cobble: (ctx, s, r) => {
    ctx.fillStyle = '#9C968A';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const x = r() * s;
      const y = r() * s;
      const rad = 10 + r() * 12;
      const shade = 185 + Math.floor(r() * 50);
      ctx.fillStyle = `rgb(${shade},${shade - 6},${shade - 16})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rad, rad * (0.7 + r() * 0.3), r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  plaster: (ctx, s, r) => {
    ctx.fillStyle = '#F2EEE6';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '160,140,120'},${r() * 0.12})`;
      ctx.fillRect(r() * s, r() * s, 2 + r() * 6, 2 + r() * 6);
    }
  },
  thatch: (ctx, s, r) => {
    ctx.fillStyle = '#D9C08A';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const x = r() * s;
      const y = r() * s;
      ctx.strokeStyle = `rgba(${r() > 0.5 ? '120,90,40' : '250,235,190'},${0.25 + r() * 0.35})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 4, y + 10 + r() * 14);
      ctx.stroke();
    }
  },
  bark: (ctx, s, r) => {
    ctx.fillStyle = '#DCD2C6';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      const x = r() * s;
      ctx.strokeStyle = `rgba(70,50,35,${0.2 + r() * 0.3})`;
      ctx.lineWidth = 2 + r() * 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= s; y += 20) ctx.lineTo(x + (r() - 0.5) * 8, y);
      ctx.stroke();
    }
  },
};

export function getTexture(name: TexName): THREE.CanvasTexture {
  let tex = cache.get(name);
  if (tex) return tex;
  const { c, ctx } = canvas(256);
  painters[name](ctx, 256, seeded(name.length * 97 + 13));
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  cache.set(name, tex);
  return tex;
}

/** World units covered by one texture repeat (used for box-projected UVs). */
export const TEXTURE_SCALE: Record<TexName, number> = {
  wood: 1.2, planks: 1.6, tiles: 1.4, stone: 1.6, cobble: 1.4, plaster: 2.5, thatch: 1.5, bark: 0.9,
};
