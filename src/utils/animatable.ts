import type { AnimatableParameter, MinMaxValue, AnimatableMinMaxValue, Timeline } from '../types';
import { isAnyMinMaxValue, isAnimatableMinMaxValue } from '../types';
import { evaluateTimeline } from './interpolation';
import { getMinMaxValue as getRandomMinMaxValue } from './random';

/**
 * Evaluate an AnimatableParameter at position t
 * Handles static values, random ranges, and timeline-driven ranges
 *
 * @param value - The animatable parameter
 * @param t - Position along curve (0-1)
 * @param rng - Seeded random function
 * @param timelines - Available timelines (from FlowPath)
 * @returns Evaluated number value
 */
export function evaluateAnimatableParameter(
  value: AnimatableParameter,
  t: number,
  rng: () => number,
  timelines?: Timeline[]
): number {
  // Case 1: Static number
  if (typeof value === 'number') {
    return value;
  }

  // Case 2: MinMaxValue (random range)
  if (isAnyMinMaxValue(value)) {
    let min = value.min;
    let max = value.max;

    // Case 3: AnimatableMinMaxValue (timeline-driven range)
    if (isAnimatableMinMaxValue(value) && value.timelineId && timelines) {
      const timeline = timelines.find(tl => tl.id === value.timelineId);
      if (timeline && timeline.enabled) {
        // Timeline modulates the entire range
        // The timeline value represents the interpolation factor between min and max
        const timelineValue = evaluateTimeline(timeline, t);

        // Remap timeline value (typically 0-1) to the min-max range
        // This allows the timeline to dynamically control the range bounds
        const range = max - min;
        const center = min + range / 2;
        const halfRange = range / 2;

        // Scale the range based on timeline value (1.0 = full range, 0.0 = collapsed to center)
        min = center - halfRange * timelineValue;
        max = center + halfRange * timelineValue;
      }
    }

    // Return random value within (possibly modulated) range
    return getRandomMinMaxValue({ min, max }, rng);
  }

  // Fallback
  return 0;
}

/**
 * Evaluate all animatable parameters in an object
 * Recursively processes all parameters and returns evaluated values
 *
 * @param params - Object containing parameters
 * @param t - Position along curve (0-1)
 * @param rng - Seeded random function
 * @param timelines - Available timelines
 * @param paramPrefix - Optional prefix for parameter names (e.g., "gen.abc123")
 * @returns Object with evaluated parameters
 */
export function evaluateAnimatableParams(
  params: Record<string, any>,
  t: number,
  rng: () => number,
  timelines?: Timeline[],
  paramPrefix?: string
): Record<string, any> {
  const evaluated: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    // Build the full parameter name (e.g., "gen.abc123.size")
    const fullParamName = paramPrefix ? `${paramPrefix}.${key}` : key;

    // Check if value is animatable
    if (typeof value === 'number' || isAnyMinMaxValue(value)) {
      // Check if there's a timeline for this parameter by name
      const paramTimeline = timelines?.find(tl => tl.paramName === fullParamName && tl.enabled);

      if (paramTimeline && isAnyMinMaxValue(value)) {
        // Timeline found - use it to directly set the value
        // The timeline keyframes define the actual parameter value at each position
        // For MinMax parameters, we still apply randomness but use the timeline value as the center
        const timelineValue = evaluateTimeline(t, paramTimeline.keyframes, (value.min + value.max) / 2);

        // Add some controlled randomness around the timeline value
        // Use a small percentage of the original range for variation
        const originalRange = value.max - value.min;
        const variationAmount = originalRange * 0.1; // 10% variation

        evaluated[key] = getRandomMinMaxValue(
          { min: timelineValue - variationAmount, max: timelineValue + variationAmount },
          rng
        );
      } else {
        // No timeline - evaluate normally
        evaluated[key] = evaluateAnimatableParameter(value, t, rng, timelines);
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively evaluate nested objects
      evaluated[key] = evaluateAnimatableParams(value, t, rng, timelines, fullParamName);
    } else {
      // Pass through non-animatable values
      evaluated[key] = value;
    }
  }

  return evaluated;
}
