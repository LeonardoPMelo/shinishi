import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { create } from 'zustand';
import { Toon, Ink } from '../materials';
import { useGameStore } from '../../store/gameStore';
import { emit } from '../../systems/events';
import { playerPosition, playerBody, playerGround, playerMotion, now } from '../systems/playerState';
import { INTERIORS_BY_ID, toWorld } from '../../data/interiors';
import { CIRCUIT, NIGHTINGALE, LEVER_ROUNDS, LEVER_SOLVED, LEVER_SPOTS, LEVER_SYMBOLS, CIRCUIT_DONE } from '../../data/academy';
import { circuitTick, startRun, idleRun, floorTick, quietFloor, type CircuitRun } from '../../systems/academy';
import { press, brokenRule } from '../../systems/orderPuzzle';
import { isStepAvailable } from '../../systems/progression';
import { MISSIONS } from '../../data/missions';
import { useSpot, useTraining, useIconTexture } from '../systems/training';
import { Box, Blocker, DARK, GOLD } from './interiorParts';

/**
 * The academy's body tests and the lever puzzle (Etapa 5 da expansão). Rules in systems/academy.ts and
 * systems/orderPuzzle.ts; this file only reads the cat, draws, and reports. Everything runs only while the cat
 * is inside the academy (`active`).
 */

const A = INTERIORS_BY_ID.academia;
/** Height of the cat's body centre above its feet (Shinichi.tsx FOOT). */
const FOOT = 0.68;
const toast = (icon: string, text: string) => emit({ type: 'toast', icon, text });
const local = () => ({ x: playerPosition.x - A.origin[0], z: playerPosition.z - A.origin[1] });

