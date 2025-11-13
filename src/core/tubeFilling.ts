import paper from 'paper';
import { createNoise2D } from 'simplex-noise';
import type { FillMode, AnyModifier } from '../types';
import { mmToPx } from '../types/formats';
import { seededRandom } from '../utils/random';
import { SpatialGrid, getPackingTolerance, type PackingMode } from './packing';
import { calculateSpreadWidth } from './modifierEngine';

/**
 * 2D position within the tube area
 */
export interface TubePosition {
  t: number; // Position along curve (0-1)
  offset: number; // Perpendicular offset from centerline in mm (negative = left, positive = right)
  position: paper.Point; // Actual 2D position in pixels
}

/**
 * Parameter evaluator function that returns value at position t
 */
export type ParameterEvaluator = (t: number) => number;

/**
 * Create tighter bounding box for circular shapes
 * Reduces bounds by ~30% to account for circular approximation
 */
function createTightBounds(position: paper.Point, sizePx: number): paper.Rectangle {
  // For circular/organic shapes, use inscribed circle approximation
  // This gives ~30% tighter packing than square bounds
  const radius = sizePx * 0.35; // Tighter than halfSize (0.5) for better packing
  return new paper.Rectangle(
    position.x - radius,
    position.y - radius,
    radius * 2,
    radius * 2
  );
}

/**
 * Generate 2D positions within tube area using specified fill mode
 *
 * @param curve - Paper.js path
 * @param spreadEvaluator - Function that returns spread width in mm at position t
 * @param fillMode - Filling strategy
 * @param densityEvaluator - Function that returns density at position t
 * @param avgShapeSize - Average shape size in mm for collision detection
 * @param packingMode - Collision tolerance
 * @param minSpacing - Minimum spacing in mm (negative = tighter, positive = more space)
 * @param modifiers - Spread modifiers for variable tube width (deprecated, use spreadEvaluator)
 * @param seed - Random seed
 * @param generators - Generator configurations for accurate bounds
 * @param generatorBounds - Map of generator ID to accurate radius
 * @returns Array of 2D positions within tube
 */
export function generateTubePositions(
  curve: paper.Path,
  spreadEvaluator: ParameterEvaluator,
  fillMode: FillMode,
  densityEvaluator: ParameterEvaluator,
  avgShapeSize: number,
  packingMode: PackingMode,
  minSpacing: number,
  modifiers: AnyModifier[],
  seed: number,
  generators?: any[],
  generatorBounds?: Map<string, number>
): TubePosition[] {
  switch (fillMode) {
    case 'grid':
      return generateGridPositions(curve, spreadEvaluator, densityEvaluator, modifiers, seed);
    case 'noise':
      return generateNoisePositions(curve, spreadEvaluator, densityEvaluator, avgShapeSize, packingMode, minSpacing, modifiers, seed, generators, generatorBounds);
    case 'random':
      return generateRandomPositions(curve, spreadEvaluator, densityEvaluator, avgShapeSize, packingMode, minSpacing, modifiers, seed, generators, generatorBounds);
    case 'packed':
      return generatePackedPositions(curve, spreadEvaluator, densityEvaluator, avgShapeSize, packingMode, minSpacing, modifiers, seed, generators, generatorBounds);
    default:
      return generateGridPositions(curve, spreadEvaluator, densityEvaluator, modifiers, seed);
  }
}

/**
 * GRID MODE: Regular grid pattern aligned with path tangent
 * Rows follow the curve, columns perpendicular
 */
