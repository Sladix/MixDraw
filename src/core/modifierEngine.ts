import type { AnyModifier, GeneratorConfig } from '../types';
import { applyModifierCurve } from '../utils/curves';

/**
 * Calculate size multiplier at position t by composing all enabled size modifiers
 * Multiple size modifiers multiply together
 *
 * @param t - Position along curve [0, 1]
 * @param modifiers - Array of modifiers
 * @returns Size multiplier (1.0 = normal size)
 */
export function calculateSizeMultiplier(t: number, modifiers: AnyModifier[]): number {
  let multiplier = 1.0;

  modifiers
    .filter((m) => m.type === 'size' && m.enabled)
    .forEach((mod) => {
      const value = applyModifierCurve(t, mod);
      multiplier *= value;
    });

  return multiplier;
}

/**
 * Calculate rotation offset at position t by summing all enabled rotation modifiers
 * Multiple rotation modifiers add together
 *
 * @param t - Position along curve [0, 1]
 * @param modifiers - Array of modifiers
 * @returns Rotation offset in degrees
 */
export function calculateRotationOffset(t: number, modifiers: AnyModifier[]): number {
  let rotation = 0;

  modifiers
    .filter((m) => m.type === 'rotation' && m.enabled)
    .forEach((mod) => {
      const value = applyModifierCurve(t, mod);
      rotation += value;
    });

  return rotation;
}

/**
 * Calculate spacing multiplier at position t by composing all enabled spacing modifiers
 * Multiple spacing modifiers multiply together
 *
 * @param t - Position along curve [0, 1]
 * @param modifiers - Array of modifiers
 * @returns Spacing multiplier (1.0 = normal spacing)
 */
export function calculateSpacingMultiplier(t: number, modifiers: AnyModifier[]): number {
  let multiplier = 1.0;

  modifiers
    .filter((m) => m.type === 'spacing' && m.enabled)
    .forEach((mod) => {
      const value = applyModifierCurve(t, mod);
      multiplier *= value;
    });

  return multiplier;
}

/**
 * Calculate spread width at position t by composing all enabled spread modifiers
 * Spread modifiers override base spread value (they don't multiply)
 * Later modifiers override earlier ones if ranges overlap
 *
 * @param t - Position along curve [0, 1]
 * @param modifiers - Array of modifiers
 * @param baseSpread - Base spread width in mm
 * @returns Spread width in mm
 */
export function calculateSpreadWidth(
  t: number,
  modifiers: AnyModifier[],
  baseSpread: number
): number {
  let spread = baseSpread;

  modifiers
    .filter((m) => m.type === 'spread' && m.enabled)
    .forEach((mod) => {
      const value = applyModifierCurve(t, mod);
      // Spread modifiers override, they don't multiply
      spread = value;
    });

  return spread;
}

/**
 * Calculate average generator output size in millimeters
 * Used for visual density calculations
 *
 * Assumes generators have sizeMin/sizeMax parameters
 * Falls back to 5mm default if no generators or no size params
 *
 * @param generators - Array of generator configs
 * @returns Average size in mm
 */
export function calculateAverageGeneratorSize(generators: GeneratorConfig[]): number {
  if (generators.length === 0) return 5; // Default 5mm

  const totalAvg = generators.reduce((sum, gen) => {
    const params = gen.params;

    // Assume all generators have sizeMin/sizeMax params
    // This is a safe assumption for our built-in generators
    if (params.sizeMin !== undefined && params.sizeMax !== undefined) {
      const avgSize = (params.sizeMin + params.sizeMax) / 2;
      return sum + avgSize;
    }

    // Fallback if generator doesn't have size params
    return sum + 5; // 5mm fallback
  }, 0);

  return totalAvg / generators.length;
}
