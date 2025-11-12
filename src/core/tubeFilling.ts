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
 * Generate 2D positions within tube area using specified fill mode
 *
 * @param curve - Paper.js path
 * @param baseSpread - Base tube width in mm
 * @param fillMode - Filling strategy
 * @param density - Target density (shapes per mm² or shapes per mm depending on mode)
 * @param avgShapeSize - Average shape size in mm for collision detection
 * @param packingMode - Collision tolerance
 * @param modifiers - Spread modifiers for variable tube width
 * @param seed - Random seed
 * @returns Array of 2D positions within tube
 */
export function generateTubePositions(
  curve: paper.Path,
  baseSpread: number,
  fillMode: FillMode,
  density: number,
  avgShapeSize: number,
  packingMode: PackingMode,
  modifiers: AnyModifier[],
  seed: number
): TubePosition[] {
  console.log(
    `🎨 Tube filling: spread=${baseSpread}mm, mode=${fillMode}, density=${density}, packingMode=${packingMode}`
  );

  switch (fillMode) {
    case 'grid':
      return generateGridPositions(curve, baseSpread, density, modifiers, seed);
    case 'noise':
      return generateNoisePositions(curve, baseSpread, density, avgShapeSize, packingMode, modifiers, seed);
    case 'random':
      return generateRandomPositions(curve, baseSpread, density, avgShapeSize, packingMode, modifiers, seed);
    case 'packed':
      return generatePackedPositions(curve, baseSpread, density, avgShapeSize, packingMode, modifiers, seed);
    default:
      return generateGridPositions(curve, baseSpread, density, modifiers, seed);
  }
}

/**
 * GRID MODE: Regular grid pattern aligned with path tangent
 * Rows follow the curve, columns perpendicular
 */
