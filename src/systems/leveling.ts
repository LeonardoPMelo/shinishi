/** Each level needs 50 XP more than the previous one: 100, 250, 450, 700, 1000, 1350... */
export function xpToReach(level: number): number {
  let total = 0;
  for (let l = 2; l <= level; l++) total += 100 + 50 * (l - 2);
  return total;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpToReach(level + 1)) level++;
  return level;
}

/** Progress inside the current level, for the XP bar. */
export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const start = xpToReach(level);
  const span = xpToReach(level + 1) - start;
  return { level, current: xp - start, span };
}