function generateGridPositions(
  curve: paper.Path,
  spreadEvaluator: ParameterEvaluator,
  densityEvaluator: ParameterEvaluator,
  modifiers: AnyModifier[],
  seed: number
): TubePosition[] {
  const positions: TubePosition[] = [];
  const curveLength = curve.length;
  const curveLengthMm = curveLength / mmToPx(1);

  // Sample the curve to determine row positions based on varying density
  const sampleCount = 100;
  let accumulatedDistance = 0;
  const rowTValues: number[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const t = i / Math.max(1, sampleCount - 1);
    const densityAtT = densityEvaluator(t);
    const segmentLengthMm = curveLengthMm / sampleCount;

    // density = shapes per mm, so spacing = 1/density
    const targetSpacing = 1 / Math.max(0.01, densityAtT);

    if (accumulatedDistance >= targetSpacing || i === 0) {
      rowTValues.push(t);
      accumulatedDistance = 0;
    }
    accumulatedDistance += segmentLengthMm;
  }

  for (const t of rowTValues) {
    // Get spread at this t (evaluate from function)
    const effectiveSpread = spreadEvaluator(t);
    const halfSpread = effectiveSpread / 2;
    const densityAtT = densityEvaluator(t);

    // Calculate column spacing to maintain roughly square grid
    const columnSpacing = 1 / Math.max(0.01, densityAtT); // Same as row spacing for square grid
    const numColumns = Math.max(1, Math.floor(effectiveSpread / columnSpacing));

    // Generate positions across the width
    for (let col = 0; col < numColumns; col++) {
      // Offset from -halfSpread to +halfSpread
      const offset = -halfSpread + (col / Math.max(1, numColumns - 1)) * effectiveSpread;

      // Get curve position
      const curveOffset = t * curveLength;
      const centerPoint = curve.getPointAt(curveOffset);
      const normal = curve.getNormalAt(curveOffset);

      // Calculate actual 2D position
      const offsetPx = mmToPx(offset);
      const position = centerPoint.add(normal.multiply(offsetPx));

      positions.push({ t, offset, position });
    }
  }

  return positions;
}

/**
 * NOISE MODE: Perlin noise-based distribution with clustering
 */
function generateNoisePositions(
  curve: paper.Path,
  spreadEvaluator: ParameterEvaluator,
  densityEvaluator: ParameterEvaluator,
  avgShapeSize: number,
  packingMode: PackingMode,
  minSpacing: number,
  modifiers: AnyModifier[],
  seed: number,
  generators?: any[],
  generatorBounds?: Map<string, number>
): TubePosition[] {
  const positions: TubePosition[] = [];
  const curveLength = curve.length;
  const curveLengthMm = curveLength / mmToPx(1);
  const tolerance = getPackingTolerance(packingMode, minSpacing);
  const spatialGrid = new SpatialGrid(mmToPx(avgShapeSize * 2));

  // Create 2D noise for position sampling
  const noise2D = createNoise2D(() => seed);

  // Sample average density and spread for candidate count
  const avgDensity = (densityEvaluator(0) + densityEvaluator(0.5) + densityEvaluator(1)) / 3;
  const avgSpread = (spreadEvaluator(0) + spreadEvaluator(0.5) + spreadEvaluator(1)) / 3;

  // Calculate expected shape count based on density
  // Density is per linear mm, so total shapes ≈ density × length
  const expectedCount = Math.floor(curveLengthMm * avgDensity);

  // Generate more candidates to account for clustering (1.5-2x is enough for noise)
  const numCandidates = Math.max(expectedCount * 2, 10); // Minimum 10 for very low density

  const rng = seededRandom(seed);

  for (let i = 0; i < numCandidates; i++) {
    // Random t along curve
    const t = rng();

    // Get spread at this t from evaluator
    const effectiveSpread = spreadEvaluator(t);
    const halfSpread = effectiveSpread / 2;

    // Use noise to determine offset (creates clustering)
    const noiseValue = noise2D(t * 10, i * 0.1); // -1 to 1
    const offset = noiseValue * halfSpread;

    // Get curve position
    const curveOffset = t * curveLength;
    const centerPoint = curve.getPointAt(curveOffset);
    const normal = curve.getNormalAt(curveOffset);

    // Calculate actual 2D position
    const offsetPx = mmToPx(offset);
    const position = centerPoint.add(normal.multiply(offsetPx));

    // Check collision with tight bounds
    const shapeSizePx = mmToPx(avgShapeSize);
    const bounds = createTightBounds(position, shapeSizePx);

    if (tolerance >= 1.0 || !checkCollisionInGrid(bounds, spatialGrid, tolerance)) {
      positions.push({ t, offset, position });
      spatialGrid.add(bounds);
    }
  }

  return positions;
}

/**
 * RANDOM MODE: Uniform random distribution with collision avoidance
 */
