import { createNoise2D } from 'simplex-noise';
import { seededRandom, clamp } from '../utils/random';
import type { DistributionParams, GeneratorConfig, AnyModifier } from '../types';
import { pxToMm, mmToPx } from '../types/formats';
import {
  calculateAverageGeneratorSize,
  calculateSizeMultiplier,
  calculateSpacingMultiplier,
} from './modifierEngine';
import { SpatialGrid, getPackingTolerance, type PlacedShape } from './packing';
import paper from 'paper';

/**
 * Generate t values (normalized positions [0, 1]) along a curve based on distribution mode
 * @param params - Distribution parameters (density is in shapes per mm)
 * @param curve - Paper.js path curve for actual position calculation
 * @param generatorCount - Number of generators attached (defaults to 1)
 * @param generators - Generator configs (for visual density calculation)
 * @param modifiers - Modifiers (for visual density calculation)
 * @returns Array of t values [0, 1]
 */
export function generateTValues(
  params: DistributionParams,
  curve: paper.Path,
  generatorCount: number = 1,
  generators: GeneratorConfig[] = [],
  modifiers: AnyModifier[] = []
): number[] {
  const curveLength = curve.length;
  const curveLengthMm = pxToMm(curveLength);

  // Check if visual density mode is enabled
  if (params.densityMode === 'visual' && generators.length > 0) {
    return generateVisualDensityTValues(params, curve, generators, modifiers);
  }

  // Fixed count mode (original behavior)
  const effectiveDensity = params.density / Math.max(1, generatorCount);
  const count = Math.max(1, Math.floor(curveLengthMm * effectiveDensity));

  return generateTValuesForMode(params, count);
}

/**
 * Generate t-values using the selected distribution mode
 */
