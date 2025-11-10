import { createNoise2D } from 'simplex-noise';
import { seededRandom, clamp } from '../utils/random';
import type { DistributionParams } from '../types';
import { pxToMm } from '../types/formats';

/**
 * Generate t values (normalized positions [0, 1]) along a curve based on distribution mode
 * @param params - Distribution parameters (density is in shapes per mm)
 * @param curveLength - Length of the curve in pixels
 * @param generatorCount - Number of generators attached (defaults to 1)
 * @returns Array of t values [0, 1]
 */
export function generateTValues(
  params: DistributionParams,
  curveLength: number,
  generatorCount: number = 1
): number[] {
  // Convert curve length from pixels to mm, then multiply by density (total shapes per mm)
  // Divide by generator count so that total output matches density setting
  const curveLengthMm = pxToMm(curveLength);
  const effectiveDensity = params.density / Math.max(1, generatorCount);
  const count = Math.max(1, Math.floor(curveLengthMm * effectiveDensity));

  switch (params.mode) {
    case 'linear':
      return generateLinearDistribution(count);

    case 'noise':
      return generateNoiseDistribution(
        count,
        params.seed,
        params.spacing,
        params.noiseScale || 0.3,
        params.noiseStrength || 1.0,
        params.noiseThreshold
      );

    case 'random':
      return generateRandomDistribution(count, params.seed);

    case 'custom':
      // For future custom distribution functions
      return generateLinearDistribution(count);

    default:
      return generateLinearDistribution(count);
  }
}

/**
 * Generate evenly spaced t values
 * @param count - Number of points
 * @returns Array of t values
 */
function generateLinearDistribution(count: number): number[] {
  if (count === 1) return [0.5];
  return Array.from({ length: count }, (_, i) => i / (count - 1));
}

/**
 * Generate t values with Perlin noise for organic distribution
 * @param count - Number of points
 * @param seed - Random seed
 * @param spacing - [min, max] spacing multiplier
 * @param noiseScale - Frequency of noise (lower = smoother, higher = more chaotic)
 * @param noiseStrength - How much noise affects distribution (0 = linear, 1 = full effect)
 * @param noiseThreshold - Optional threshold for spawning shapes (0-1), creates clusters
 * @returns Array of t values
 */
function generateNoiseDistribution(
  count: number,
  seed: number,
  spacing: [number, number],
  noiseScale: number = 0.3,
  noiseStrength: number = 1.0,
  noiseThreshold?: number
): number[] {
  const noise2D = createNoise2D(() => seed);
  const [minSpacing, maxSpacing] = spacing;

  const tValues: number[] = [];
  let currentT = 0;

  for (let i = 0; i < count; i++) {
    // Use noise to determine spacing with configurable scale
    const noiseValue = noise2D(i * noiseScale, seed);
    const normalizedNoise = (noiseValue + 1) / 2; // Convert from [-1, 1] to [0, 1]

    // If threshold is set, check if shape should spawn
    if (noiseThreshold !== undefined) {
      // Use a separate noise sample for spawn decision to avoid correlation
      const spawnNoise = noise2D(i * noiseScale, seed + 1000);
      const spawnValue = (spawnNoise + 1) / 2; // Convert to [0, 1]

      // Skip this shape if below threshold
      if (spawnValue < noiseThreshold) {
        // Still advance position to maintain spacing
        const effectiveNoise = 0.5 + (normalizedNoise - 0.5) * noiseStrength;
        const spacingMultiplier = minSpacing + effectiveNoise * (maxSpacing - minSpacing);
        const baseSpacing = 1 / (count - 1);
        const spacing = baseSpacing * spacingMultiplier;
        currentT += spacing;
        continue;
      }
    }

    // Apply noise strength (lerp between 0.5 and noise value)
    const effectiveNoise = 0.5 + (normalizedNoise - 0.5) * noiseStrength;

    // Calculate spacing based on noise
    const spacingMultiplier =
      minSpacing + effectiveNoise * (maxSpacing - minSpacing);
    const baseSpacing = 1 / (count - 1);
    const spacing = baseSpacing * spacingMultiplier;

    currentT += spacing;
    tValues.push(clamp(currentT, 0, 1));

    if (currentT >= 1) break;
  }

  // Normalize to fill the entire curve
  if (tValues.length > 0) {
    const maxT = tValues[tValues.length - 1];
    if (maxT > 0) {
      return tValues.map((t) => t / maxT);
    }
  }

  return tValues;
}

/**
 * Generate randomly distributed t values
 * @param count - Number of points
 * @param seed - Random seed
 * @returns Array of sorted t values
 */
function generateRandomDistribution(count: number, seed: number): number[] {
  const rng = seededRandom(seed);
  return Array.from({ length: count }, () => rng()).sort();
}

/**
 * Apply spacing constraints to t values
 * @param tValues - Original t values
 * @param minSpacing - Minimum spacing between points (normalized)
 * @returns Adjusted t values
 */
export function applySpacingConstraints(
  tValues: number[],
  minSpacing: number
): number[] {
  if (tValues.length <= 1) return tValues;

  const result: number[] = [tValues[0]];

  for (let i = 1; i < tValues.length; i++) {
    const prevT = result[result.length - 1];
    const currentT = tValues[i];

    if (currentT - prevT >= minSpacing) {
      result.push(currentT);
    }
  }

  return result;
}
