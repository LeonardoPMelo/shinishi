import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import * as THREE from 'three';
import { Ink, enhanceRock, getGradient } from '../materials';
import { rockGeometry, type RockKind } from '../rockGeometry';
import { addGroundContact } from '../groundContact';

type MeshProps = Omit<ComponentProps<'mesh'>, 'geometry' | 'children'>;

/**
 * A natural rock (Etapa 2): one of the chiseled variants from rockGeometry, tinted by `color`, with its
 * contact shadow stamped on the ground when it rests there. Drop-in for the old
 * `<mesh><dodecahedronGeometry args={[1, 0]} /><Toon color=.../></mesh>`: same size, same transform props.
 */
export function Rock({
  variant = 0, kind = 'boulder', moss = false, color = '#8E8E84', contact = true, ink, ...props
}: MeshProps & { variant?: number; kind?: RockKind; moss?: boolean; color?: string; contact?: boolean; ink?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const geometry = rockGeometry(variant, kind, { moss });
  useLayoutEffect(() => {
    const m = ref.current;
    if (!contact || !m) return;
    m.updateWorldMatrix(true, false);
    const box = new THREE.Box3().copy(geometry.boundingBox!).applyMatrix4(m.matrixWorld);
    // only rocks that actually touch the ground (not the ones stacked on a ledge or held in a pan)
    if (box.min.y > 0.15) return;
    const sx = box.max.x - box.min.x;
    const sz = box.max.z - box.min.z;
    addGroundContact((box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2, Math.max(sx, sz) * 0.62, 0.5);
  }, [contact, geometry]);
  return (
    <mesh ref={ref} geometry={geometry} {...props}>
      <meshToonMaterial color={color} vertexColors gradientMap={getGradient()} onUpdate={(m) => enhanceRock(m)} />
      {ink !== undefined && <Ink thickness={ink} />}
    </mesh>
  );
}
