import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { enhanceToon, getGradient } from '../materials';
import { ASSETS, assetUrl, assetFileExists, type AssetName } from './catalog';

/**
 * Loads a model from the asset catalog, or draws `fallback` (the procedural version) when the
 * .glb is not there. Missing files are detected with a HEAD request: a missing path answers 404, or,
 * on dev servers, 200 with index.html, so anything served as HTML counts as missing.
 * (It used to read the first 4 bytes with a Range request. On GitHub Pages that 4-byte answer ended up
 * stored as the whole model, and the loader then failed with "Invalid DataView length".)
 */

const probes = new Map<AssetName, Promise<boolean>>();
const known = new Map<AssetName, boolean>();

function probe(name: AssetName): Promise<boolean> {
  let p = probes.get(name);
  if (!p && !assetFileExists(name)) {
    // not shipped with this build: the procedural version, without asking the server
    known.set(name, false);
    p = Promise.resolve(false);
    probes.set(name, p);
  }
  if (!p) {
    p = fetch(assetUrl(name), { method: 'HEAD' })
      .then((r) => {
        const ok = r.ok && !(r.headers.get('content-type') ?? '').includes('text/html');
        known.set(name, ok);
        return ok;
      })
      .catch(() => {
        known.set(name, false);
        return false;
      });
    probes.set(name, p);
  }
  return p;
}

/** true / false once known; null while checking. */
export function useAssetAvailable(name: AssetName | null): boolean | null {
  const [state, setState] = useState<boolean | null>(name && known.has(name) ? known.get(name)! : name ? null : false);
  useEffect(() => {
    if (!name) return;
    let alive = true;
    probe(name).then((ok) => alive && setState(ok));
    return () => {
      alive = false;
    };
  }, [name]);
  return state;
}

/** Converts imported materials to the game's toon look, keeping their color and texture. */
function toonify(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const convert = (m: THREE.Material) => {
      const src = m as THREE.MeshStandardMaterial;
      const t = new THREE.MeshToonMaterial({
        color: src.color ?? new THREE.Color('#ffffff'),
        map: src.map ?? null,
        emissive: src.emissive ?? new THREE.Color('#000000'),
        emissiveMap: src.emissiveMap ?? null,
        emissiveIntensity: src.emissiveIntensity ?? 1,
        transparent: src.transparent,
        opacity: src.opacity,
        alphaTest: src.alphaTest,
        side: src.side,
        vertexColors: !!(mesh.geometry.attributes.color),
        gradientMap: getGradient(),
      });
      t.name = src.name;
      enhanceToon(t, false);
      return t;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

function LoadedModel({ name, fitWidth, yOffset = 0 }: { name: AssetName; fitWidth?: number; yOffset?: number }) {
  const gltf = useGLTF(assetUrl(name));
  const object = useMemo(() => {
    const obj = cloneSkinned(gltf.scene);
    toonify(obj);
    if (fitWidth) {
      // Scale to the footprint the procedural version occupies, feet on the ground.
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const k = fitWidth / Math.max(size.x, size.z, 1e-3);
      obj.scale.multiplyScalar(k);
      obj.position.y -= box.min.y * k;
    }
    obj.position.y += yOffset;
    obj.userData.dynamic = true; // loads after StaticMerge has run: keep it out of merging
    return obj;
  }, [gltf, fitWidth, yOffset]);
  const collider = ASSETS[name].collider;
  if (collider === 'none') return <primitive object={object} />;
  return (
    <RigidBody type="fixed" colliders={collider}>
      <primitive object={object} />
    </RigidBody>
  );
}

/**
 * One model that fails to download or parse (a cut-off file, a flaky connection) shows its procedural
 * version instead of taking the whole game down with it.
 */
export class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[Shinichi] modelo não carregou; usando a versão procedural:', error.message);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface AssetProps {
  name: AssetName;
  /** The procedural version, used until (or unless) the .glb exists. */
  fallback: ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Scale a loaded model so its widest side matches this size (meters). */
  fitWidth?: number;
  yOffset?: number;
}

export function Asset({ name, fallback, position, rotation, fitWidth, yOffset }: AssetProps) {
  const available = useAssetAvailable(name);
  if (!available) return <>{fallback}</>;
  return (
    <group position={position} rotation={rotation} userData={{ dynamic: true }}>
      <ModelBoundary fallback={fallback}>
        <Suspense fallback={null}>
          <LoadedModel name={name} fitWidth={fitWidth} yOffset={yOffset} />
        </Suspense>
      </ModelBoundary>
    </group>
  );
}

/** Dev/console helper: which catalog files exist right now. */
export async function assetReport() {
  const names = Object.keys(ASSETS) as AssetName[];
  const res = await Promise.all(names.map(async (n) => [n, await probe(n)] as const));
  return Object.fromEntries(res);
}

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__assets = assetReport;
