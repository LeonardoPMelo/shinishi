import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Toon, Ink, getGradient } from '../materials';
import { registerTarget } from '../systems/shuriken';
import { useGameStore } from '../../store/gameStore';
import { emit } from '../../systems/events';
import { nextRound, type PracticeRound } from '../../systems/practice';
import { SKILLS } from '../../data/skills';
import type { Skill } from '../../types';

/**
 * "Alvo dos Números": a sign asks a question, three targets show answers.
 * Hit the right one with a training shuriken (key 1) to clear the round.
 * A wrong hit never punishes: the sign explains the idea and the round stays open.
 * After the three story rounds it becomes free practice (systems/practice.ts): the
 * questions adapt to the skills the player has practised least, and every 5 right
 * answers earn a Gema do Saber.
 */

interface Round {
  skill: Skill;
  question: string;
  options: [number, number, number];
  answer: number;
  /** Explanation shown after a miss: how to think about it, not just the answer. */
  hint: string;
}

const ROUNDS: Round[] = [
  { skill: 'multiplicacao', question: '6 × 7 = ?', options: [36, 42, 48], answer: 42, hint: '6 × 7 é 6 grupos de 7: 7, 14, 21, 28, 35… e mais um!' },
  { skill: 'divisao', question: '48 ÷ 8 = ?', options: [6, 8, 4], answer: 6, hint: 'Quantos grupos de 8 cabem em 48? Conte de 8 em 8: 8, 16, 24…' },
  { skill: 'adicao', question: '9 + 15 = ?', options: [21, 27, 24], answer: 24, hint: 'Pense em 10 + 15 = 25. Como 9 é um a menos que 10…' },
];

/** Right answers in free practice that earn one gem. */
const GEM_EVERY = 5;

export const RANGE = {
  // Clear lines of fire from the dojo yard: the stone lanterns at x = ±1.6, z = -10 stay out of the way.
  center: new THREE.Vector3(3.6, 0, -12.2),
  /** Targets in a row facing +z (toward the dojo yard). */
  offsets: [-1.3, 0, 1.3],
  /** Scoreboard behind and above the targets, so it never blocks a throw. */
  sign: new THREE.Vector3(3.6, 0, -13.1),
};

