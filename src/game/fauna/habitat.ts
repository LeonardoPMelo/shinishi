import type { Flower } from './brains';

/**
 * Where the animals find things (Etapa 4). The foliage registers its flowers once they are scattered,
 * the butterflies read them. Plain module state: written once at load, read by the fauna each frame.
 */
export const habitat = {
  flowers: [] as Flower[],
  /** Bumped when the flowers change, so whoever cached a list rebuilds it. */
  version: 0,
};

export function setFlowers(list: Flower[]) {
  habitat.flowers = list;
  habitat.version++;
}
