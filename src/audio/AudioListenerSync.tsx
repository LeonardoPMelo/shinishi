import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { audio } from './engine';

const forward = new THREE.Vector3();

/** Keeps the Web Audio listener on the camera so positional sounds pan correctly. */
export function AudioListenerSync() {
  const { camera } = useThree();
  useFrame(() => {
    if (!audio.ready) return;
    camera.getWorldDirection(forward);
    audio.setListener(camera.position.x, camera.position.y, camera.position.z, forward.x, forward.y, forward.z);
  });
  return null;
}
