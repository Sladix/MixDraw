import paper from 'paper';

/**
 * Spatial grid for efficient collision detection
 * Divides space into cells to reduce O(n²) checks
 */
export class SpatialGrid {
  private cellSize: number;
  private grid: Map<string, paper.Rectangle[]>;

  constructor(cellSize: number = 50) {
    // Cell size in pixels (50px = ~4.2mm at 300 DPI)
    this.cellSize = cellSize;
    this.grid = new Map();
  }


  /**
   * Get all cell keys that a rectangle overlaps
   */
  private getCellKeysForRect(rect: paper.Rectangle): string[] {
    const keys: string[] = [];
    const minX = Math.floor(rect.left / this.cellSize);
    const maxX = Math.floor(rect.right / this.cellSize);
    const minY = Math.floor(rect.top / this.cellSize);
    const maxY = Math.floor(rect.bottom / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        keys.push(`${x},${y}`);
      }
    }
    return keys;
  }

  /**
   * Add a rectangle to the spatial grid
   */
  add(rect: paper.Rectangle): void {
    const keys = this.getCellKeysForRect(rect);
    for (const key of keys) {
      if (!this.grid.has(key)) {
        this.grid.set(key, []);
      }
      this.grid.get(key)!.push(rect);
    }
  }

  /**
   * Get all rectangles that could potentially collide with given rectangle
   */
  getNearby(rect: paper.Rectangle): paper.Rectangle[] {
    const keys = this.getCellKeysForRect(rect);
    const nearby = new Set<paper.Rectangle>();

    for (const key of keys) {
      const rects = this.grid.get(key);
      if (rects) {
        rects.forEach((r) => nearby.add(r));
      }
    }

    return Array.from(nearby);
  }

  /**
   * Clear the grid
   */
  clear(): void {
    this.grid.clear();
  }
}

/**
 * Check if two rectangles intersect with optional tolerance
 * @param a - First rectangle
 * @param b - Second rectangle
 * @param tolerance - Negative = allow overlap (tight packing), 0 = no overlap, positive = require spacing
 * @returns true if rectangles collide
 */
export function checkCollision(
  a: paper.Rectangle,
  b: paper.Rectangle,
  tolerance: number = 0
): boolean {
  if (tolerance === 0) {
    // Standard intersection check
    return a.intersects(b);
  }

  // Shrink or expand rectangles based on tolerance
  // Negative tolerance = shrink bounds = allow overlap (tighter packing)
  // Positive tolerance = expand bounds = require more spacing
  const shrinkA = new paper.Rectangle(a);
  const shrinkB = new paper.Rectangle(b);

  const shrinkAmountA = Math.min(a.width, a.height) * tolerance * 0.5;
  const shrinkAmountB = Math.min(b.width, b.height) * tolerance * 0.5;

  shrinkA.left += shrinkAmountA;
  shrinkA.top += shrinkAmountA;
  shrinkA.right -= shrinkAmountA;
  shrinkA.bottom -= shrinkAmountA;

  shrinkB.left += shrinkAmountB;
  shrinkB.top += shrinkAmountB;
  shrinkB.right -= shrinkAmountB;
  shrinkB.bottom -= shrinkAmountB;

  return shrinkA.intersects(shrinkB);
}

/**
 * Packing mode configuration
 */
export type PackingMode = 'tight' | 'normal' | 'loose' | 'allow-overlap';

export interface PackingConfig {
  mode: PackingMode;
  tolerance: number; // Overlap tolerance (0-1)
}

/**
 * Get tolerance for packing mode
 * Negative values allow slight overlap to compensate for rectangular bounds around non-rectangular shapes
 */
export function getPackingTolerance(mode: PackingMode, minSpacing: number = 0): number {
  let baseTolerance: number;

  switch (mode) {
    case 'tight':
      // Allow negative tolerance (overlap) to pack tighter with rectangular bounds
      baseTolerance = -0.2; // Allow 20% overlap of bounding boxes
      break;
    case 'normal':
      baseTolerance = 0.1; // 10% overlap allowed
      break;
    case 'loose':
      baseTolerance = 0.25; // 25% overlap allowed
      break;
    case 'allow-overlap':
      baseTolerance = 1.0; // Full overlap allowed (no collision checking)
      break;
  }

  // Adjust tolerance based on minSpacing (in mm)
  // Positive minSpacing creates more space, negative makes packing tighter
  const spacingAdjustment = minSpacing * 0.05; // Scale minSpacing to tolerance range
  return baseTolerance + spacingAdjustment;
}

/**
 * Placed shape instance with transformed bounds
 */
export interface PlacedShape {
  bounds: paper.Rectangle;
  t: number;
  position: paper.Point;
}

/**
 * Check if a shape at given position collides with existing shapes
 * @param newBounds - Bounds of new shape to test
 * @param spatialGrid - Spatial grid for efficient lookup
 * @param tolerance - Overlap tolerance
 * @returns true if collision detected
 */
export function hasCollision(
  newBounds: paper.Rectangle,
  spatialGrid: SpatialGrid,
  tolerance: number
): boolean {
  // If tolerance is 1.0, allow all overlaps
  if (tolerance >= 1.0) {
    return false;
  }

  // Get nearby shapes from spatial grid
  const nearbyRects = spatialGrid.getNearby(newBounds);

  // Check collision with nearby shapes
  for (const rect of nearbyRects) {
    if (checkCollision(newBounds, rect, tolerance)) {
      return true;
    }
  }

  return false;
}
