import seedrandom from 'seedrandom';
import type { MinMaxValue } from '../types';
import { isMinMaxValue } from '../types';

/**
 * Creates a seeded random number generator
 * @param seed - Seed value
 * @returns Function that returns random number [0, 1)
 */
export function seededRandom(seed: number): () => number {
  const rng = seedrandom(seed.toString());
  return () => rng();
}

/**
 * Linear interpolation between two values
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor [0, 1]
 * @returns Interpolated value
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp a value between min and max
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Weighted random choice from an array
 * @param items - Array of items with weight property
 * @param seed - Seed for random number generator
 * @returns Selected item
 */
export function weightedRandomChoice<T extends { weight: number }>(
  items: T[],
  seed: number
): T {
  if (items.length === 0) {
    throw new Error('Cannot choose from empty array');
  }

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const rng = seededRandom(seed);
  let random = rng() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

/**
 * Map a value from one range to another
 * @param value - Input value
 * @param inMin - Input range minimum
 * @param inMax - Input range maximum
 * @param outMin - Output range minimum
 * @param outMax - Output range maximum
 * @returns Mapped value
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Extracts a random value from a MinMaxValue range or returns the number directly
 * @param value - MinMaxValue object or number
 * @param rng - Random number generator function
 * @returns Random number within the range
 */
export function getMinMaxValue(
  value: MinMaxValue | number,
  rng: () => number
): number {
  if (isMinMaxValue(value)) {
    return lerp(value.min, value.max, rng());
  }
  return value;
}
