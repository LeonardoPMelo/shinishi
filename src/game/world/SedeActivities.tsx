import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { create } from 'zustand';
import { Toon, Ink } from '../materials';
import { useGameStore } from '../../store/gameStore';
import { emit } from '../../systems/events';
import { INTERIORS_BY_ID, toWorld } from '../../data/interiors';
import { BOOK_COLORS, BOOK_PUZZLE, BOOK_SHELF, BOOK_SOLVED, SECRET_CASE, SEDE_NIGHTINGALE, YARD_TARGETS, YARD_TARGETS_DONE } from '../../data/mikage';
import { press, brokenRule } from '../../systems/orderPuzzle';
import { registerTarget } from '../systems/shuriken';
import { useSpot } from '../systems/training';
import { numberTexture } from './TargetRange';
import { NightingaleFloor } from './AcademyActivities';
import { Box, Solid, DARK, WOOD } from './interiorParts';

/**
 * The residence's puzzles (Etapa 5 da expansão): the five books of the founding poem and the bookcase they
 * open, the nightingale floor of the reserved room, and the training-yard targets. Rules in
 * systems/orderPuzzle.ts; this file reads the cat, draws, and reports.
 */

const S = INTERIORS_BY_ID.sede;
const toast = (icon: string, text: string) => emit({ type: 'toast', icon, text });

// ── The five books ────────────────────────────────────────────────────────────
const useBooks = create<{ pulled: string[]; set: (p: string[]) => void }>((set) => ({ pulled: [], set: (pulled) => set({ pulled }) }));

function Book({ piece, index }: { piece: string; index: number }) {
  const look = BOOK_COLORS[piece];
  const out = useBooks((s) => s.pulled.includes(piece));
  const open = useGameStore((s) => !!s.progress.flags.biblioteca_aberta);
  const x = BOOK_SHELF.at[0] + (index - (BOOK_PUZZLE.pieces.length - 1) / 2) * BOOK_SHELF.spacing;
  const z = BOOK_SHELF.at[1];
  const [wx, , wz] = toWorld(S, x, z);

  const pull = () => {
    const p = useGameStore.getState().progress;
    if (p.flags.biblioteca_aberta) return;
    if (!p.missions.pergaminho?.steps.includes('poema')) {
      toast('📚', 'Cinco livros coloridos, bem presos na estante. Alguém deve saber em que ordem puxá-los... o Fumi, talvez?');
      return;
    }
    const r = press(BOOK_PUZZLE, useBooks.getState().pulled, piece);
    if (r.result === 'repeat') return;
    if (r.result === 'progress') {
      emit({ type: 'sfx', name: 'thwack' });
      useBooks.getState().set(r.pulled);
      return;
    }
    if (r.result === 'wrong') {
      const broke = brokenRule(BOOK_PUZZLE, r.attempt);
      emit({ type: 'sfx', name: 'challenge_wrong' });
      useGameStore.getState().recordPractice('logica', false);
      useBooks.getState().set([]);
      toast('📚', `Os livros voltaram para o lugar. Este verso do poema não bateu: "${broke?.text ?? ''}"`);
      return;
    }
    useBooks.getState().set(r.pulled);
    useGameStore.getState().runActions(BOOK_SOLVED);
    toast('🗝️', 'Clique... e um rangido no fundo da biblioteca: a estante do canto deslizou!');
  };

  useSpot(`livro_${piece}`, [wx, 0, wz], 0.62, () => {
    if (useGameStore.getState().progress.flags.biblioteca_aberta || useBooks.getState().pulled.includes(piece)) return null;
    return `Puxar o livro ${look.name.toLowerCase()}`;
  }, pull, 1.5);

  const pulledOut = out || open;
  return (
    <group position={[x, 0.98, z + (pulledOut ? 0.12 : 0)]} rotation={[pulledOut ? -0.25 : 0, 0, 0]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.2, 0.42, 0.3]} />
        <Toon color={look.color} />
        <Ink thickness={0.01} />
      </mesh>
      <mesh position={[0, 0.3, 0.152]}>
        <planeGeometry args={[0.12, 0.04]} />
        <Toon color="#E9D9AE" />
      </mesh>
    </group>
  );
}

function BookStand() {
  const [x, z] = BOOK_SHELF.at;
  const w = BOOK_PUZZLE.pieces.length * BOOK_SHELF.spacing + 0.3;
  return (
    <group>
      <group position={[x, 0, z]}>
        <Solid size={[w, 0.95, 0.42]} color={WOOD} tex="wood" />
        <Box size={[w + 0.06, 0.05, 0.48]} at={[0, 0.975, 0]} color={DARK} tex="wood" />
      </group>
      {BOOK_PUZZLE.pieces.map((p, i) => <Book key={p} piece={p} index={i} />)}
    </group>
  );
}

