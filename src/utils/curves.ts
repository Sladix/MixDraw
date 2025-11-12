import type { CurveType, BaseModifier } from '../types';

/**
 * Evaluate interpolation curve at position t
 * @param t - Position [0, 1]
 * @param curve - Curve type
 * @returns Interpolated value [0, 1]
 */
export function evaluateCurve(t: number, curve: CurveType): number {
  const clamped = Math.max(0, Math.min(1, t));

  switch (curve) {
    case 'linear':
      return clamped;

    case 'ease-in':
      // Quadratic ease-in: starts slow, ends fast
      return clamped * clamped;

    case 'ease-out':
      // Quadratic ease-out: starts fast, ends slow
      return 1 - (1 - clamped) * (1 - clamped);

    case 'ease-in-out':
      // Cubic ease-in-out: slow at both ends
      return clamped < 0.5
        ? 2 * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 2) / 2;

    case 'sine':
      // Sine wave: smooth oscillation from 0 to 1
      return Math.sin(clamped * Math.PI - Math.PI / 2) * 0.5 + 0.5;

    default:
      return clamped;
  }
}

/**
 * Apply modifier interpolation for a given t value
 * Handles t-range clamping and value interpolation
 *
 * @param t - Current position [0, 1]
 * @param modifier - Modifier config with tStart, tEnd, valueStart, valueEnd, curve
 * @returns Interpolated value
 */
export function applyModifierCurve(
  t: number,
  modifier: Pick<BaseModifier, 'tStart' | 'tEnd' | 'valueStart' | 'valueEnd' | 'curve'>
): number {
  // Outside modifier range - return boundary values
  if (t <= modifier.tStart) return modifier.valueStart;
  if (t >= modifier.tEnd) return modifier.valueEnd;

  // Normalize t to modifier range [0, 1]
  const normalizedT = (t - modifier.tStart) / (modifier.tEnd - modifier.tStart);

  // Apply curve to get interpolation factor
  const curveValue = evaluateCurve(normalizedT, modifier.curve);

  // Interpolate between start and end values
  return modifier.valueStart + (modifier.valueEnd - modifier.valueStart) * curveValue;
}

/**
 * Linearly interpolate between two values
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor [0, 1]
 * @returns Interpolated value
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