function generateTValuesForMode(params: DistributionParams, count: number): number[] {
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
 * Generate t-values with visual density compensation and collision detection
 *
 * NEW ALGORITHM:
 * 1. Generate dense candidate t-values (3x density for good coverage)
 * 2. For each candidate, check collision with already-placed shapes using actual curve positions
 * 3. Keep or discard based on packing mode tolerance
 * 4. Uses spatial grid for O(n log n) performance instead of O(n²)
 *
 * @param params - Distribution parameters
 * @param curve - Paper.js path for actual position calculation
 * @param generators - Generator configs
 * @param modifiers - Active modifiers
 * @returns Filtered t-values that respect packing constraints
 */
function generateVisualDensityTValues(
  params: DistributionParams,
  curve: paper.Path,
  generators: GeneratorConfig[],
  modifiers: AnyModifier[]
): number[] {
  const curveLength = curve.length;
  const curveLengthMm = pxToMm(curveLength);
  const avgGeneratorSizeMm = calculateAverageGeneratorSize(generators);
  const packingMode = params.packingMode || 'normal';
  const tolerance = getPackingTolerance(packingMode);

  console.log(
    `🎯 Visual density with packing: avgSize=${avgGeneratorSizeMm.toFixed(2)}mm, density=${params.density}, curveLength=${curveLengthMm.toFixed(2)}mm, packingMode=${packingMode}, tolerance=${tolerance}`
  );

  // If overlap is allowed, use old simple algorithm
  if (packingMode === 'allow-overlap') {
    return generateVisualDensityTValuesSimple(params, curveLengthMm, generators, modifiers);
  }

  // STEP 1: Generate dense candidate t-values (3x target density for good coverage)
  const candidateDensity = params.density * 3;
  const candidateCount = Math.max(10, Math.floor(curveLengthMm * candidateDensity));
  const candidateTValues = generateTValuesForMode(
    { ...params, density: candidateDensity },
    candidateCount
  );

  console.log(`  Generated ${candidateTValues.length} candidate t-values`);

  // STEP 2: Greedy packing - test each candidate for collision
  const spatialGrid = new SpatialGrid(mmToPx(avgGeneratorSizeMm * 2)); // Cell size = 2x avg shape size
  const acceptedTValues: number[] = [];

  for (const t of candidateTValues) {
    // Calculate effective size at this t position
    const sizeMultiplier = calculateSizeMultiplier(t, modifiers);
    const effectiveSizeMm = avgGeneratorSizeMm * sizeMultiplier;
    const effectiveSizePx = mmToPx(effectiveSizeMm);

    // Get actual position on curve
    const offset = t * curveLength;
    const position = curve.getPointAt(offset);

    // Create approximate bounding box at actual curve position
    // Note: This is an approximation - actual shape bounds depend on generator output
    // We use a square centered at the curve position for collision detection
    const halfSize = effectiveSizePx / 2;
    const approxBounds = new paper.Rectangle(
      position.x - halfSize,
      position.y - halfSize,
      effectiveSizePx,
      effectiveSizePx
    );

    // Check collision with existing shapes
    let hasCollision = false;
    if (acceptedTValues.length > 0) {
      const nearbyRects = spatialGrid.getNearby(approxBounds);

      for (const nearbyRect of nearbyRects) {
        // Check intersection with tolerance
        if (tolerance === 0) {
          if (approxBounds.intersects(nearbyRect)) {
            hasCollision = true;
            break;
          }
        } else {
          // Allow some overlap based on tolerance
          const shrinkAmount = Math.min(effectiveSizePx, nearbyRect.width) * tolerance * 0.5;
          const shrunkNew = new paper.Rectangle(approxBounds);
          shrunkNew.left += shrinkAmount;
          shrunkNew.top += shrinkAmount;
          shrunkNew.right -= shrinkAmount;
          shrunkNew.bottom -= shrinkAmount;

          const shrunkExisting = new paper.Rectangle(nearbyRect);
          shrunkExisting.left += shrinkAmount;
          shrunkExisting.top += shrinkAmount;
          shrunkExisting.right -= shrinkAmount;
          shrunkExisting.bottom -= shrinkAmount;

          if (shrunkNew.intersects(shrunkExisting)) {
            hasCollision = true;
            break;
          }
        }
      }
    }

    // Accept this position if no collision
    if (!hasCollision) {
      acceptedTValues.push(t);
      spatialGrid.add(approxBounds);
    }
  }

  console.log(
    `✅ Accepted ${acceptedTValues.length}/${candidateTValues.length} shapes (${((acceptedTValues.length / candidateTValues.length) * 100).toFixed(1)}% fill rate)`
  );

  return acceptedTValues;
}

/**
 * Simple visual density without collision detection (for allow-overlap mode)
 */
function generateVisualDensityTValuesSimple(
  params: DistributionParams,
  curveLengthMm: number,
  generators: GeneratorConfig[],
  modifiers: AnyModifier[]
): number[] {
  const tValues: number[] = [];
  let currentT = 0;

  while (currentT < 1.0) {
    // Calculate local modifiers at current position
    const sizeMultiplier = calculateSizeMultiplier(currentT, modifiers);
    const spacingMultiplier = calculateSpacingMultiplier(currentT, modifiers);

    // Base spacing from density setting
    const baseSpacingMm = 1 / params.density;

    // Adjust spacing based on size and spacing multipliers
    const adjustedSpacingMm = baseSpacingMm * sizeMultiplier * spacingMultiplier;

    // Convert spacing from mm to t-increment
    const tIncrement = adjustedSpacingMm / curveLengthMm;

    tValues.push(currentT);
    currentT += tIncrement;

    // Safety break
    if (tValues.length > 10000) {
      console.warn('⚠️ Visual density: hit safety limit of 10000 shapes');
      break;
    }
  }

  return tValues.filter((t) => t <= 1.0);
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

/**
 * Apply distribution mode (noise/random) to base t-values
 * Used for visual density mode where base spacing is already calculated
 */
function applyDistributionModeToBase(
  params: DistributionParams,
  baseTValues: number[]
): number[] {
  if (params.mode === 'linear') {
    return baseTValues;
  }

  // For noise/random, apply jitter to base positions
  if (params.mode === 'noise') {
    const noise2D = createNoise2D(() => params.seed);
    const jitterStrength = (params.noiseStrength || 1.0) * 0.1; // 10% max jitter

    return baseTValues.map((t, i) => {
      const noiseValue = noise2D(i * (params.noiseScale || 0.3), params.seed);
      const jitter = noiseValue * jitterStrength;
      return clamp(t + jitter, 0, 1);
    });
  }

  if (params.mode === 'random') {
    const rng = seededRandom(params.seed);
    const jitterStrength = 0.1; // 10% max jitter

    return baseTValues.map((t) => {
      const jitter = (rng() - 0.5) * jitterStrength * 2;
      return clamp(t + jitter, 0, 1);
    });
  }

  return baseTValues;
}