/** The bookcase in front of the secret doorway: it slides east when the books are pulled in order. */
function SecretCase() {
  const open = useGameStore((s) => !!s.progress.flags.biblioteca_aberta);
  const group = useRef<THREE.Group>(null);
  const [cx, cz] = SECRET_CASE.at;
  useFrame((_s, dt) => {
    const g = group.current;
    if (!g) return;
    const target = open ? SECRET_CASE.openX : cx;
    g.position.x += (target - g.position.x) * Math.min(1, dt * 2.5);
  });
  return (
    <>
      {/* the collider jumps to the open place at once (the visual slides). A fixed body stays where it was
          created, so it is rebuilt (key) rather than moved: moving its group left the doorway blocked in play */}
      <group key={open ? 'aberta' : 'fechada'} position={[open ? SECRET_CASE.openX : cx, 0, cz]}>
        <Solid size={[SECRET_CASE.w, 2.0, 0.4]} color={WOOD} tex="wood" ink={0} />
      </group>
      <group ref={group} position={[cx, 0, cz]}>
        {[0.45, 1.0, 1.55].map((y, row) =>
          [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].map((x, i) => (
            <mesh key={`${y}${x}`} position={[x, y + 0.15, 0.21]} castShadow>
              <boxGeometry args={[0.15, 0.32 - ((i + row) % 3) * 0.04, 0.05]} />
              <Toon color={['#7E3B32', '#3F5277', '#4F6B52', '#C9A04A', '#6A4C7A'][(i + row * 3) % 5]} />
            </mesh>
          )),
        )}
      </group>
    </>
  );
}

// ── The training-yard targets ─────────────────────────────────────────────────
const useTargets = create<{ hit: number[]; set: (hit: number[]) => void }>((set) => ({ hit: [], set: (hit) => set({ hit }) }));
const ORDER = [...YARD_TARGETS].map((t) => t.value).sort((a, b) => a - b);

function YardTarget({ value, at }: { value: number; at: [number, number] }) {
  const tex = useMemo(() => numberTexture(value), [value]);
  useEffect(() => () => tex.dispose(), [tex]);
  const hit = useTargets((s) => s.hit.includes(value));
  const wobble = useRef(0);
  const face = useRef<THREE.Group>(null);
  const [wx, , wz] = toWorld(S, at[0], at[1]);
  const center = useMemo(() => new THREE.Vector3(wx, 1.25, wz + 0.1), [wx, wz]);

  useEffect(
    () =>
      registerTarget({
        id: `alvo_sede_${value}`,
        position: center,
        radius: 0.45,
        onHit: () => {
          wobble.current = 1;
          const st = useTargets.getState();
          const want = ORDER[st.hit.length];
          if (st.hit.includes(value)) return;
          if (value !== want) {
            st.set([]);
            emit({ type: 'sfx', name: 'challenge_wrong' });
            toast('🎯', `O ${value} veio fora da ordem! Do menor para o maior: ${ORDER.join(', ')}. Os alvos voltaram.`);
            return;
          }
          const next = [...st.hit, value];
          st.set(next);
          if (next.length < ORDER.length) return;
          const first = !useGameStore.getState().progress.flags.alvos_sede;
          if (first) useGameStore.getState().runActions(YARD_TARGETS_DONE);
          else emit({ type: 'sfx', name: 'chime' });
          toast('🎯', first ? 'Três de três, na ordem! A guarda da Sede aplaude (e deixa 15 moedas).' : 'Três de três de novo! Precisão de ninja.');
          window.setTimeout(() => useTargets.getState().set([]), 2500);
        },
      }),
    [center, value],
  );

  useFrame((_s, dt) => {
    wobble.current = Math.max(0, wobble.current - dt * 1.6);
    if (face.current) face.current.rotation.x = -Math.sin(wobble.current * 18) * wobble.current * 0.35;
  });

  return (
    <group position={[at[0], 0, at[1]]}>
      {[-0.32, 0.32].map((dx) => (
        <mesh key={dx} position={[dx, 0.6, -0.05]} rotation={[0, 0, dx * 0.25]} castShadow>
          <boxGeometry args={[0.07, 1.25, 0.07]} />
          <Toon color="#7A5236" tex="wood" />
        </mesh>
      ))}
      <group ref={face} position={[0, 1.25, 0]}>
        <mesh>
          <circleGeometry args={[0.42, 28]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
        {hit && (
          <mesh position={[0, 0, 0.01]}>
            <ringGeometry args={[0.42, 0.5, 28]} />
            <meshBasicMaterial color="#6FCF6A" toneMapped={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}

export function SedeActivities({ active }: { active: boolean }) {
  return (
    <>
      <group position={[S.origin[0], 0, S.origin[1]]} visible={active}>
        <BookStand />
        <SecretCase />
        {YARD_TARGETS.map((t) => <YardTarget key={t.value} value={t.value} at={t.at} />)}
      </group>
      <NightingaleFloor
        active={active}
        origin={S.origin}
        rect={SEDE_NIGHTINGALE.rect}
        back={SEDE_NIGHTINGALE.back}
        onCaught={() => toast('📣', '"SHHH!", sussurra o Fumi lá da biblioteca. "Chão de rouxinol! Vá agachado, ou o pergaminho nunca sai de lá."')}
      />
    </>
  );
}
