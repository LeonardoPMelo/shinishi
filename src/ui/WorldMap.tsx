import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { MISSIONS } from '../data/missions';
import { NPC_DEFINITIONS, availableOffer } from '../data/npcs';
import { availableSteps, checkCondition } from '../systems/progression';
import { playerPosition, playerFacing } from '../game/systems/playerState';
import { MAP_BOUNDS, VILLAGE_RECT, MAP_EAST, MAP_WEST, MAP_SOUTH, MAP_BUILDINGS, MAP_LABELS, RIVER, GARDEN, PILLARS, TALL_ROCK, TEMPLE, GATE, stepTargetPosition } from './mapData';

interface Props {
  /** World units visible across the canvas; omit to fit the whole map. */
  window?: number;
  size: number;
  labels?: boolean;
  className?: string;
}

/** Top-down map drawn from world data. Used for both the minimap and the full map. */
export function WorldMap({ window: span, size, labels, className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const c = canvas.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (c.width !== size * dpr) {
        c.width = size * dpr;
        c.height = size * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const fullW = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
      const fullH = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ;
      const view = span ?? Math.max(fullW, fullH);
      const scale = size / view;
      const cx = span ? playerPosition.x : (MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2;
      const cz = span ? playerPosition.z : (MAP_BOUNDS.minZ + MAP_BOUNDS.maxZ) / 2;
      const X = (x: number) => size / 2 + (x - cx) * scale;
      const Z = (z: number) => size / 2 + (z - cz) * scale;

      ctx.fillStyle = '#8FC46A';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#7DB55C';
      ctx.fillRect(X(VILLAGE_RECT.minX), Z(VILLAGE_RECT.minZ), (VILLAGE_RECT.maxX - VILLAGE_RECT.minX) * scale, (VILLAGE_RECT.maxZ - VILLAGE_RECT.minZ) * scale);
      // Bairro das Glicínias: lawn, rocky ridge, tea terraces, pond, plaza and the gate in the village fence
      {
        const E = MAP_EAST;
        ctx.fillRect(X(E.gate.x), Z(E.fence.minZ), (E.fence.maxX - E.gate.x) * scale, (E.ridge[0].z0 - E.fence.minZ) * scale);
        ctx.fillStyle = '#948B7E';
        for (const r of E.ridge) ctx.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * scale, (E.ridgeZ1 - r.z0) * scale);
        E.tea.levels.forEach((lv, i) => {
          ctx.fillStyle = ['#7FAE5A', '#73A352', '#67984A'][i] ?? '#67984A';
          ctx.fillRect(X(E.tea.x0), Z(lv.z0), (E.tea.x1 - E.tea.x0) * scale, (E.tea.z1 - lv.z0) * scale);
        });
        ctx.fillStyle = '#5FB7E6';
        ctx.beginPath();
        ctx.ellipse(X(E.pond.x), Z(E.pond.z), E.pond.rx * scale, E.pond.rz * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#D9CDB4';
        ctx.beginPath();
        ctx.arc(X(E.plaza.x), Z(E.plaza.z), E.plaza.r * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9C7CC8';
        ctx.fillRect(X(E.gate.x) - 2, Z(E.gate.z - E.gate.halfWidth), 4, E.gate.halfWidth * 2 * scale);
      }
      // Bambuzal das Águas Quentes: bamboo green, the Jizō hill, the clearing and the hot spring
      {
        const W = MAP_WEST;
        ctx.fillStyle = '#7DB55C';
        ctx.fillRect(X(W.fence.minX), Z(W.fence.minZ), (W.gate.x - W.fence.minX) * scale, (W.fence.maxZ - W.fence.minZ) * scale);
        ctx.fillStyle = '#9CC85A';
        ctx.fillRect(X(-35), Z(-11.2), 14.6 * scale, 13.6 * scale);
        W.hill.levels.forEach((lv, i) => {
          ctx.fillStyle = ['#8FB86A', '#86AE60', '#7CA456'][i] ?? '#7CA456';
          ctx.fillRect(X(W.hill.x0), Z(W.hill.z0), (lv.x1 - W.hill.x0) * scale, (W.hill.z1 - W.hill.z0) * scale);
        });
        ctx.fillStyle = '#D9CDB4';
        ctx.beginPath();
        ctx.arc(X(W.clearing.x), Z(W.clearing.z), W.clearing.r * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8FD3D8';
        ctx.beginPath();
        ctx.ellipse(X(W.onsen.x), Z(W.onsen.z), W.onsen.rx * scale, W.onsen.rz * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4F7A8C';
        ctx.fillRect(X(W.gate.x) - 2, Z(W.gate.z - W.gate.halfWidth), 4, W.gate.halfWidth * 2 * scale);
      }
      // Bosque Antigo: dark forest floor, the stream, the mound, the meadow and the ledges
      {
        const S = MAP_SOUTH;
        ctx.fillStyle = '#4E8A44';
        ctx.fillRect(X(S.fence.minX), Z(40), (S.fence.maxX - S.fence.minX) * scale, (S.fence.maxZ - 40) * scale);
        ctx.fillStyle = '#7DB55C';
        ctx.beginPath();
        ctx.arc(X(S.meadow.x), Z(S.meadow.z), S.meadow.r * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5FB7E6';
        ctx.fillRect(X(S.fence.minX), Z(S.stream.z - S.stream.halfWidth), (S.fence.maxX - S.fence.minX) * scale, S.stream.halfWidth * 2 * scale);
        ctx.fillStyle = '#7A5A44';
        ctx.fillRect(X(S.log.x - 0.4), Z(S.log.z0), 0.8 * scale, (S.log.z1 - S.log.z0) * scale);
        ctx.fillStyle = '#86AE60';
        ctx.beginPath();
        ctx.arc(X(S.ancient.x), Z(S.ancient.z), S.ancient.mound * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6A4A3A';
        ctx.beginPath();
        ctx.arc(X(S.ancient.x), Z(S.ancient.z), S.ancient.trunk * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#948B7E';
        for (const l of S.ledges) {
          ctx.beginPath();
          ctx.arc(X(l.x), Z(l.z), l.r * scale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#3F6B4A';
        ctx.fillRect(X(S.gate.x - S.gate.halfWidth), Z(S.gate.z) - 2, S.gate.halfWidth * 2 * scale, 4);
      }

      ctx.fillStyle = '#6FA350';
      ctx.fillRect(X(-19), Z(26), 38 * scale, 13.5 * scale);
      // the temple courtyard (stone) and its gate in the north fence
      ctx.fillStyle = '#CFC4AE';
      ctx.fillRect(X(TEMPLE.minX), Z(TEMPLE.minZ), (TEMPLE.maxX - TEMPLE.minX) * scale, (TEMPLE.maxZ - TEMPLE.minZ) * scale);
      ctx.strokeStyle = '#8E8474';
      ctx.lineWidth = 2;
      ctx.strokeRect(X(TEMPLE.minX), Z(TEMPLE.minZ), (TEMPLE.maxX - TEMPLE.minX) * scale, (TEMPLE.maxZ - TEMPLE.minZ) * scale);
      ctx.fillStyle = '#C8463A';
      ctx.fillRect(X(GATE.x - GATE.halfWidth), Z(GATE.z) - 2, GATE.halfWidth * 2 * scale, 4);
      ctx.fillStyle = '#9AD07A';
      ctx.fillRect(X(GARDEN.minX), Z(GARDEN.minZ), (GARDEN.maxX - GARDEN.minX) * scale, (GARDEN.maxZ - GARDEN.minZ) * scale);

      ctx.fillStyle = '#5FB7E6';
      ctx.fillRect(X(-42), Z(RIVER.z - RIVER.halfWidth), 62 * scale, RIVER.halfWidth * 2 * scale);
      ctx.fillStyle = '#C8463A';
      ctx.fillRect(X(-RIVER.bridgeHalfWidth), Z(RIVER.z - RIVER.halfWidth - 0.4), RIVER.bridgeHalfWidth * 2 * scale, (RIVER.halfWidth * 2 + 0.8) * scale);

      ctx.fillStyle = '#D9CDB4';
      ctx.beginPath();
      ctx.arc(X(0), Z(0), 4.8 * scale, 0, Math.PI * 2);
      ctx.fill();

      for (const [x, z, w, d, rot, color] of MAP_BUILDINGS) {
        ctx.save();
        ctx.translate(X(x), Z(z));
        ctx.rotate(-rot);
        ctx.fillStyle = color;
        ctx.strokeStyle = '#2A2030';
        ctx.lineWidth = 1;
        ctx.fillRect((-w / 2) * scale, (-d / 2) * scale, w * scale, d * scale);
        ctx.strokeRect((-w / 2) * scale, (-d / 2) * scale, w * scale, d * scale);
        ctx.restore();
      }
      ctx.fillStyle = '#A39A8A';
      for (const p of PILLARS) {
        ctx.beginPath();
        ctx.arc(X(p.pos[0]), Z(p.pos[2]), 0.85 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(X(TALL_ROCK.pos[0]), Z(TALL_ROCK.pos[2]), TALL_ROCK.r * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#8E8173';
      ctx.fill();

      const s = useGameStore.getState();
      for (const npc of NPC_DEFINITIONS) {
        if (!checkCondition(npc.visibleWhen, s.progress)) continue;
        const offer = availableOffer(npc, s.progress);
        ctx.beginPath();
        ctx.arc(X(npc.position[0]), Z(npc.position[2]), offer ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = offer ? '#FFC93C' : '#FFF6E4';
        ctx.fill();
        ctx.strokeStyle = '#221A2C';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (labels) {
          ctx.font = 'bold 10px Nunito, sans-serif';
          ctx.fillStyle = '#221A2C';
          ctx.textAlign = 'center';
          ctx.fillText(npc.name, X(npc.position[0]), Z(npc.position[2]) - 7);
        }
      }

      const tracked = s.progress.tracked ? MISSIONS[s.progress.tracked] : null;
      if (tracked && s.progress.missions[tracked.id]?.status === 'active') {
        const t = performance.now() / 1000;
        for (const step of availableSteps(tracked, s.progress)) {
          const p = stepTargetPosition(step);
          if (!p) continue;
          ctx.beginPath();
          ctx.arc(X(p[0]), Z(p[2]), 7 + Math.sin(t * 4) * 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = '#3EA8E0';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.fillStyle = '#7FD3FF';
          ctx.beginPath();
          ctx.moveTo(X(p[0]), Z(p[2]) - 4);
          ctx.lineTo(X(p[0]) + 4, Z(p[2]));
          ctx.lineTo(X(p[0]), Z(p[2]) + 4);
          ctx.lineTo(X(p[0]) - 4, Z(p[2]));
          ctx.fill();
        }
      }

      if (labels) {
        ctx.font = '13px Bangers, Impact, sans-serif';
        ctx.textAlign = 'center';
        for (const l of MAP_LABELS) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#FFF6E4';
          ctx.strokeText(l.text, X(l.x), Z(l.z));
          ctx.fillStyle = '#221A2C';
          ctx.fillText(l.text, X(l.x), Z(l.z));
        }
      }

      // Player arrow.
      ctx.save();
      ctx.translate(X(playerPosition.x), Z(playerPosition.z));
      ctx.rotate(Math.PI - playerFacing.angle);
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fillStyle = '#F08A2C';
      ctx.fill();
      ctx.strokeStyle = '#221A2C';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      frame = window.setTimeout(() => requestAnimationFrame(draw), span ? 90 : 250) as unknown as number;
    };
    draw();
    return () => window.clearTimeout(frame);
  }, [size, span, labels]);

  return <canvas ref={canvas} className={className} style={{ width: size, height: size }} />;
}