function generateRandomPositions(
  curve: paper.Path,
  spreadEvaluator: ParameterEvaluator,
  densityEvaluator: ParameterEvaluator,
  avgShapeSize: number,
  packingMode: PackingMode,
  minSpacing: number,
  modifiers: AnyModifier[],
  seed: number,
  generators?: any[],
  generatorBounds?: Map<string, number>
): TubePosition[] {
  const positions: TubePosition[] = [];
  const curveLength = curve.length;
  const curveLengthMm = curveLength / mmToPx(1);
  const tolerance = getPackingTolerance(packingMode, minSpacing);
  const spatialGrid = new SpatialGrid(mmToPx(avgShapeSize * 2));

  // Sample average density and spread for candidate count
  const avgDensity = (densityEvaluator(0) + densityEvaluator(0.5) + densityEvaluator(1)) / 3;
  const avgSpread = (spreadEvaluator(0) + spreadEvaluator(0.5) + spreadEvaluator(1)) / 3;

  // Calculate expected shape count based on density
  // Density is per linear mm, so total shapes ≈ density × length
  const expectedCount = Math.floor(curveLengthMm * avgDensity);

  // Generate more candidates to account for collision rejection (1.5-2x is enough for uniform random)
  const numCandidates = Math.max(expectedCount * 2, 10); // Minimum 10 for very low density

  const rng = seededRandom(seed);

  for (let i = 0; i < numCandidates; i++) {
    // Random t along curve
    const t = rng();

    // Get spread at this t from evaluator
    const effectiveSpread = spreadEvaluator(t);
    const halfSpread = effectiveSpread / 2;

    // Random offset within spread
    const offset = (rng() - 0.5) * effectiveSpread;

    // Get curve position
    const curveOffset = t * curveLength;
    const centerPoint = curve.getPointAt(curveOffset);
    const normal = curve.getNormalAt(curveOffset);

    // Calculate actual 2D position
    const offsetPx = mmToPx(offset);
    const position = centerPoint.add(normal.multiply(offsetPx));

    // Check collision with tight bounds
    const shapeSizePx = mmToPx(avgShapeSize);
    const bounds = createTightBounds(position, shapeSizePx);

    if (tolerance >= 1.0 || !checkCollisionInGrid(bounds, spatialGrid, tolerance)) {
      positions.push({ t, offset, position });
      spatialGrid.add(bounds);
    }
  }

  return positions;
}

/**
 * PACKED MODE: Greedy packing for maximum density using accurate circular collision
 * Uses pre-calculated generator bounds for tight, accurate packing
 */
function generatePackedPositions(
  curve: paper.Path,
  spreadEvaluator: ParameterEvaluator,
  densityEvaluator: ParameterEvaluator,
  avgShapeSize: number,
  packingMode: PackingMode,
  minSpacing: number,
  modifiers: AnyModifier[],
  seed: number,
  generators?: any[],
  generatorBounds?: Map<string, number>
): TubePosition[] {
  const positions: TubePosition[] = [];
  const curveLength = curve.length;
  const curveLengthMm = curveLength / mmToPx(1);
  const tolerance = getPackingTolerance(packingMode, minSpacing);

  // Use optimized spatial grid cell size (2x average radius for efficiency)
  const avgRadiusPx = mmToPx(avgShapeSize / 2);
  const spatialGrid = new SpatialGrid(avgRadiusPx * 2);

  // Sample average density and spread for candidate count
  const avgDensity = (densityEvaluator(0) + densityEvaluator(0.5) + densityEvaluator(1)) / 3;
  const avgSpread = (spreadEvaluator(0) + spreadEvaluator(0.5) + spreadEvaluator(1)) / 3;

  const rng = seededRandom(seed);

  // Calculate expected shape count based on density
  // Density is per linear mm, so total shapes ≈ density × length
  const expectedCount = Math.floor(curveLengthMm * avgDensity);

  // For packed mode, we need many more candidates to achieve tight packing
  // The multiplier depends on tolerance: tighter packing = more rejections = need more candidates
  let candidateMultiplier = 5; // Base multiplier
  if (packingMode === 'tight') {
    candidateMultiplier = 10; // More candidates for tight packing
  } else if (packingMode === 'allow-overlap') {
    candidateMultiplier = 1.5; // Fewer candidates when overlap is allowed
  }

  const numCandidates = Math.max(expectedCount * candidateMultiplier, 20); // Minimum 20 for very low density

  // Candidate with accurate circular bounds
  interface Candidate {
    t: number;
    offset: number;
    position: paper.Point;
    radius: number; // Accurate bounding circle radius
    generatorId: string;
  }

  const candidates: Candidate[] = [];

  // Pre-select generators for all candidates (faster than doing it during collision check)
  const generatorIds = generators ? generators.map(g => g.id) : [];
  const generatorWeights = generators ? generators.map(g => g.weight || 1) : [1];
  const totalWeight = generatorWeights.reduce((sum, w) => sum + w, 0);

  for (let i = 0; i < numCandidates; i++) {
    const t = rng();
    const effectiveSpread = spreadEvaluator(t);
    const offset = (rng() - 0.5) * effectiveSpread;

    const curveOffset = t * curveLength;
    const centerPoint = curve.getPointAt(curveOffset);
    const normal = curve.getNormalAt(curveOffset);

    const offsetPx = mmToPx(offset);
    const position = centerPoint.add(normal.multiply(offsetPx));

    // Choose generator based on weights
    let chosenGeneratorId = generatorIds[0] || '';
    if (generators && generators.length > 0) {
      const rand = rng() * totalWeight;
      let cumWeight = 0;
      for (let j = 0; j < generators.length; j++) {
        cumWeight += generatorWeights[j];
        if (rand <= cumWeight) {
          chosenGeneratorId = generatorIds[j];
          break;
        }
      }
    }

    // Get accurate radius from pre-calculated bounds
    const radius = generatorBounds?.get(chosenGeneratorId) || avgRadiusPx;

    candidates.push({ t, offset, position, radius, generatorId: chosenGeneratorId });
  }

  // Sort candidates by t position for spatial coherence
  candidates.sort((a, b) => a.t - b.t);

  // Try to place each candidate using circular collision
  for (const candidate of candidates) {
    if (tolerance >= 1.0 || !checkCircularCollisionInGrid(candidate.position, candidate.radius, spatialGrid, tolerance)) {
      positions.push({
        t: candidate.t,
        offset: candidate.offset,
        position: candidate.position,
      });

      // Store as circle in grid (using rectangle bounds for grid efficiency)
      const bounds = new paper.Rectangle(
        candidate.position.x - candidate.radius,
        candidate.position.y - candidate.radius,
        candidate.radius * 2,
        candidate.radius * 2
      );
      spatialGrid.add(bounds);
    }
  }

  return positions;
}

