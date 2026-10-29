import { useMemo, useRef } from 'react';
import { blobMaterial, blobForHeight } from './contactBlob';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, useRapier, CoefficientCombineRule } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { input, consume } from '../systems/input';
import {
  playerPosition, playerFacing, cameraAngle, playerBody, playerGround, playerMotion, abilityState, SPAWN, now,
  MIADO_COOLDOWN, FARO_COOLDOWN, FARO_DURATION, SHURIKEN_COOLDOWN, DASH_COOLDOWN, EMOTE_COOLDOWN,
} from '../systems/playerState';
import { throwShuriken } from '../systems/shuriken';
import { currentObjective } from '../../systems/objective';
import { spawnParticles } from '../systems/particles';
import { spawnRing } from '../systems/vfx';
import { emit } from '../../systems/events';
import { RIVER, WORLD_BOUNDS, STEPPING_STONES } from '../../data/world';
import { TEMPLE, inTemple } from '../../systems/temple';
import { inPond } from '../../data/east';
import { inOnsen } from '../../data/west';
import { inStream } from '../../data/south';
import { clampToRegions } from '../../data/regions';
import { useGameStore } from '../../store/gameStore';
import { ShinichiCat, type AnimState } from './ShinichiCat';
import { useFromBag } from '../systems/itemEffects';

// Speeds fit a quadruped kitten ~1.3 m tall: the trot/gallop clips keep pace without sliding.
const WALK_SPEED = 4.2;
const RUN_SPEED = 7.2;
/** Sneaking: slow, low and silent (no footsteps). */
const CROUCH_SPEED = 1.9;
/** Crouching with the Passo Leve technique (academy graduation): nearly a walk, still silent. */
const LIGHT_STEP_SPEED = 3.3;
const DASH_SPEED = 13;
const DASH_TIME = 0.2;
const BOOST_SPEED = 1.3;
const BOOST_JUMP = 1.12;
const JUMP_FORCE = 7.4;
const DOUBLE_JUMP_FORCE = 6.8;
const ACCEL = 14;
const AIR_CONTROL = 0.55;
/** Turn rate toward the movement direction (1/s, frame-rate independent). */
const TURN_RATE = 12;
const COYOTE_TIME = 0.13;
const JUMP_BUFFER = 0.14;
const FOOT = 0.68;
const MAX_FALL = -22;
/**
 * Kept outside the component on purpose: @react-three/rapier treats a new userData object as a changed option
 * and, on every re-render, puts the body back where its 3D object was at the last physics step. That undid the
 * door teleports (zone.ts), which re-render the scene in between steps.
 */
const BODY_USER_DATA = { player: true };

type Surface = 'grass' | 'stone' | 'wood';

function surfaceAt(x: number, y: number, z: number, hinted?: string): Surface {
  if (hinted === 'wood' || hinted === 'stone') return hinted;
  if (Math.abs(x) < RIVER.bridgeHalfWidth + 0.2 && Math.abs(z - RIVER.z) < RIVER.halfWidth + 0.6) return 'wood';
  if (Math.hypot(x, z) < 4.85 || y > 0.95) return 'stone';
  return 'grass';
}

export function inRiver(x: number, z: number) {
  if (inPond(x, z) || inOnsen(x, z) || inStream(x, z)) return true;
  if (Math.abs(z - RIVER.z) > RIVER.halfWidth) return false;
  if (Math.abs(x) < RIVER.bridgeHalfWidth) return false;
  return !STEPPING_STONES.some(([sx, , sz]) => Math.hypot(x - sx, z - sz) < 0.75);
}

type UserData = { surface?: string; bounce?: number } | undefined;

