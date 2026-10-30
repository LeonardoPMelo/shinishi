import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Toon } from '../materials';

/**
 * The market stalls' signs (Etapa 6 da expansão): each shop shows its name and colour from the plaza, so the
 * counters with the shops (data/shops.ts SHOP_OBJECTS) are easy to find. Kept out of StaticMerge (a texture).
 */

function useSignTexture(text: string, bg: string) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#2A1E16';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 502, 118);
    ctx.fillStyle = '#FFF6E4';
    ctx.font = 'bold 64px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, bg]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function Sign({ position, rotY, text, bg }: { position: [number, number, number]; rotY: number; text: string; bg: string }) {
  const tex = useSignTexture(text, bg);
  return (
    <group position={position} rotation={[0, rotY, 0]} userData={{ dynamic: true }}>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, 1.6, 0]} castShadow>
          <boxGeometry args={[0.08, 3.2, 0.08]} />
          <Toon color="#5A3B28" tex="wood" />
        </mesh>
      ))}
      {/* above the market's lantern string (it hangs at ~2.3–2.7 m) */}
      <mesh position={[0, 3.0, 0.05]}>
        <planeGeometry args={[1.7, 0.42]} />
        <meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function ShopSigns() {
  return (
    <>
      {/* both stalls face the plaza (west), their counters just in front */}
      <Sign position={[7.25, 0, 0.7]} rotY={-Math.PI / 2} text="🐟 PEIXARIA" bg="#2F5E8C" />
      <Sign position={[7.25, 0, -3.8]} rotY={-Math.PI / 2} text="📦 ARMAZÉM" bg="#5E8C4A" />
    </>
  );
}
