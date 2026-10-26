import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { playerPosition, cameraAngle, playerBody, playerFacing } from './playerState';
import { useUiSettings } from '../../store/uiSettings';
import { foliageFade } from '../materials';
import { PROBES, pickView, type Probe } from './cameraProbe';

const MIN_DIST = 3.5;
const MAX_DIST = 11;
const MIN_PHI = 0.2;
const MAX_PHI = 1.0;
// The quadruped is low: aim a bit above its head, not above a standing character.
const LOOK_AHEAD_Y = 0.85;
/** Seconds without touching the camera before it starts settling behind Shinichi. */
const RECENTER_DELAY = 1.6;
const RECENTER_RATE = 1.4;
const LERP_SPEED = 0.1;

interface Props {
  active: boolean;
}

// NPCs and small props should not yank the camera around.
const ignoreSoft = (collider: { parent: () => { userData?: unknown } | null }) =>
  !((collider.parent()?.userData as { noCamera?: boolean } | undefined)?.noCamera);

export function ThirdPersonCamera({ active }: Props) {
  const { camera, gl } = useThree();
  const isDragging = useRef(false);
  const targetPos = useRef(new THREE.Vector3());
  const pivot = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const allowed = useRef(cameraAngle.distance);
  const { world, rapier } = useRapier();
  const lastTouched = useRef(0);
  const lastPos = useRef(new THREE.Vector3());
  const probeDir = useRef(new THREE.Vector3());
  const ray = useRef(new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }));
  /** Tight-spot assist: the view offsets in use and the ones being eased toward (Etapa 6). */
  const assist = useRef({ dTheta: 0, dPhi: 0, target: { dTheta: 0, dPhi: 0 } });

  useEffect(() => {
    if (!active) return;

    const canvas = gl.domElement;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) isDragging.current = true;
    };
    const onMouseUp = () => { isDragging.current = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      lastTouched.current = performance.now() / 1000;
      const k = 0.004 * useUiSettings.getState().cameraSensitivity;
      cameraAngle.theta -= e.movementX * k;
      cameraAngle.phi = Math.max(MIN_PHI, Math.min(MAX_PHI,
        cameraAngle.phi - e.movementY * k * (useUiSettings.getState().invertY ? -1 : 1)));
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraAngle.distance = Math.max(MIN_DIST, Math.min(MAX_DIST, cameraAngle.distance + e.deltaY * 0.005));
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    // Touch support
    let lastTouchDist = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        isDragging.current = true;
      } else if (e.touches.length === 2) {
        isDragging.current = false;
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging.current) {
        lastTouched.current = performance.now() / 1000;
        const dx = e.touches[0].clientX - lastTouchX;
        const dy = e.touches[0].clientY - lastTouchY;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        const k = 0.006 * useUiSettings.getState().cameraSensitivity;
        cameraAngle.theta -= dx * k;
        cameraAngle.phi = Math.max(MIN_PHI, Math.min(MAX_PHI,
          cameraAngle.phi - dy * k * (useUiSettings.getState().invertY ? -1 : 1)));
      } else if (e.touches.length === 2 && lastTouchDist > 0) {
        // pinch to zoom, same limits as the mouse wheel
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        cameraAngle.distance = Math.max(MIN_DIST, Math.min(MAX_DIST, cameraAngle.distance * (lastTouchDist / Math.max(d, 1))));
        lastTouchDist = d;
      }
    };
    const onTouchEnd = () => { isDragging.current = false; lastTouchDist = 0; };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [active, gl.domElement]);

  useFrame((_state, delta) => {
    if (!active) return;
    // dev: scene captures for UI art place the camera by hand
    if (import.meta.env.DEV && (window as unknown as { __camManual?: boolean }).__camManual) return;

    // Gentle recentering behind the cat while it moves, unless the player is steering the camera.
    const moved = Math.hypot(playerPosition.x - lastPos.current.x, playerPosition.z - lastPos.current.z) / Math.max(delta, 1e-3);
    lastPos.current.copy(playerPosition);
    if (performance.now() / 1000 - lastTouched.current > RECENTER_DELAY && moved > 1) {
      const behind = playerFacing.angle + Math.PI;
      const diff = ((behind - cameraAngle.theta + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      // running toward the camera: leave it alone instead of swinging around
      if (Math.abs(diff) < 2.5) cameraAngle.theta += diff * (1 - Math.exp(-RECENTER_RATE * Math.min(moved / 4, 1) * delta));
    }

    // Desired offset from a pivot above the cat's head.
    pivot.current.set(playerPosition.x, playerPosition.y + LOOK_AHEAD_Y, playerPosition.z);
    const wanted = cameraAngle.distance + 0.4;
    const body = playerBody.current;
    const viewDir = (theta: number, phi: number, out: THREE.Vector3) =>
      out.set(Math.sin(theta) * Math.cos(phi), Math.sin(phi) + 1.5 / Math.max(cameraAngle.distance, 1), Math.cos(theta) * Math.cos(phi)).normalize();
    const freeAlong = (d: THREE.Vector3) => {
      if (!body) return wanted;
      ray.current.origin = pivot.current;
      ray.current.dir = d;
      const hit = world.castRay(ray.current, wanted, true, undefined, undefined, undefined, body, ignoreSoft);
      return hit ? hit.timeOfImpact - 0.35 : wanted;
    };

    // Tight spots (Etapa 6): when the chosen view is blocked, try a few others (higher, turned aside) and
    // ease toward the roomiest one instead of squeezing in along the same line. The assist eases back out
    // once the chosen view is clear again; it never overrides the player while they drag the camera.
    const a = assist.current;
    const baseFree = freeAlong(viewDir(cameraAngle.theta, cameraAngle.phi, probeDir.current));
    const dragging = isDragging.current || performance.now() / 1000 - lastTouched.current < 0.3;
    if (!dragging && baseFree < wanted * 0.72) {
      const probes: Probe[] = [{ dTheta: 0, dPhi: 0, free: baseFree }];
      for (const [dT, dP] of PROBES) {
        const phi = Math.min(MAX_PHI + 0.25, cameraAngle.phi + dP);
        probes.push({ dTheta: dT, dPhi: dP, free: freeAlong(viewDir(cameraAngle.theta + dT, phi, probeDir.current)) });
      }
      const best = pickView(probes, wanted, a.target);
      a.target = { dTheta: best.dTheta, dPhi: best.dPhi };
    } else if (baseFree >= wanted * 0.9 || dragging) {
      a.target = { dTheta: 0, dPhi: 0 };
    }
    const ease = 1 - Math.exp(-2.6 * delta);
    a.dTheta += (a.target.dTheta - a.dTheta) * ease;
    a.dPhi += (a.target.dPhi - a.dPhi) * ease;
    const theta = cameraAngle.theta + a.dTheta;
    const phi = Math.min(MAX_PHI + 0.25, cameraAngle.phi + a.dPhi);
    viewDir(theta, phi, dir.current);

    // Pull the camera in when a wall or tree is still between it and Shinichi.
    let free = Math.min(wanted, freeAlong(dir.current));
    free = Math.max(1.2, free);
    // Snap closer immediately, drift back out gently.
    allowed.current = free < allowed.current ? free : THREE.MathUtils.lerp(allowed.current, free, 1 - Math.exp(-2.5 * delta));

    targetPos.current.copy(pivot.current).addScaledVector(dir.current, allowed.current);
    targetPos.current.y = Math.max(targetPos.current.y, 0.6);

    const lerpFactor = 1 - Math.pow(1 - LERP_SPEED, delta * 60);
    camera.position.lerp(targetPos.current, free < wanted ? Math.max(lerpFactor, 0.5) : lerpFactor);
    camera.lookAt(pivot.current);
    // tell the foliage shader where the line of sight is (leaves on it dissolve)
    foliageFade.cam.value.copy(camera.position);
    foliageFade.target.value.set(playerPosition.x, playerPosition.y + 0.1, playerPosition.z);
  });

  return null;
}