export function Shinichi() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);
  const anim = useRef<AnimState>({ speed: 0, airborne: false, squash: 0, vy: 0, crouch: false });
  const { world, rapier } = useRapier();

  const st = useRef({
    yAngle: Math.PI,
    grounded: true,
    sinceGrounded: 0,
    bufferedJump: 0,
    airJumps: 0,
    jumpLock: 0,
    groundJumpActive: false,
    stepPhase: 0,
    fallSpeed: 0,
    idleTime: 0,
    dustTimer: 0,
    splashCooldown: 0,
    surface: undefined as string | undefined,
    dashTime: 0,
    airDashed: false,
    lean: 0,
    auraTimer: 0,
    /** Time spent airborne with almost no vertical speed (resting on a corner). */
    perchTime: 0,
  });
  const dashDir = useRef(new THREE.Vector3());
  const lastSafe = useRef(SPAWN.clone());
  const move = useRef(new THREE.Vector3());
  const vel = useRef(new THREE.Vector3());
  const platformVel = useRef(new THREE.Vector3());
  const normal = useRef(new THREE.Vector3(0, 1, 0));

  // Soft contact shadow on whatever is under the cat (Etapa 5): grounds it everywhere, and in the air it
  // marks the landing spot, shrinking and fading with height.
  const blob = useMemo(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMaterial(0.5));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 1;
    m.userData.dynamic = true;
    m.userData.keepVisible = true;
    m.frustumCulled = false;
    return m;
  }, []);
  const blobRay = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }), [rapier]);
  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;
    const p = body.translation();
    blobRay.origin = { x: p.x, y: p.y, z: p.z };
    const hit = world.castRay(blobRay, 8, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body);
    if (!hit) {
      blob.visible = false;
      return;
    }
    const groundY = p.y - hit.timeOfImpact;
    const [k, fade] = blobForHeight(hit.timeOfImpact - FOOT);
    blob.visible = fade > 0.02;
    blob.position.set(p.x, groundY + 0.02, p.z);
    // an oval along the body (the cat is long), turned with it
    blob.rotation.set(-Math.PI / 2, 0, st.current.yAngle);
    blob.scale.set(0.62 * k, 0.95 * k, 1);
    (blob.material as THREE.MeshBasicMaterial).opacity = 0.5 * fade;
  });

  useFrame((_state, rawDelta) => {
    const body = bodyRef.current;
    if (!body || !visualRef.current) return;
    playerBody.current = body;
    const s = st.current;
    const delta = Math.min(rawDelta, 0.05);
    const pos = body.translation();
    playerPosition.set(pos.x, pos.y, pos.z);

    // read from the store each frame, not from the last render: a render can lag a frame behind (or many,
    // while the window is hidden), and the cat must not walk during a dialogue or stand frozen after one
    const game = useGameStore.getState();
    if (game.phase !== 'playing' || game.celebrations.length > 0) {
      consume('jump');
      anim.current.speed = 0;
      anim.current.airborne = false;
      const v = body.linvel();
      body.setLinvel({ x: 0, y: Math.min(v.y, 0), z: 0 }, true);
      return;
    }

    // ── Ground probe: ray straight down, gives the surface normal and what we stand on.
    const ray = new rapier.Ray({ x: pos.x, y: pos.y, z: pos.z }, { x: 0, y: -1, z: 0 });
    const hit = world.castRayAndGetNormal(ray, 1.3, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body);
    const wasGrounded = s.grounded;
    s.jumpLock = Math.max(0, s.jumpLock - delta);
    s.grounded = !!hit && hit.timeOfImpact < FOOT + 0.14 && hit.normal.y > 0.55 && s.jumpLock <= 0.08;
    platformVel.current.set(0, 0, 0);
    s.surface = undefined;
    let bounce = 0;
    if (hit && s.grounded) {
      normal.current.set(hit.normal.x, hit.normal.y, hit.normal.z);
      const other = hit.collider.parent();
      if (other) {
        s.surface = (other.userData as UserData)?.surface;
        bounce = (other.userData as UserData)?.bounce ?? 0;
        if (other.isKinematic()) {
          const pv = other.linvel();
          platformVel.current.set(pv.x, 0, pv.z);
        }
      }
    } else normal.current.set(0, 1, 0);

    const v = body.linvel();
    s.sinceGrounded = s.grounded ? 0 : s.sinceGrounded + delta;
    if (!s.grounded) s.fallSpeed = Math.min(s.fallSpeed, v.y);

    if (s.grounded && !wasGrounded) {
      const impact = -s.fallSpeed;
      if (impact > 4) {
        emit({ type: 'sfx', name: 'land' });
        anim.current.squash = Math.min(1, impact / 12);
        spawnParticles('dust', [pos.x, pos.y - FOOT + 0.05, pos.z], Math.min(10, 3 + Math.round(impact / 2)));
        if (impact > 7) spawnRing([pos.x, pos.y - FOOT + 0.04, pos.z], { color: '#F2E6CF', size: Math.min(1.6, impact / 8), life: 0.35 });
      }
      s.fallSpeed = 0;
      s.groundJumpActive = false;
    }
    if (s.grounded) {
      s.airJumps = 0;
      s.airDashed = false;
      if (!inRiver(pos.x, pos.z) && Math.abs(platformVel.current.x) + Math.abs(platformVel.current.z) < 0.01) {
        lastSafe.current.set(pos.x, pos.y + 0.3, pos.z);
      }
    }

    // ── Camera-relative intent from keys or the touch stick.
    const forward = new THREE.Vector3(-Math.sin(cameraAngle.theta), 0, -Math.cos(cameraAngle.theta));
    const right = new THREE.Vector3(Math.cos(cameraAngle.theta), 0, -Math.sin(cameraAngle.theta));
    const m = move.current.set(0, 0, 0);
    if (input.forward) m.add(forward);
    if (input.backward) m.sub(forward);
    if (input.left) m.sub(right);
    if (input.right) m.add(right);
    const stick = Math.hypot(input.stickX, input.stickY);
    if (stick > 0) m.addScaledVector(forward, input.stickY).addScaledVector(right, input.stickX);
    const intent = Math.min(1, m.length());
    if (intent > 0) m.normalize();

    const crouching = input.crouch && s.grounded;
    const running = !crouching && (input.run || stick > 0.92);
    const t = now();
    const boosted = abilityState.boostUntil > t;
    const crouchSpeed = crouching && useGameStore.getState().progress.abilities.includes('passo_leve') ? LIGHT_STEP_SPEED : CROUCH_SPEED;
    const target = m.multiplyScalar((crouching ? crouchSpeed : running ? RUN_SPEED : WALK_SPEED) * intent * (boosted ? BOOST_SPEED : 1));
    anim.current.crouch = crouching;
    // for the animals: a sneaking cat may come close, a running one scares them from farther (Etapa 4)
    playerMotion.crouch = crouching;
    playerMotion.speed = Math.hypot(v.x - platformVel.current.x, v.z - platformVel.current.z);
    const control = s.grounded ? 1 : AIR_CONTROL;
    const k = 1 - Math.exp(-ACCEL * control * delta);
    const kStop = 1 - Math.exp(-ACCEL * 1.5 * control * delta);
    vel.current.set(v.x - platformVel.current.x, 0, v.z - platformVel.current.z).lerp(target, intent > 0 ? k : kStop);
    let vy = Math.max(v.y, MAX_FALL);

    // ── Jump: buffered presses, coyote time, double jump, variable height.
    if (consume('jump')) s.bufferedJump = JUMP_BUFFER;
    else s.bufferedJump = Math.max(0, s.bufferedJump - delta);
    const abilities = useGameStore.getState().progress.abilities;
    if (s.bufferedJump > 0) {
      if ((s.grounded || s.sinceGrounded < COYOTE_TIME) && s.jumpLock <= 0) {
        vy = JUMP_FORCE * (boosted ? BOOST_JUMP : 1);
        s.jumpLock = 0.2;
        s.grounded = false;
        s.sinceGrounded = COYOTE_TIME;
        s.bufferedJump = 0;
        s.groundJumpActive = true;
        emit({ type: 'sfx', name: 'jump' });
        spawnParticles('dust', [pos.x, pos.y - FOOT + 0.05, pos.z], 4);
      } else if (!s.grounded && s.airJumps === 0 && abilities.includes('double_jump') && s.jumpLock <= 0.12) {
        vy = DOUBLE_JUMP_FORCE;
        s.airJumps = 1;
        s.fallSpeed = 0;
        s.bufferedJump = 0;
        s.groundJumpActive = false;
        emit({ type: 'sfx', name: 'double_jump' });
        spawnParticles('sparkle', [pos.x, pos.y - 0.3, pos.z], 8);
      }
    }
    // Bouncy surfaces (giant mushrooms, lily pads) launch the cat upward.
    if (bounce > 0 && s.grounded && s.jumpLock <= 0) {
      vy = bounce;
      s.jumpLock = 0.25;
      s.grounded = false;
      s.groundJumpActive = false;
      s.airJumps = 0;
      anim.current.squash = 1;
      emit({ type: 'sfx', name: 'boing', position: [pos.x, pos.y, pos.z] });
      spawnParticles('sparkle', [pos.x, pos.y - FOOT + 0.1, pos.z], 6);
    }
    // Releasing the button early gives a short hop.
    if (s.groundJumpActive && !input.jumpHeld && vy > 2.5) {
      vy *= 0.55;
      s.groundJumpActive = false;
    }

    // ── Impulso Ninja (2): a short burst along the stick/keys, or straight ahead.
    if (consume('dash')) {
      if (t >= abilityState.dashReadyAt && (s.grounded || !s.airDashed)) {
        if (intent > 0) dashDir.current.set(target.x, 0, target.z).normalize();
        else dashDir.current.set(Math.sin(s.yAngle), 0, Math.cos(s.yAngle));
        s.dashTime = DASH_TIME;
        abilityState.dashReadyAt = t + DASH_COOLDOWN;
        if (!s.grounded) s.airDashed = true;
        emit({ type: 'sfx', name: 'dash' });
        spawnParticles('smoke', [pos.x, pos.y - 0.3, pos.z], 8);
        // a ring left behind, standing up across the dash direction
        spawnRing([pos.x, pos.y - 0.15, pos.z], { color: '#9FD8FF', size: 0.8, life: 0.3, normal: [dashDir.current.x, 0, dashDir.current.z] });
      } else emit({ type: 'sfx', name: 'denied' });
    }
    const dashing = s.dashTime > 0;
    if (dashing) {
      s.dashTime -= delta;
      vel.current.copy(dashDir.current).multiplyScalar(DASH_SPEED);
      vy = Math.max(vy, s.grounded ? vy : 0.6); // a little float: an air dash crosses gaps
      if (Math.random() < 0.5) spawnParticles('smoke', [pos.x, pos.y - 0.2, pos.z], 1);
    }

    // ── Slopes and stairs: follow the surface instead of sliding or bouncing.
    if (s.grounded && vy <= 0.5 && bounce === 0) {
      const n = normal.current;
      vy = -(n.x * vel.current.x + n.z * vel.current.z) / Math.max(n.y, 0.5) - 0.6;
      // Step-up assist: a low ledge right in front gets climbed automatically.
      if (intent > 0.2) {
        const dir = { x: target.x / (target.length() || 1), y: 0, z: target.z / (target.length() || 1) };
        const low = world.castRay(new rapier.Ray({ x: pos.x, y: pos.y - FOOT + 0.12, z: pos.z }, dir), 0.55, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body);
        const high = world.castRay(new rapier.Ray({ x: pos.x, y: pos.y - FOOT + 0.42, z: pos.z }, dir), 0.6, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body);
        if (low && !high) vy = Math.max(vy, 3.4);
      }
    }

    // ── Edge perch: the round capsule can rest on a corner (a counter, a crate) while the centre
    // ray sees no ground, freezing the cat mid-air in the fall pose. Find the supported side and
    // slide off it; a real landing (centre over the surface) is untouched.
    s.perchTime = !s.grounded && Math.abs(v.y) < 0.6 && !dashing ? s.perchTime + delta : 0;
    // a jump apex also has |vy| ≈ 0, but only for ~0.07 s; a perch lasts
    if (s.perchTime > 0.15) {
      const push = new THREE.Vector3();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const ox = Math.sin(a) * 0.32;
        const oz = Math.cos(a) * 0.32;
        const h = world.castRay(new rapier.Ray({ x: pos.x + ox, y: pos.y, z: pos.z + oz }, { x: 0, y: -1, z: 0 }), FOOT + 0.25, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body);
        if (h) push.add(new THREE.Vector3(-ox, 0, -oz));
      }
      if (push.lengthSq() > 0) {
        push.normalize().multiplyScalar(2.6);
        vel.current.x = push.x;
        vel.current.z = push.z;
        vy = Math.min(vy, -1.5);
      }
    }

    body.setLinvel({ x: vel.current.x + platformVel.current.x, y: vy, z: vel.current.z + platformVel.current.z }, true);

    const speed = Math.hypot(vel.current.x, vel.current.z);
    let turn = 0;
    if (speed > 0.3 && (intent > 0 || dashing)) {
      const targetAngle = Math.atan2(vel.current.x, vel.current.z);
      const diff = ((targetAngle - s.yAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      turn = diff * (1 - Math.exp(-TURN_RATE * delta));
      s.yAngle += turn;
    }
    if (import.meta.env.DEV && playerFacing.force !== null) s.yAngle = playerFacing.force;
    // Weight: lean into turns at speed, settle back when straight.
    const leanGoal = THREE.MathUtils.clamp((-turn / Math.max(delta, 1e-3)) * 0.045 * Math.min(speed / RUN_SPEED, 1), -0.28, 0.28);
    s.lean += (leanGoal - s.lean) * (1 - Math.exp(-10 * delta));
    visualRef.current.rotation.set(dashing ? -0.12 : 0, s.yAngle, s.lean, 'YXZ');
    playerFacing.angle = s.yAngle;
    playerGround.grounded = s.grounded;

    // ── Footsteps and running dust follow the leg cycle.
    if (s.grounded && speed > 0.6) {
      const before = Math.floor(s.stepPhase / Math.PI);
      s.stepPhase += delta * (5 + speed * 1.5);
      if (Math.floor(s.stepPhase / Math.PI) !== before && !crouching) {
        emit({ type: 'sfx', name: `step_${surfaceAt(pos.x, pos.y, pos.z, s.surface)}${running ? '_run' : ''}` });
      }
      s.dustTimer -= delta;
      if (running && s.dustTimer <= 0) {
        s.dustTimer = 0.22;
        spawnParticles('dust', [pos.x - vel.current.x * 0.05, pos.y - FOOT + 0.05, pos.z - vel.current.z * 0.05], 2);
      }
    }

    s.idleTime = speed < 0.2 && s.grounded ? s.idleTime + delta : Math.min(s.idleTime, 0);
    if (s.idleTime > 9) {
      s.idleTime = -25;
      emit({ type: 'sfx', name: 'purr' });
    }

    // ── Abilities.
    // 1: training shuriken, thrown where Shinichi faces (aim assist picks a target in front).
    if (consume('shuriken')) {
      if (t >= abilityState.shurikenReadyAt) {
        abilityState.shurikenReadyAt = t + SHURIKEN_COOLDOWN;
        throwShuriken(new THREE.Vector3(pos.x, pos.y + 0.05, pos.z), new THREE.Vector3(Math.sin(s.yAngle), 0, Math.cos(s.yAngle)));
        emit({ type: 'sfx', name: 'shuriken' });
      } else emit({ type: 'sfx', name: 'denied' });
    }
    // 3: energy potion from the bag (spending and effect: systems/inventory.ts + itemEffects.ts)
    if (consume('pocao') && !useFromBag('pocao_energia')) {
      emit({ type: 'toast', icon: '🧪', text: 'Sem Poção de Energia na mochila. Baús e desafios às vezes têm uma!' });
    }
    if (boosted) {
      s.auraTimer -= delta;
      if (s.auraTimer <= 0) {
        s.auraTimer = 0.25;
        spawnParticles('sparkle', [pos.x, pos.y + 0.1, pos.z], 2);
      }
    }
    // 4 (or Q): Faro reveals secrets and lays glowing paw prints toward the tracked objective.
    if (consume('faro')) {
      if (t >= abilityState.faroReadyAt) {
        abilityState.faroUntil = t + FARO_DURATION;
        abilityState.faroReadyAt = t + FARO_COOLDOWN;
        emit({ type: 'sfx', name: 'faro' });
        spawnParticles('sparkle', [pos.x, pos.y + 0.6, pos.z], 14);
        // the tracked mission's nearest step, or (no mission yet) the villager who has one to offer
        const target = currentObjective(useGameStore.getState().progress, playerPosition)?.position;
        const goal = target ? new THREE.Vector3(target[0], 0, target[2]) : null;
        abilityState.trail = goal ? { from: new THREE.Vector3(pos.x, 0, pos.z), to: goal, until: t + FARO_DURATION } : null;
      } else emit({ type: 'sfx', name: 'denied' });
    }
    // G / R3 / 🎉: celebrate. Standing on the ground only; the villagers around react (NPC.tsx).
    if (consume('emote') && s.grounded && t >= abilityState.emoteReadyAt) {
      abilityState.emoteReadyAt = t + EMOTE_COOLDOWN;
      abilityState.lastEmote = { time: t, position: playerPosition.clone() };
      emit({ type: 'sfx', name: 'giggle' });
      spawnParticles('sparkle', [pos.x, pos.y + 0.6, pos.z], 10, '#FFD54A');
    }
    if (consume('miado') && t >= abilityState.miadoReadyAt) {
      abilityState.miadoReadyAt = t + MIADO_COOLDOWN;
      abilityState.lastMeow = { time: t, position: playerPosition.clone() };
      emit({ type: 'sfx', name: 'player_meow' });
    }

    // ── Friendly river hazard: splash and pop back to the last dry spot.
    s.splashCooldown = Math.max(0, s.splashCooldown - delta);
    if (inRiver(pos.x, pos.z) && pos.y < 0.85 && s.splashCooldown <= 0 && !s.surface) {
      s.splashCooldown = 1;
      emit({ type: 'sfx', name: 'splash' });
      spawnParticles('splash', [pos.x, 0.2, pos.z], 14);
      emit({ type: 'toast', icon: '💦', text: inPond(pos.x, pos.z)
        ? 'SPLASH! As carpas levaram um susto. Atravesse o lago pelas pedras.'
        : inOnsen(pos.x, pos.z)
          ? 'AI, QUENTE! A fonte termal é só para olhar. O Seu Goro avisou!'
          : inStream(pos.x, pos.z)
            ? 'SPLASH! Patas molhadas no riacho. Use o tronco ou as pedras.'
            : 'SPLASH! Gatos e rios não combinam. Use a ponte, as pedras ou os troncos.' });
      body.setTranslation({ x: lastSafe.current.x, y: lastSafe.current.y + 0.4, z: lastSafe.current.z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      vel.current.set(0, 0, 0);
    }

    // ── Safety nets.
    // the temple courtyard north of the village (entered through the gate), or else the village and the
    // districts outside its fence (data/regions.ts)
    if (!inTemple(pos.x, pos.z)) {
      if (pos.z < WORLD_BOUNDS.minZ && inTemple(THREE.MathUtils.clamp(pos.x, TEMPLE.minX, TEMPLE.maxX), Math.max(pos.z, TEMPLE.minZ))) {
        const tx = THREE.MathUtils.clamp(pos.x, TEMPLE.minX, TEMPLE.maxX);
        const tz = Math.max(pos.z, TEMPLE.minZ);
        if (tx !== pos.x || tz !== pos.z) body.setTranslation({ x: tx, y: pos.y, z: tz }, true);
      } else {
        const c = clampToRegions(pos.x, pos.z);
        if (c) body.setTranslation({ x: c.x, y: pos.y, z: c.z }, true);
      }
    }
    if (pos.y < -5) {
      body.setTranslation({ x: SPAWN.x, y: SPAWN.y + 1, z: SPAWN.z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    anim.current.speed = speed;
    anim.current.airborne = !s.grounded;
    anim.current.vy = vy;
  });

  return (
    <>
    <primitive object={blob} />
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      lockRotations
      linearDamping={0}
      angularDamping={1}
      colliders={false}
      position={[SPAWN.x, SPAWN.y, SPAWN.z]}
      name="shinichi"
      ccd
      userData={BODY_USER_DATA}
    >
      <CapsuleCollider args={[0.28, 0.38]} position={[0, -0.02, 0]} friction={0} frictionCombineRule={CoefficientCombineRule.Min} />
      <group ref={visualRef} rotation={[0, Math.PI, 0]}>
        <ShinichiCat anim={anim} />
      </group>
    </RigidBody>
    </>
  );
}
