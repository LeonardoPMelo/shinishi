import { TUNES } from '../data/wild2';

/**
 * The singing crystals' game (A Caverna da Névoa, after Etapa 10): the echo stone plays a tune, the cat plays it
 * back on the pillars. One wrong note and the round starts over (the tune stays the same: listen again); a whole
 * tune right moves on to the next, longer one; the last one opens the chamber. Plain logic, unit-tested.
 */

export interface TuneState {
  /** The tune being played back (index into TUNES). */
  round: number;
  /** The notes played so far in this round. */
  entered: number[];
  /** The echo stone is playing (touches don't count meanwhile). */
  playing: boolean;
}

export type TuneResult = 'progress' | 'wrong' | 'round' | 'done';

export function checkTune(state: Pick<TuneState, 'round' | 'entered'>, note: number, tunes: number[][] = TUNES): { result: TuneResult; round: number; entered: number[] } {
  const tune = tunes[state.round];
  const entered = [...state.entered, note];
  if (tune[entered.length - 1] !== note) return { result: 'wrong', round: state.round, entered: [] };
  if (entered.length < tune.length) return { result: 'progress', round: state.round, entered };
  if (state.round + 1 >= tunes.length) return { result: 'done', round: state.round + 1, entered: [] };
  return { result: 'round', round: state.round + 1, entered: [] };
}
