import paper from 'paper';
import { createNoise2D, NoiseFunction2D } from 'simplex-noise';
import type { LineParams, ColorPalette } from './types';
import type { ForceEngine, Bounds } from './ForceEngine';

// ============================================================================
// Streamline Generator - Greedy propagation algorithm
// Inspired by msurguy/flow-lines
// ============================================================================

export interface StreamlineConfig {
  lineParams: LineParams;
  bounds: Bounds;
  margin: number;
  scope?: paper.PaperScope; // Optional paper scope for multi-scope environments
  colorPalette?: ColorPalette; // Optional color palette for multi-color lines
}

export interface Streamline {
  points: paper.Point[];
  path: paper.Path;
}

interface QueuedSeed {
  point: paper.Point;
  // Direction perpendicular to the source line at this point
  normalAngle: number;
}

export class StreamlineGenerator {
  // Spatial hash for O(1) collision detection
  private occupiedCells: Set<number>;
  private cols: number;
  private rows: number;
  private gridCellSize: number;

  private drawingBounds: paper.Rectangle;
  private lineParams: LineParams;
  private rng: () => number;
  private paper: typeof paper; // Use passed scope or global paper
  private colorPalette?: ColorPalette;
  private colorNoise: NoiseFunction2D;
  private bounds: Bounds;
  private lineIndex: number = 0; // For sequential palette mode

  constructor(config: StreamlineConfig, seed: number) {
    this.lineParams = config.lineParams;
    this.rng = this.createRng(seed);
    this.colorPalette = config.colorPalette;
    this.bounds = config.bounds;
    // Use same seed as force noise so colors correlate with flow patterns
    this.colorNoise = createNoise2D(() => this.createRng(seed)());
    // Use passed scope or fall back to global paper
    this.paper = config.scope || paper;

    // Calculate drawing bounds (with margin)
    this.drawingBounds = new this.paper.Rectangle(
      config.margin,
      config.margin,
      config.bounds.width - config.margin * 2,
      config.bounds.height - config.margin * 2
    );

    // Grid cell size is dTest/2 for finer collision detection
    // This allows lines to get closer while still preventing overlap
    this.gridCellSize = Math.max(1, config.lineParams.dTest / 2);
    this.cols = Math.ceil(config.bounds.width / this.gridCellSize);
    this.rows = Math.ceil(config.bounds.height / this.gridCellSize);
    // Use Set for O(1) lookup instead of array
    this.occupiedCells = new Set<number>();
  }

