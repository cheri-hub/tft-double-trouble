/**
 * The priority list is a heat map of desire. Rank 1 glows hextech gold;
 * lower priorities cool toward slate. The rank number is always shown, so
 * colour is a reinforcing cue, never the only one.
 */
const HOT: [number, number, number] = [0xf0, 0xc9, 0x87]; // --color-gold
const COLD: [number, number, number] = [0x5c, 0x7a, 0x86]; // --color-cool

/**
 * @param index zero-based position in the list
 * @param total list length (defaults to the 10-entry cap)
 */
export function rankHeat(index: number, total = 10): string {
  const span = Math.max(1, Math.min(total, 10) - 1);
  const t = Math.min(1, Math.max(0, index / span));
  const channel = (from: number, to: number) => Math.round(from + (to - from) * t);
  return `rgb(${channel(HOT[0], COLD[0])}, ${channel(HOT[1], COLD[1])}, ${channel(HOT[2], COLD[2])})`;
}
