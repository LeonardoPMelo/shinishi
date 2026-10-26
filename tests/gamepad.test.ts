import { describe, expect, it } from 'vitest';
import { applyDeadzone, padStyle, pickInDirection, FACE_LABELS, type Box } from '../src/game/systems/gamepad';

/** Game controller support: stick feel, controller detection and moving between buttons on screen. */

describe('analógicos', () => {
  it('ignoram o desvio de repouso do analógico (zona morta)', () => {
    expect(applyDeadzone(0.1, -0.12)).toEqual([0, 0]);
  });

  it('começam suaves logo após a zona morta e chegam a 1 na borda', () => {
    const [x] = applyDeadzone(0.25, 0);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(0.1);
    const [ex, ey] = applyDeadzone(0, -1);
    expect(ex).toBeCloseTo(0);
    expect(ey).toBeCloseTo(-1);
  });

  it('mantêm a direção na diagonal', () => {
    const [x, y] = applyDeadzone(0.7, 0.7);
    expect(x).toBeCloseTo(y);
    expect(Math.hypot(x, y)).toBeLessThanOrEqual(1.0001);
  });
});

describe('modelo do controle', () => {
  it('reconhece PlayStation, Xbox e Nintendo pelo nome que o navegador informa', () => {
    expect(padStyle('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe('playstation');
    expect(padStyle('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)')).toBe('xbox');
    expect(padStyle('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')).toBe('nintendo');
    expect(padStyle('USB Gamepad (Vendor: 0079 Product: 0006)')).toBe('generic');
  });

  it('mostra o símbolo certo do botão de baixo (pular)', () => {
    expect(FACE_LABELS.playstation.bottom).toBe('✕');
    expect(FACE_LABELS.xbox.bottom).toBe('A');
    expect(FACE_LABELS.nintendo.bottom).toBe('B');
  });
});

describe('navegação nos menus', () => {
  // teclado numérico do desafio: 3 colunas
  const grid: Box[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) grid.push({ x: c * 60, y: r * 50, w: 50, h: 40 });
  const at = (r: number, c: number) => grid[r * 3 + c];
  const others = (b: Box) => grid.filter((g) => g !== b);

  it('anda pela grade como ela aparece na tela', () => {
    const from = at(1, 1);
    const pick = (dir: 'up' | 'down' | 'left' | 'right') => others(from)[pickInDirection(from, others(from), dir)];
    expect(pick('up')).toBe(at(0, 1));
    expect(pick('down')).toBe(at(2, 1));
    expect(pick('left')).toBe(at(1, 0));
    expect(pick('right')).toBe(at(1, 2));
  });

  it('não sai da tela quando não há nada naquela direção', () => {
    const from = at(0, 0);
    expect(pickInDirection(from, others(from), 'up')).toBe(-1);
    expect(pickInDirection(from, others(from), 'left')).toBe(-1);
  });

  it('numa lista de opções, desce para a próxima', () => {
    const list: Box[] = [0, 1, 2].map((i) => ({ x: 0, y: i * 48, w: 300, h: 40 }));
    expect(pickInDirection(list[0], list.slice(1), 'down')).toBe(0);
    expect(pickInDirection(list[2], list.slice(0, 2), 'up')).toBe(1);
  });
});