export function numberTexture(n: number | null) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const rings = ['#E8553B', '#FFF4E0', '#E8553B', '#FFF4E0', '#E8553B'];
  rings.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(128, 128, 126 - i * 24, 0, Math.PI * 2);
    ctx.fill();
  });
  if (n !== null) {
    ctx.fillStyle = '#FFF4E0';
    ctx.beginPath();
    ctx.arc(128, 128, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2A1E16';
    ctx.font = 'bold 84px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 128, 134);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(lines: string[]) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#5A3A24';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#3A2416';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 500, 244);
  ctx.fillStyle = '#FFF0D2';
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText(lines[0], 256, 62);
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText(lines[1], 256, 146);
  ctx.font = '26px Georgia, serif';
  ctx.fillStyle = '#F2C14E';
  ctx.fillText(lines[2], 256, 210);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Target({ index, round, done, onHit }: { index: number; round: Round | PracticeRound | null; done: boolean; onHit: (index: number) => void }) {
  const group = useRef<THREE.Group>(null);
  const wobble = useRef(0);
  const hit = useRef(onHit);
  hit.current = onHit;
  const value = round ? round.options[index] : null;
  const tex = useMemo(() => numberTexture(value), [value]);
  useEffect(() => () => tex.dispose(), [tex]);
  const x = RANGE.center.x + RANGE.offsets[index];
  const z = RANGE.center.z;
  const center = useMemo(() => new THREE.Vector3(x, 1.25, z + 0.1), [x, z]);

  useEffect(
    () =>
      registerTarget({
        id: `alvo_${index}`,
        position: center,
        radius: 0.45,
        onHit: () => {
          wobble.current = 1;
          hit.current(index);
        },
      }),
    [center, index]
  );

  useFrame((_s, dt) => {
    if (!group.current) return;
    wobble.current = Math.max(0, wobble.current - dt * 1.6);
    group.current.rotation.x = -Math.sin(wobble.current * 18) * wobble.current * 0.35;
  });

  return (
    <group position={[x, 0, z]}>
      {[-0.32, 0.32].map((dx) => (
        <mesh key={dx} position={[dx, 0.6, -0.05]} rotation={[0, 0, dx * 0.25]} castShadow>
          <boxGeometry args={[0.07, 1.25, 0.07]} />
          <Toon color="#7A5236" tex="wood" />
        </mesh>
      ))}
      <group ref={group} position={[0, 1.25, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.46, 0.46, 0.08, 28]} />
          <Toon color="#C9A16A" tex="thatch" />
          <Ink thickness={0.02} />
        </mesh>
        <mesh position={[0, 0, 0.042]}>
          <circleGeometry args={[0.44, 32]} />
          <meshToonMaterial map={tex} gradientMap={getGradient()} />
        </mesh>
      </group>
      {done && !round && (
        <mesh position={[0, 1.95, 0]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshBasicMaterial color="#FFD76A" />
        </mesh>
      )}
    </group>
  );
}

export function TargetRange() {
  const roundIdx = useGameStore((s) => s.progress.counters.alvo_rodada ?? 0);
  const done = useGameStore((s) => !!s.progress.flags.alvo_numeros);
  const practiced = useGameStore((s) => s.progress.counters.treino_acertos ?? 0);
  const story = done ? null : ROUNDS[Math.min(roundIdx, ROUNDS.length - 1)];
  // free practice: a generated round, kept in memory (a new one each visit is fine)
  const [practice, setPractice] = useState<PracticeRound | null>(null);
  const recent = useRef<Skill[]>([]);
  const missed = useRef(false);
  const waiting = useRef(false);
  useEffect(() => {
    if (done && !practice) setPractice(nextRound(useGameStore.getState().progress.learning, recent.current));
  }, [done, practice]);
  const round = story ?? practice;

  const onHit = (index: number) => {
    const g = useGameStore.getState();
    const r = round;
    if (!r || waiting.current) return;
    const right = r.options[index] === r.answer;
    g.recordPractice(r.skill, right, right && !missed.current);
    if (!right) {
      missed.current = true;
      emit({ type: 'challenge', result: 'wrong', skill: r.skill });
      emit({ type: 'toast', icon: '💡', text: `Quase! ${r.hint}` });
      return;
    }
    emit({ type: 'challenge', result: 'correct', skill: r.skill, firstTry: !missed.current });
    missed.current = false;
    if (!done) {
      // story rounds
      g.bumpCounter('alvo_rodada', 1);
      const next = (g.progress.counters.alvo_rodada ?? 0) + 1;
      if (next >= ROUNDS.length) {
        g.runActions('FLAG:alvo_numeros;COINS:20;XP:20;GEMS:1;GIVE:pocao_energia:2;SFX:chest');
        emit({ type: 'toast', icon: '🎯', text: 'Mira de ninja! Você venceu o Alvo dos Números. Agora ele vira treino livre!' });
      } else {
        emit({ type: 'toast', icon: '🎯', text: `Acertou! ${r.question.replace('?', String(r.answer))}` });
      }
      return;
    }
    // free practice
    g.runActions('COINS:2;XP:3');
    g.bumpCounter('treino_acertos', 1);
    const total = (g.progress.counters.treino_acertos ?? 0) + 1;
    if (total % GEM_EVERY === 0) {
      g.addGems(1);
      emit({ type: 'toast', icon: '💎', text: `${total} acertos no treino! Uma Gema do Saber para você.` });
    } else {
      emit({ type: 'toast', icon: '🎯', text: `Acertou! ${r.question.replace('?', String(r.answer))}` });
    }
    // a short pause so the hit reads before the numbers change
    waiting.current = true;
    recent.current = [r.skill, ...recent.current].slice(0, 2);
    window.setTimeout(() => {
      waiting.current = false;
      setPractice(nextRound(useGameStore.getState().progress.learning, recent.current));
    }, 900);
  };

  const signLines = useMemo(() => {
    if (story) return [`Alvo dos Números · rodada ${roundIdx + 1}/3`, story.question, 'Acerte a resposta com a shuriken (1)'];
    if (practice) {
      const left = GEM_EVERY - (practiced % GEM_EVERY);
      return [`Treino livre · ${SKILLS[practice.skill].name}`, practice.question, `Mais ${left} ${left > 1 ? 'acertos' : 'acerto'} e você ganha uma gema`];
    }
    return ['Alvo dos Números', 'Mira de ninja!', 'Preparando o treino...'];
  }, [story, practice, roundIdx, practiced]);
  const sign = useMemo(() => signTexture(signLines), [signLines]);
  useEffect(() => () => sign.dispose(), [sign]);

  return (
    <group userData={{ dynamic: true }}>
      {[0, 1, 2].map((i) => (
        <Target key={i} index={i} round={round} done={done} onHit={onHit} />
      ))}
      <RigidBody type="fixed" colliders={false} position={[RANGE.sign.x, 0, RANGE.sign.z]}>
        <CuboidCollider args={[1.05, 1.4, 0.08]} position={[0, 1.4, 0]} />
        {[-0.95, 0.95].map((x) => (
          <mesh key={x} position={[x, 1.4, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, 2.8, 8]} />
            <Toon color="#7A5236" tex="bark" />
          </mesh>
        ))}
        <mesh position={[0, 2.35, 0.05]}>
          <planeGeometry args={[1.9, 0.95]} />
          <meshToonMaterial map={sign} gradientMap={getGradient()} side={THREE.DoubleSide} />
        </mesh>
      </RigidBody>
    </group>
  );
}