// ── Circuito das Patas ────────────────────────────────────────────────────────
function Circuit({ active }: { active: boolean }) {
  const run = useRef<CircuitRun>(idleRun());
  const [next, setNext] = useState(-1);
  const setHud = useTraining((s) => s.set);

  const begin = () => {
    run.current = startRun(now());
    setNext(0);
    setHud({ startedAt: run.current.startedAt, label: `Ponto 1 de ${CIRCUIT.checkpoints.length}: ${CIRCUIT.checkpoints[0].name}` });
    emit({ type: 'sfx', name: 'temple_bell' });
    toast('🏃', 'Valendo! Plataforma baixa, média, viga, degraus, plataforma alta e de volta ao tapete.');
  };
  const stop = () => {
    run.current = idleRun();
    setNext(-1);
    setHud({ startedAt: null, label: '' });
  };

  const [sx, , sz] = toWorld(A, 3.1, 5.0);
  useSpot('circuito_largada', [sx, 0, sz], 1.5, () => (run.current.running ? 'Recomeçar o circuito' : 'Começar o Circuito das Patas'), begin, 2.0);

  useFrame(() => {
    if (!run.current.running) return;
    if (!active) {
      stop();
      return;
    }
    const { x, z } = local();
    const { run: r, event } = circuitTick(CIRCUIT, run.current, x, playerPosition.y - FOOT, z, now());
    run.current = r;
    if (!event) return;
    if (event.kind === 'abort') {
      stop();
      toast('⏱️', 'Saiu da área do circuito: o tempo foi zerado. É só começar de novo na lanterna.');
    } else if (event.kind === 'checkpoint') {
      const n = event.index + 1;
      setNext(n);
      setHud({ label: `Ponto ${n + 1} de ${CIRCUIT.checkpoints.length}: ${CIRCUIT.checkpoints[n].name}` });
      emit({ type: 'sfx', name: 'chime' });
    } else {
      stop();
      const st = useGameStore.getState();
      const medal = { ouro: '🥇 ouro', prata: '🥈 prata', bronze: '🥉 bronze' }[event.medal];
      const best = st.progress.counters.circuito_recorde ?? 0;
      const tenths = Math.round(event.seconds * 10);
      const record = best === 0 || tenths < best;
      if (record) st.bumpCounter('circuito_recorde', tenths - best);
      emit({ type: 'sfx', name: event.medal === 'ouro' ? 'fireworks' : 'gem' });
      toast('🏁', `${event.seconds.toFixed(1)} s, medalha de ${medal}!${record && best ? ' Novo recorde!' : ''}${event.medal === 'bronze' ? ` Até ${CIRCUIT.medals.prata} s é prata.` : event.medal === 'prata' ? ` Até ${CIRCUIT.medals.ouro} s é ouro.` : ''}`);
      if (MISSIONS.academia && st.progress.missions.academia?.status === 'active' && isStepAvailable(MISSIONS.academia, 'circuito', st.progress)) {
        st.runActions(CIRCUIT_DONE);
      }
    }
  });

  return (
    <group position={[A.origin[0], 0, A.origin[1]]} visible={active}>
      {/* start mat and its lantern */}
      <mesh position={[CIRCUIT.start.at[0], 0.015, CIRCUIT.start.at[1]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.6, 1.2]} />
        <Toon color="#C0573E" />
      </mesh>
      <mesh position={[CIRCUIT.start.at[0], 0.018, CIRCUIT.start.at[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.3, 0.12]} />
        <Toon color="#FFF4E0" />
      </mesh>
      <group position={[3.1, 0, 5.0]}>
        <Box size={[0.14, 1.5, 0.14]} at={[0, 0.75, 0]} color={DARK} tex="wood" />
        <mesh position={[0, 1.65, 0]}>
          <sphereGeometry args={[0.18, 12, 10]} />
          <Toon color="#FFB347" emissive="#FF9A2E" emissiveIntensity={next >= 0 ? 1.6 : 0.6} />
        </mesh>
      </group>
      {/* a lantern over each checkpoint: gold = next, green = done */}
      {CIRCUIT.checkpoints.slice(0, -1).flatMap((cp, i) =>
        cp.options.map((o, k) => {
          const color = next > i ? '#6FCF6A' : next === i ? GOLD : '#9C8F82';
          return (
            <mesh key={`${i}-${k}`} position={[o.at[0], o.minY + 1.15, o.at[1]]}>
              <octahedronGeometry args={[0.16, 0]} />
              <Toon color={color} emissive={color} emissiveIntensity={next === i ? 1.4 : next > i ? 0.6 : 0.1} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

// ── Corredor do Rouxinol ──────────────────────────────────────────────────────
/**
 * A nightingale floor (shared with the reserved room of Mikage's residence). `rect` and `back` are room
 * coordinates of `room`.
 */
export function NightingaleFloor({ active, origin, rect, back, onCaught }: {
  active: boolean;
  origin: [number, number];
  rect: [number, number, number, number];
  back: [number, number];
  onCaught: () => void;
}) {
  const state = useRef(quietFloor());
  const last = useRef<{ x: number; z: number } | null>(null);
  useFrame(() => {
    if (!active) {
      last.current = null;
      state.current = quietFloor();
      return;
    }
    const x = playerPosition.x - origin[0];
    const z = playerPosition.z - origin[1];
    const moved = last.current ? Math.hypot(x - last.current.x, z - last.current.z) : 0;
    last.current = { x, z };
    const on = x >= rect[0] && x <= rect[2] && z >= rect[1] && z <= rect[3];
    if (!on && state.current.squeaks > 0 && (x < rect[0] - 1.5 || x > rect[2] + 1.5 || z < rect[1] - 1.5 || z > rect[3] + 1.5)) {
      // walked away from the boards: they quiet down
      state.current = quietFloor();
    }
    const r = floorTick(state.current, on, playerGround.grounded, playerMotion.crouch, moved);
    state.current = r.state;
    if (r.squeak) {
      emit({ type: 'sfx', name: 'bird', position: [playerPosition.x, 0.2, playerPosition.z] });
      if (!r.caught) toast('🐦', 'Piu! A tábua cantou. Mais um e alguém ouve. Agache (C, LT ou 🐾) para pisar em silêncio.');
    }
    if (r.caught) {
      state.current = quietFloor();
      last.current = null;
      const b = playerBody.current;
      if (b) {
        b.setTranslation({ x: origin[0] + back[0], y: 0.9, z: origin[1] + back[1] }, true);
        b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
      emit({ type: 'sfx', name: 'denied' });
      onCaught();
    }
  });
  return null;
}

// ── Sala da Lógica: the levers ────────────────────────────────────────────────
interface LeverState { pulled: string[]; round: number; set: (p: Partial<Omit<LeverState, 'set'>>) => void }
const useLevers = create<LeverState>((set) => ({ pulled: [], round: -2, set: (p) => set(p) }));

/** Which round is on: 0, 1, or 2 = free practice after both are solved. */
function currentRound() {
  const f = useGameStore.getState().progress.flags;
  return !f.alavancas_1 ? 0 : !f.alavancas_2 ? 1 : 2;
}
function enrolled() {
  const p = useGameStore.getState().progress;
  return p.missions.academia?.status === 'done' || !!p.missions.academia?.steps.includes('matricula');
}

function Lever({ piece }: { piece: string }) {
  const sym = LEVER_SYMBOLS[piece];
  const tex = useIconTexture(sym.icon);
  const pulled = useLevers((s) => s.pulled.includes(piece));
  const [lx, lz] = LEVER_SPOTS[piece];
  const [wx, , wz] = toWorld(A, lx, lz);

  const pull = () => {
    if (!enrolled()) {
      toast('📝', 'Esta prova é dos alunos da Academia. Matricule-se com a Professora Sumi, na Sala dos Números.');
      return;
    }
    const round = currentRound();
    const puzzle = LEVER_ROUNDS[Math.min(round, 1)];
    const st = useLevers.getState();
    const pulledNow = st.round === round ? st.pulled : [];
    if (!puzzle.pieces.includes(piece)) {
      toast(sym.icon, `A alavanca ${sym.name} só entra na rodada 2.`);
      return;
    }
    const r = press(puzzle, pulledNow, piece);
    if (r.result === 'repeat') return;
    if (r.result === 'progress') {
      emit({ type: 'sfx', name: 'thwack' });
      useLevers.getState().set({ pulled: r.pulled, round });
      toast('🔧', `Puxadas: ${r.pulled.map((x) => LEVER_SYMBOLS[x].icon).join(' → ')}`);
      return;
    }
    if (r.result === 'wrong') {
      const broke = brokenRule(puzzle, r.attempt);
      emit({ type: 'sfx', name: 'challenge_wrong' });
      useGameStore.getState().recordPractice('logica', false);
      useLevers.getState().set({ pulled: [], round });
      toast('🤔', `Não abriu. Esta pista não bateu: "${broke?.text ?? ''}" As alavancas voltaram para cima.`);
      return;
    }
    // solved
    useLevers.getState().set({ pulled: r.pulled, round });
    if (round < 2) {
      useGameStore.getState().runActions(LEVER_SOLVED[round]);
      toast('✨', round === 0 ? 'Clique! Rodada 1 resolvida. Leia as novas pistas no quadro para a rodada 2.' : 'CLIQUE! A última trava abriu: Selo da Lógica!');
    } else {
      emit({ type: 'sfx', name: 'mechanism' });
      toast('✨', 'Certo de novo! (Treino livre: a ordem é sempre a única que obedece a todas as pistas.)');
    }
    window.setTimeout(() => useLevers.getState().set({ pulled: [] }), 1400);
  };

  useSpot(`alavanca_${piece}`, [wx, 0, wz], 0.95, () => {
    if (useLevers.getState().pulled.includes(piece) && useLevers.getState().round === currentRound()) return null;
    return `${sym.icon} Puxar a alavanca: ${sym.name}`;
  }, pull, 1.9);

  return (
    <group position={[lx, 0, lz]}>
      <Blocker size={[0.5, 1.3, 0.3]} at={[0, 0.65, 0]} />
      <Box size={[0.5, 0.3, 0.3]} at={[0, 0.15, 0]} color="#7E6A5A" tex="stone" />
      <Box size={[0.12, 1.0, 0.12]} at={[0, 0.8, -0.05]} color={DARK} tex="wood" />
      {/* the handle: up, or down once pulled */}
      <group position={[0, 1.2, 0.02]} rotation={[pulled ? 1.0 : -0.5, 0, 0]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.5, 8]} />
          <Toon color="#8D939C" />
        </mesh>
        <mesh position={[0, 0.52, 0]} castShadow>
          <sphereGeometry args={[0.08, 10, 8]} />
          <Toon color="#C0573E" />
          <Ink thickness={0.01} />
        </mesh>
      </group>
      <mesh position={[0, 1.55, 0.03]}>
        <circleGeometry args={[0.22, 24]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function AcademyActivities({ active }: { active: boolean }) {
  return (
    <>
      <Circuit active={active} />
      <NightingaleFloor
        active={active}
        origin={A.origin}
        rect={NIGHTINGALE.rect}
        back={NIGHTINGALE.back}
        onCaught={() => toast('📣', '"Ouvi você!", grita o Professor Haru. "De volta ao começo! Agachado, as tábuas nem percebem."')}
      />
      <group position={[A.origin[0], 0, A.origin[1]]} visible={active}>
        {Object.keys(LEVER_SPOTS).map((p) => <Lever key={p} piece={p} />)}
      </group>
    </>
  );
}