function generateGridPositions(
  curve: paper.Path,
  baseSpread: number,
  density: number,
  modifiers: AnyModifier[],
  seed: number
): TubePosition[] {
  const positions: TubePosition[] = [];
  const curveLength = curve.length;

  // density = shapes per mm along curve
  // For grid, we interpret this as spacing between rows
  const rowSpacing = 1 / density; // mm between rows along curve

  // Calculate number of rows
  const curveLengthMm = curveLength / mmToPx(1);
  const numRows = Math.max(1, Math.floor(curveLengthMm / rowSpacing));

  console.log(`  Grid: ${numRows} rows, rowSpacing=${rowSpacing.toFixed(2)}mm`);

  for (let row = 0; row < numRows; row++) {
    const t = row / Math.max(1, numRows - 1);

    // Get spread at this t (may be modified)
    const effectiveSpread = calculateSpreadWidth(t, modifiers, baseSpread);
    const halfSpread = effectiveSpread / 2;

    // Calculate column spacing to maintain roughly square grid
    const columnSpacing = rowSpacing; // Same as row spacing for square grid
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

  console.log(`  ✅ Grid generated ${positions.length} positions`);
  return positions;
}

/**
 * NOISE MODE: Perlin noise-based distribution with clustering
 */
function generateNoisePositions(
  curve: paper.Path,
  baseSpread: number,
  density: number,
  avgShapeSize: number,
  packingMode: PackingMode,
  modifiers: AnyModifier[],
  seed: number
): TubePosition[] {
  const positions: TubePosition[] = [];
  const curveLength = curve.length;
  const curveLengthMm = curveLength / mmToPx(1);
  const tolerance = getPackingTolerance(packingMode);
  const spatialGrid = new SpatialGrid(mmToPx(avgShapeSize * 2));

  // Create 2D noise for position sampling
  const noise2D = createNoise2D(() => seed);

  // Generate candidate positions (3x density for good coverage)
  const numCandidates = Math.floor(curveLengthMm * baseSpread * density * 3);

  console.log(`  Noise: generating ${numCandidates} candidates`);

  const rng = seededRandom(seed);

  for (let i = 0; i < numCandidates; i++) {
    // Random t along curve
    const t = rng();

    // Get spread at this t
    const effectiveSpread = calculateSpreadWidth(t, modifiers, baseSpread);
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

    // Check collision
    const shapeSizePx = mmToPx(avgShapeSize);
    const halfSize = shapeSizePx / 2;
    const bounds = new paper.Rectangle(
      position.x - halfSize,
      position.y - halfSize,
      shapeSizePx,
      shapeSizePx
    );

    if (tolerance >= 1.0 || !checkCollisionInGrid(bounds, spatialGrid, tolerance)) {
      positions.push({ t, offset, position });
      spatialGrid.add(bounds);
    }
  }

  console.log(`  ✅ Noise generated ${positions.length} positions`);
  return positions;
}

/**
 * RANDOM MODE: Uniform random distribution with collision avoidance
 */
function generateRandomPositions(
  curve: paper.Path,
  baseSpread: number,
  density: number,
  avgShapeSize: number,
  packingMode: PackingMode,
  modifiers: AnyModifier[],
  seed: number
): TubePosition[] {
  const positions: TubePosition[] = [];
  const curveLength = curve.length;
  const curveLengthMm = curveLength / mmToPx(1);
  const tolerance = getPackingTolerance(packingMode);
  const spatialGrid = new SpatialGrid(mmToPx(avgShapeSize * 2));

  // Generate candidate positions (3x density)
  const numCandidates = Math.floor(curveLengthMm * baseSpread * density * 3);

  console.log(`  Random: generating ${numCandidates} candidates`);

  const rng = seededRandom(seed);

  for (let i = 0; i < numCandidates; i++) {
    // Random t along curve
    const t = rng();

    // Get spread at this t
    const effectiveSpread = calculateSpreadWidth(t, modifiers, baseSpread);
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

    // Check collision
    const shapeSizePx = mmToPx(avgShapeSize);
    const halfSize = shapeSizePx / 2;
    const bounds = new paper.Rectangle(
      position.x - halfSize,
      position.y - halfSize,
      shapeSizePx,
      shapeSizePx
    );

    if (tolerance >= 1.0 || !checkCollisionInGrid(bounds, spatialGrid, tolerance)) {
      positions.push({ t, offset, position });
      spatialGrid.add(bounds);
    }
  }

  console.log(`  ✅ Random generated ${positions.length} positions`);
  return positions;
}

/**
 * PACKED MODE: Greedy packing for maximum density
 * Similar to random but with more candidates and tighter packing
 */
function generatePackedPositions(
  curve: paper.Path,
  baseSpread: number,
  density: number,
  avgShapeSize: number,
  packingMode: PackingMode,
  modifiers: AnyModifier[],
  seed: number
): TubePosition[] {
  const positions: TubePosition[] = [];
  const curveLength = curve.length;
  const curveLengthMm = curveLength / mmToPx(1);
  const tolerance = getPackingTolerance(packingMode);
  const spatialGrid = new SpatialGrid(mmToPx(avgShapeSize * 2));

  // Generate many candidates (5x density for tight packing)
  const numCandidates = Math.floor(curveLengthMm * baseSpread * density * 5);

  console.log(`  Packed: generating ${numCandidates} candidates`);

  const rng = seededRandom(seed);

  for (let i = 0; i < numCandidates; i++) {
    // Random t along curve
    const t = rng();

    // Get spread at this t
    const effectiveSpread = calculateSpreadWidth(t, modifiers, baseSpread);
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

    // Check collision
    const shapeSizePx = mmToPx(avgShapeSize);
    const halfSize = shapeSizePx / 2;
    const bounds = new paper.Rectangle(
      position.x - halfSize,
      position.y - halfSize,
      shapeSizePx,
      shapeSizePx
    );

    if (tolerance >= 1.0 || !checkCollisionInGrid(bounds, spatialGrid, tolerance)) {
      positions.push({ t, offset, position });
      spatialGrid.add(bounds);
    }
  }

  console.log(`  ✅ Packed generated ${positions.length} positions`);
  return positions;
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