/**
 * Check circular collision against shapes in spatial grid
 * More accurate than rectangular collision for organic shapes
 */
function checkCircularCollisionInGrid(
  position: paper.Point,
  radius: number,
  grid: SpatialGrid,
  tolerance: number
): boolean {
  // Create search bounds (slightly larger for safety)
  const searchBounds = new paper.Rectangle(
    position.x - radius * 1.5,
    position.y - radius * 1.5,
    radius * 3,
    radius * 3
  );

  const nearby = grid.getNearby(searchBounds);

  for (const otherBounds of nearby) {
    // Get other shape's center and radius from its bounds
    const otherCenter = otherBounds.center;
    const otherRadius = otherBounds.width / 2; // Stored as square bounds

    // Circle-to-circle collision
    const distance = position.getDistance(otherCenter);
    const minDistance = radius + otherRadius;

    // Apply tolerance (negative = allow overlap, positive = require spacing)
    const effectiveMinDistance = minDistance * (1 + tolerance);

    if (distance < effectiveMinDistance) {
      return true; // Collision detected
    }
  }

  return false; // No collision
}

/**
 * Helper: Check collision using spatial grid
 */
function checkCollisionInGrid(
  bounds: paper.Rectangle,
  spatialGrid: SpatialGrid,
  tolerance: number
): boolean {
  const nearbyRects = spatialGrid.getNearby(bounds);

  for (const rect of nearbyRects) {
    if (tolerance === 0) {
      if (bounds.intersects(rect)) {
        return true;
      }
    } else {
      // Allow overlap based on tolerance
      const shrinkAmount = Math.min(bounds.width, rect.width) * tolerance * 0.5;
      const shrunkNew = new paper.Rectangle(bounds);
      shrunkNew.left += shrinkAmount;
      shrunkNew.top += shrinkAmount;
      shrunkNew.right -= shrinkAmount;
      shrunkNew.bottom -= shrinkAmount;

      const shrunkExisting = new paper.Rectangle(rect);
      shrunkExisting.left += shrinkAmount;
      shrunkExisting.top += shrinkAmount;
      shrunkExisting.right -= shrinkAmount;
      shrunkExisting.bottom -= shrinkAmount;

      if (shrunkNew.intersects(shrunkExisting)) {
        return true;
      }
    }
  }

  return false;
}
