/**
 * "Put these in the right order" puzzles (Etapa 5 da expansão): the academy levers and the library books
 * in Mikage's residence. The player reads a few rules, then pulls the pieces one by one. The rules are data,
 * each with the sentence the player reads and a check the tests use to prove there is exactly one order that
 * satisfies all of them (no ambiguous puzzle ever ships: tests/academy.test.ts).
 */

export type OrderRule =
  | { kind: 'first'; a: string }
  | { kind: 'last'; a: string }
  | { kind: 'notFirst'; a: string }
  | { kind: 'notLast'; a: string }
  | { kind: 'at'; a: string; index: number }
  /** a somewhere before b */
  | { kind: 'before'; a: string; b: string }
  /** a right after b */
  | { kind: 'rightAfter'; a: string; b: string }
  /** a before b, but not right before it */
  | { kind: 'beforeNotNext'; a: string; b: string };

export interface OrderPuzzle {
  id: string;
  /** The pieces, in the order they stand in the room. */
  pieces: string[];
  rules: { text: string; rule: OrderRule }[];
}

export function ruleHolds(rule: OrderRule, order: string[]) {
  const i = (x: string) => order.indexOf(x);
  switch (rule.kind) {
    case 'first': return i(rule.a) === 0;
    case 'last': return i(rule.a) === order.length - 1;
    case 'notFirst': return i(rule.a) !== 0;
    case 'notLast': return i(rule.a) !== order.length - 1;
    case 'at': return i(rule.a) === rule.index;
    case 'before': return i(rule.a) < i(rule.b);
    case 'rightAfter': return i(rule.a) === i(rule.b) + 1;
    case 'beforeNotNext': return i(rule.a) < i(rule.b) - 1;
  }
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, k) => permutations([...items.slice(0, k), ...items.slice(k + 1)]).map((rest) => [x, ...rest]));
}

/** Every order that satisfies all the rules (a good puzzle has exactly one). */
export function solutions(p: OrderPuzzle): string[][] {
  return permutations(p.pieces).filter((order) => p.rules.every((r) => ruleHolds(r.rule, order)));
}

export type PressResult = 'progress' | 'wrong' | 'solved' | 'repeat';

/**
 * One pull. The pieces pulled so far are kept until the order is complete; then it is checked against the
 * rules (not against a stored answer, so the rules the player reads are the whole truth). A piece pulled twice
 * is ignored.
 */
export function press(p: OrderPuzzle, pulled: string[], piece: string): { pulled: string[]; result: PressResult; attempt: string[] } {
  if (!p.pieces.includes(piece) || pulled.includes(piece)) return { pulled, result: 'repeat', attempt: pulled };
  const next = [...pulled, piece];
  if (next.length < p.pieces.length) return { pulled: next, result: 'progress', attempt: next };
  return p.rules.every((r) => ruleHolds(r.rule, next))
    ? { pulled: next, result: 'solved', attempt: next }
    : { pulled: [], result: 'wrong', attempt: next };
}

/** After a wrong try: the first rule the attempt broke (gentle, specific help). */
export function brokenRule(p: OrderPuzzle, attempt: string[]) {
  return p.rules.find((r) => !ruleHolds(r.rule, attempt)) ?? null;
}