  private createRng(seed: number): () => number {
    return () => {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /**
   * Interpolate between colors in hex format
   */
  private lerpColor(color1: string, color2: string, t: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  /**
   * Interpolate through multiple colors based on t (0-1)
   */
  private multiLerpColor(colors: string[], t: number): string {
    if (colors.length === 0) return '#000000';
    if (colors.length === 1) return colors[0];

    const clampedT = Math.max(0, Math.min(1, t));
    const segmentCount = colors.length - 1;
    const segment = Math.min(Math.floor(clampedT * segmentCount), segmentCount - 1);
    const localT = (clampedT * segmentCount) - segment;

    return this.lerpColor(colors[segment], colors[segment + 1], localT);
  }

  /**
   * Get color for a line based on palette settings and position
   */
  private getLineColor(centerPoint: paper.Point, fallbackColor: string): string {
    if (!this.colorPalette || this.colorPalette.mode === 'single') {
      return fallbackColor;
    }

    const nx = (centerPoint.x - this.bounds.x) / this.bounds.width;
    const ny = (centerPoint.y - this.bounds.y) / this.bounds.height;

    switch (this.colorPalette.mode) {
      case 'gradient': {
        const colors = this.colorPalette.gradientColors;
        let t: number;

        switch (this.colorPalette.gradientDirection) {
          case 'horizontal':
            t = nx;
            break;
          case 'vertical':
            t = ny;
            break;
          case 'radial': {
            const dx = nx - 0.5;
            const dy = ny - 0.5;
            t = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
            break;
          }
          case 'angular': {
            const dx = nx - 0.5;
            const dy = ny - 0.5;
            t = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
            break;
          }
          default:
            t = ny;
        }

        return this.multiLerpColor(colors, t);
      }

      case 'noise': {
        const scale = this.colorPalette.noiseScale;
        const colors = this.colorPalette.noiseColors;
        // Noise returns -1 to 1, map to 0-1
        const noiseVal = (this.colorNoise(centerPoint.x / scale, centerPoint.y / scale) + 1) / 2;
        return this.multiLerpColor(colors, noiseVal);
      }

      case 'palette': {
        const colors = this.colorPalette.paletteColors;
        if (colors.length === 0) return fallbackColor;

        switch (this.colorPalette.paletteMode) {
          case 'random':
            return colors[Math.floor(this.rng() * colors.length)];
          case 'sequential':
            return colors[this.lineIndex % colors.length];
          case 'position': {
            // Use position to pick color
            const index = Math.floor((nx + ny) / 2 * colors.length) % colors.length;
            return colors[index];
          }
          default:
            return colors[0];
        }
      }

      default:
        return fallbackColor;
    }
  }

  /**
   * Get cell index from point
   */
  private getCellIndex(col: number, row: number): number {
    return col + row * this.cols;
  }

  /**
   * Check if a point is valid for collision - O(1) using spatial hash
   * Only checks current cell and 8 neighbors
   */
  private isValidPoint(point: paper.Point): boolean {
    if (!this.drawingBounds.contains(point)) {
      return false;
    }

    const col = Math.floor(point.x / this.gridCellSize);
    const row = Math.floor(point.y / this.gridCellSize);

    // Check current cell and 8 neighbors (3x3 grid)
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const c = col + i;
        const r = row + j;

        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
          if (this.occupiedCells.has(this.getCellIndex(c, r))) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Mark a point as occupied in the spatial hash
   */
  private mark(point: paper.Point): void {
    const col = Math.floor(point.x / this.gridCellSize);
    const row = Math.floor(point.y / this.gridCellSize);

    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.occupiedCells.add(this.getCellIndex(col, row));
    }
  }

  /**
   * Shuffle array in place (Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Trace a streamline in one direction
   * Returns the points traced and the angles at each point
   */
  private traceDirection(
    startPoint: paper.Point,
    forceEngine: ForceEngine,
    reverse: boolean = false
  ): { points: paper.Point[]; angles: number[] } {
    const points: paper.Point[] = [];
    const angles: number[] = [];
    let current = startPoint.clone();

    const { stepSize, maxSteps } = this.lineParams;

    for (let i = 0; i < maxSteps; i++) {
      const angle = forceEngine.getAngle({ x: current.x, y: current.y });
      const direction = reverse ? angle + Math.PI : angle;

      const vector = new this.paper.Point({
        length: stepSize,
        angle: direction * 180 / Math.PI,
      });
      const next = current.add(vector);

      // Check bounds and collision with OTHER streamlines (not this one)
      if (this.isValidPoint(next)) {
        points.push(next);
        angles.push(angle);
        // Don't mark during tracing - we'll mark all points at the end
        current = next;
      } else {
        break;
      }
    }

    return { points, angles };
  }

  /**
   * Create a single streamline from a starting point (greedy - traces both directions)
   * Returns the streamline and seed points for new lines
   */
  private createStreamlineGreedy(
    startPoint: paper.Point,
    forceEngine: ForceEngine,
    strokeColor: string
  ): { streamline: Streamline | null; newSeeds: QueuedSeed[] } {
    const newSeeds: QueuedSeed[] = [];

    // Trace forward (don't mark yet)
    const forward = this.traceDirection(startPoint, forceEngine, false);

    // Trace backward (don't mark yet)
    const backward = this.traceDirection(startPoint, forceEngine, true);

    // Combine: backward (reversed) + start + forward
    const allPoints = [
      ...backward.points.reverse(),
      startPoint,
      ...forward.points,
    ];
    const allAngles = [
      ...backward.angles.reverse(),
      forceEngine.getAngle({ x: startPoint.x, y: startPoint.y }),
      ...forward.angles,
    ];

    // Skip if too short
    if (allPoints.length < this.lineParams.minLength) {
      // Still mark the start point so we don't retry it
      this.mark(startPoint);
      return { streamline: null, newSeeds };
    }

    // Mark all points in the streamline for collision detection
    for (const p of allPoints) {
      this.mark(p);
    }

    // Generate seed points along the line at dSep intervals
    const { dSep } = this.lineParams;
    let accumulatedDist = 0;

    for (let i = 1; i < allPoints.length; i++) {
      const dist = allPoints[i].getDistance(allPoints[i - 1]);
      accumulatedDist += dist;

      // Add seeds at dSep intervals
      if (accumulatedDist >= dSep) {
        accumulatedDist = 0;
        const angle = allAngles[i];
        const normalAngle = angle + Math.PI / 2; // Perpendicular

        // Add seeds on both sides of the line
        const seedLeft = allPoints[i].add(new this.paper.Point({
          length: dSep,
          angle: normalAngle * 180 / Math.PI,
        }));
        const seedRight = allPoints[i].add(new this.paper.Point({
          length: dSep,
          angle: (normalAngle + Math.PI) * 180 / Math.PI,
        }));

        if (this.drawingBounds.contains(seedLeft)) {
          newSeeds.push({ point: seedLeft, normalAngle });
        }
        if (this.drawingBounds.contains(seedRight)) {
          newSeeds.push({ point: seedRight, normalAngle });
        }
      }
    }

    // Calculate center point for color selection
    const centerIdx = Math.floor(allPoints.length / 2);
    const centerPoint = allPoints[centerIdx];

    // Get color based on palette settings
    const lineColor = this.getLineColor(centerPoint, strokeColor);

    // Create path directly from points (no simplification)
    const path = new this.paper.Path({
      strokeColor: lineColor,
      strokeWidth: this.lineParams.strokeWidth,
      strokeCap: 'round',
      strokeJoin: 'round',
    });

    for (const p of allPoints) {
      path.add(p);
    }

    path.smooth();

    // Increment line index for sequential palette mode
    this.lineIndex++;

    return {
      streamline: { points: allPoints, path },
      newSeeds,
    };
  }

  /**
   * Generate all streamlines using greedy propagation
   * Lines propagate from existing lines, filling space organically
   */
  generate(
    forceEngine: ForceEngine,
    strokeColor: string = '#1a1a1a'
  ): Streamline[] {
    const streamlines: Streamline[] = [];

    // Initialize seed queue with a few starting points
    const seedQueue: QueuedSeed[] = [];

    // Start with seeds in the center and corners for good coverage
    const initialSeeds = this.generateInitialSeeds();

    for (const seed of initialSeeds) {
      seedQueue.push({
        point: seed,
        normalAngle: this.rng() * Math.PI * 2,
      });
    }

    // Shuffle the initial queue
    this.shuffleArray(seedQueue);

    // Compute max iterations dynamically based on canvas size
    const canvasArea = this.drawingBounds.width * this.drawingBounds.height;
    const cellArea = this.lineParams.dSep * this.lineParams.dSep;
    const maxIterations = Math.ceil(canvasArea / cellArea) * 4; // Allow 4x coverage attempts

    // Process queue (greedy propagation)
    let iterations = 0;

    while (seedQueue.length > 0 && iterations < maxIterations) {
      iterations++;

      // Take next seed from queue
      const seed = seedQueue.shift()!;

      // Check if the point is still valid (may have been blocked by other lines)
      if (!this.isValidPoint(seed.point)) {
        continue;
      }

      // Create streamline from this seed
      const result = this.createStreamlineGreedy(seed.point, forceEngine, strokeColor);

      if (result.streamline) {
        streamlines.push(result.streamline);

        // Batch optimization: shuffle new seeds and append to queue
        // This is O(k) where k = newSeeds.length, vs O(n*k) for individual splices
        if (result.newSeeds.length > 0) {
          this.shuffleArray(result.newSeeds);
          seedQueue.push(...result.newSeeds);
        }
      }
    }

    return streamlines;
  }

  /**
   * Generate initial seed points for starting the propagation
   */
  private generateInitialSeeds(): paper.Point[] {
    const seeds: paper.Point[] = [];
    const { dSep } = this.lineParams;
    const bounds = this.drawingBounds;

    // Center point
    seeds.push(new this.paper.Point(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2
    ));

    // Grid of initial seeds based on dSep
    const numSeeds = Math.max(3, Math.floor(Math.sqrt(
      (bounds.width * bounds.height) / (dSep * dSep * 16)
    )));

    for (let i = 0; i < numSeeds; i++) {
      seeds.push(new this.paper.Point(
        bounds.x + this.rng() * bounds.width,
        bounds.y + this.rng() * bounds.height
      ));
    }

    return seeds;
  }

  /**
   * Clear the spatial hash (for regeneration)
   */
  clear(): void {
    this.occupiedCells.clear();
  }

  /**
   * Get drawing bounds
   */
  getDrawingBounds(): paper.Rectangle {
    return this.drawingBounds;
  }
}
