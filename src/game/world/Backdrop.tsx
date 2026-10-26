import { useMemo } from 'react';
import { Toon } from '../materials';
import { getPuffGeometry } from '../foliageGeometry';

/**
 * Distant scenery around the village: layered mountains, temples on the peaks,
 * waterfalls and the giant cat-head mountain from the concept art. Pure decoration,
 * far outside the playable area; the blue fog gives it depth.
 */

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function Pagoda({ position, scale = 1, roof = '#C84A3A' }: { position: [number, number, number]; scale?: number; roof?: string }) {
  return (
    <group position={position} scale={scale}>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[0, i * 1.5, 0]}>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[2.2 - i * 0.5, 1.2, 2.2 - i * 0.5]} />
            <Toon color="#F2E6D0" />
          </mesh>
          <mesh position={[0, 1.35, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[2.3 - i * 0.55, 0.7, 4]} />
            <Toon color={roof} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 4.9, 0]}>
        <cylinderGeometry args={[0.05, 0.1, 1.2, 6]} />
        <Toon color="#E8C547" />
      </mesh>
    </group>
  );
}

function Waterfall({ position, height, width = 2 }: { position: [number, number, number]; height: number; width?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, 0.4]} />
        <Toon color="#BFE8FF" emissive="#9AD8FF" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0.5, 0.6]} scale={[1.6, 0.6, 1]}>
        <sphereGeometry args={[width * 0.7, 10, 8]} />
        <Toon color="#FFFFFF" emissive="#E8F6FF" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function CatMountain() {
  const rock = '#8FA59A';
  const moss = '#6FAF6A';
  return (
    <group position={[0, -6, -78]}>
      <mesh position={[0, 16, 0]} scale={[1.25, 1, 0.8]}>
        <sphereGeometry args={[18, 22, 16]} />
        <Toon color={rock} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[13 * s, 36, -2]} rotation={[0, 0, -0.32 * s]} scale={[1, 1, 0.6]}>
          <coneGeometry args={[7, 15, 5]} />
          <Toon color={rock} />
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} position={[7 * s, 21, 13]} scale={[1.1, 0.6, 0.3]}>
          <sphereGeometry args={[3.2, 12, 8]} />
          <Toon color="#5E7468" />
        </mesh>
      ))}
      <mesh position={[0, 16, 14.2]} scale={[1, 0.6, 0.4]}>
        <sphereGeometry args={[1.8, 10, 8]} />
        <Toon color="#5E7468" />
      </mesh>
      <mesh position={[0, 4, 4]} scale={[1.6, 0.5, 1.1]}>
        <sphereGeometry args={[22, 18, 10]} />
        <Toon color={moss} />
      </mesh>
      <Waterfall position={[-9, 0, 15]} height={14} width={2.4} />
      <Waterfall position={[10, 0, 14]} height={11} width={1.8} />
      <Pagoda position={[-22, 10, 6]} scale={1.6} />
      <Pagoda position={[23, 8, 8]} scale={1.4} roof="#3F5277" />
    </group>
  );
}

export function Backdrop() {
  const hills = useMemo(() => {
    const r = seeded(91);
    const list: { p: [number, number, number]; s: [number, number, number]; c: string; temple: boolean; blossom: boolean }[] = [];
    const ring = (count: number, dist: number, height: number, colors: string[]) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + r() * 0.2;
        const d = dist + r() * 12;
        const x = Math.cos(a) * d * 0.85;
        const z = 10 + Math.sin(a) * d;
        if (z < -40 && Math.abs(x) < 30) continue;
        const sx = 9 + r() * 9;
        // keep the hills behind the districts outside the fence: east (x up to 41), west (x down to -41)
        // and the old forest (z up to 64)
        let px = x;
        let pz = z;
        if (z > -26 && z < 34) px = x > 0 ? Math.max(x, 46 + sx * 0.8) : Math.min(x, -46 - sx * 0.8);
        else if (z >= 34 && Math.abs(x) < 44) pz = Math.max(z, 70 + sx * 0.6);
        list.push({
          p: [px, -3, pz],
          s: [sx, height + r() * height, 9 + r() * 7],
          c: colors[Math.floor(r() * colors.length)],
          temple: r() > 0.72,
          blossom: r() > 0.55,
        });
      }
    };
    ring(24, 52, 10, ['#7DBF62', '#6DB067', '#86C46A']);
    ring(20, 82, 20, ['#7FA7B8', '#8DB3C2', '#7E9FB5']);
    return list;
  }, []);

  return (
    <group>
      {hills.map((h, i) => (
        <group key={i} position={h.p}>
          <mesh scale={h.s}>
            <sphereGeometry args={[1, 14, 10]} />
            <Toon color={h.c} />
          </mesh>
          {h.blossom && (
            <mesh position={[h.s[0] * 0.3, h.s[1] * 0.75, h.s[2] * 0.3]} scale={h.s[0] * 0.28} geometry={getPuffGeometry(1, 'low')} dispose={null}>
              <Toon color="#F7B6CB" />
            </mesh>
          )}
          {h.temple && <Pagoda position={[0, h.s[1] * 0.92, 0]} scale={0.9 + h.s[1] * 0.04} roof={i % 2 ? '#C84A3A' : '#3F5277'} />}
        </group>
      ))}
      <CatMountain />
    </group>
  );
}
