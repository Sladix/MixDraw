import type { Keyframe, InterpolationType } from '../types';

/**
 * Linear interpolation between a and b
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Ease-in-out interpolation (cubic)
 */
export function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Sinusoidal interpolation (smooth start and end)
 */
export function sin(t: number): number {
  return (Math.sin((t - 0.5) * Math.PI) + 1) / 2;
}

/**
 * Apply interpolation function based on type
 */
export function applyInterpolation(t: number, type: InterpolationType): number {
  switch (type) {
    case 'linear':
      return t;
    case 'ease':
      return ease(t);
    case 'sin':
      return sin(t);
    default:
      return t;
  }
}

/**
 * Evaluate parameter value at position t using keyframes
 * If no keyframes or timeline disabled, returns defaultValue
 *
 * @param t - Position along path (0-1)
 * @param keyframes - Array of keyframes sorted by t
 * @param defaultValue - Fallback value if no keyframes
 * @returns Interpolated parameter value at position t
 */
export function evaluateTimeline(
  t: number,
  keyframes: Keyframe[],
  defaultValue: number
): number {
  // No keyframes - return default
  if (!keyframes || keyframes.length === 0) {
    return defaultValue;
  }

  // Single keyframe - return its value
  if (keyframes.length === 1) {
    return keyframes[0].value;
  }

  // Sort keyframes by t (in case they're not sorted)
  const sortedKeyframes = [...keyframes].sort((a, b) => a.t - b.t);

  // Before first keyframe - return first value
  if (t <= sortedKeyframes[0].t) {
    return sortedKeyframes[0].value;
  }

  // After last keyframe - return last value
  if (t >= sortedKeyframes[sortedKeyframes.length - 1].t) {
    return sortedKeyframes[sortedKeyframes.length - 1].value;
  }

  // Find the two keyframes to interpolate between
  for (let i = 0; i < sortedKeyframes.length - 1; i++) {
    const k1 = sortedKeyframes[i];
    const k2 = sortedKeyframes[i + 1];

    if (t >= k1.t && t <= k2.t) {
      // Calculate normalized t between these two keyframes
      const localT = (t - k1.t) / (k2.t - k1.t);

      // Apply interpolation curve from k1
      const interpolatedT = applyInterpolation(localT, k1.interpolation);

      // Lerp between values
      return lerp(k1.value, k2.value, interpolatedT);
    }
  }

  // Fallback (shouldn't reach here)
  return defaultValue;
}

/**
 * Get the timeline for a specific parameter name
 *
 * @param timelines - Array of timelines
 * @param paramName - Name of the parameter (e.g., 'density', 'spread')
 * @returns Timeline if found and enabled, null otherwise
 */
export function getActiveTimeline(
  timelines: any[] | undefined,
  paramName: string
): { keyframes: Keyframe[] } | null {
  if (!timelines || timelines.length === 0) return null;

  const timeline = timelines.find(
    (tl) => tl.paramName === paramName && tl.enabled
  );

  return timeline || null;
}

/**
 * Apply timeline to a parameter value
 * Returns timeline value if exists and enabled, otherwise returns original value
 *
 * @param t - Position along path (0-1)
 * @param paramName - Name of the parameter
 * @param originalValue - Original parameter value
 * @param timelines - Array of timelines
 * @returns Final parameter value (timeline or original)
 */
export function applyTimelineToParam(
  t: number,
  paramName: string,
  originalValue: number,
  timelines?: any[]
): number {
  const timeline = getActiveTimeline(timelines, paramName);

  if (!timeline) {
    return originalValue;
  }

  return evaluateTimeline(t, timeline.keyframes, originalValue);
}
