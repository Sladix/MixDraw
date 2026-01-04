import { createNoise2D, NoiseFunction2D } from 'simplex-noise';
import { Vec2, Rect, rectContains } from './Vec2';
import type { LineParams, ColorPalette } from './types';
import type { ForceEngine, Bounds } from './ForceEngine';

// ============================================================================
// Streamline Generator V2 - Optimized for maximum line length
// - No Paper.js for calculations (only for final rendering)
// - Smart seed strategies for better coverage
// - Progressive/async generation support
// - "Maximize length" mode
// ============================================================================

export interface StreamlineConfigV2 {
  lineParams: LineParams;
  bounds: Bounds;
  margin: number;
  colorPalette?: ColorPalette;
}

export interface RawStreamline {
  points: Vec2[];
  color: string;
}

// Seed with priority for gap-filling
interface PrioritySeed {
  point: Vec2;
  normalAngle: number;
  priority: number; // Higher = process first (for gap filling)
}

// Callback for progressive rendering
export type StreamlineCallback = (streamline: RawStreamline, index: number, total: number) => void;

export class StreamlineGeneratorV2 {
  // Spatial hash for O(1) collision detection
  private occupiedCells: Set<number>;
  private cols: number;
  private rows: number;
  private gridCellSize: number;

  private drawingBounds: Rect;
  private lineParams: LineParams;
  private rng: () => number;
  private colorPalette?: ColorPalette;
  private colorNoise: NoiseFunction2D;
  private bounds: Bounds;
  private lineIndex: number = 0;

  // Marking frequency - only mark every Nth point to allow lines to get closer
  private markFrequency: number;

  // Stats
  private _generatedCount = 0;
  private _rejectedCount = 0;

  constructor(config: StreamlineConfigV2, seed: number) {
    this.lineParams = config.lineParams;
    this.rng = this.createRng(seed);
    this.colorPalette = config.colorPalette;
    this.bounds = config.bounds;
    this.colorNoise = createNoise2D(() => this.createRng(seed)());

    // Calculate drawing bounds (with margin)
    this.drawingBounds = {
      x: config.margin,
      y: config.margin,
      width: config.bounds.width - config.margin * 2,
      height: config.bounds.height - config.margin * 2,
    };

    // Grid cell size - FINER grid for more precise collision detection
    // Using dTest/3 allows much finer control over line spacing
    this.gridCellSize = Math.max(1, config.lineParams.dTest / 3);
    this.cols = Math.ceil(config.bounds.width / this.gridCellSize);
    this.rows = Math.ceil(config.bounds.height / this.gridCellSize);
    this.occupiedCells = new Set<number>();

    // Only mark every Nth point based on step size vs grid size
    // This prevents "over-marking" which blocks nearby lines
    this.markFrequency = Math.max(1, Math.floor(this.gridCellSize / config.lineParams.stepSize));
  }

  private createRng(seed: number): () => number {
    return () => {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ============================================================================
  // Spatial Hash Operations
  // ============================================================================

  private getCellIndex(col: number, row: number): number {
    return col + row * this.cols;
  }

  private getCellCoords(point: Vec2): { col: number; row: number } {
    return {
      col: Math.floor(point.x / this.gridCellSize),
      row: Math.floor(point.y / this.gridCellSize),
    };
  }

  /**
   * Check if a point is valid (not too close to existing lines)
   * Uses a more permissive check for continuing lines vs starting new ones
   */
  private isValidPoint(point: Vec2, checkRadius: number = 1): boolean {
    if (!rectContains(this.drawingBounds, point)) {
      return false;
    }

    const { col, row } = this.getCellCoords(point);

    // Check cells within radius
    for (let i = -checkRadius; i <= checkRadius; i++) {
      for (let j = -checkRadius; j <= checkRadius; j++) {
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
   * Check if point is valid for CONTINUING a line (very permissive)
   * Only checks the exact cell - allows lines to get very close
   */
  private isValidForContinuation(point: Vec2): boolean {
    if (!rectContains(this.drawingBounds, point)) {
      return false;
    }

    const { col, row } = this.getCellCoords(point);

    // Only check exact cell for maximum permissiveness
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      if (this.occupiedCells.has(this.getCellIndex(col, row))) {
        return false;
      }
    }

    return true;
  }

  private mark(point: Vec2): void {
    const { col, row } = this.getCellCoords(point);

    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.occupiedCells.add(this.getCellIndex(col, row));
    }
  }

  /**
   * Mark points with sparse marking - only every Nth point
   * This prevents over-blocking of nearby space
   */
  private markPoints(points: Vec2[]): void {
    for (let i = 0; i < points.length; i += this.markFrequency) {
      this.mark(points[i]);
    }
    // Always mark the last point
    if (points.length > 0) {
      this.mark(points[points.length - 1]);
    }
  }

  // ============================================================================
  // Line Tracing
  // ============================================================================

  /**
   * Trace a streamline in one direction with LOOKAHEAD
   * When blocked, tries to continue for a few steps to see if there's open space ahead
   */
  private traceDirection(
    startPoint: Vec2,
    forceEngine: ForceEngine,
    reverse: boolean,
    maxSteps: number
  ): Vec2[] {
    const points: Vec2[] = [];
    let current = startPoint.clone();
    const { stepSize } = this.lineParams;

    let stuckCounter = 0;
    let lastAngle = 0;
    let blockedSteps = 0;
    const maxBlockedSteps = 8; // How many steps to try "jumping over" obstacles
    const blockedPoints: Vec2[] = []; // Points during blocked phase

    for (let i = 0; i < maxSteps; i++) {
      const angle = forceEngine.getAngle({ x: current.x, y: current.y });
      const direction = reverse ? angle + Math.PI : angle;

      // Detect if we're spinning in circles (stuck in a vortex)
      if (i > 0) {
        const angleDiff = Math.abs(direction - lastAngle);
        if (angleDiff > Math.PI / 4) {
          stuckCounter++;
          if (stuckCounter > 10) break; // Spinning too much, stop
        } else {
          stuckCounter = Math.max(0, stuckCounter - 1);
        }
      }
      lastAngle = direction;

      const next = new Vec2(
        current.x + Math.cos(direction) * stepSize,
        current.y + Math.sin(direction) * stepSize
      );

      // Check if we're in bounds first
      if (!rectContains(this.drawingBounds, next)) {
        break;
      }

      if (this.isValidForContinuation(next)) {
        // If we were in blocked mode and found valid space, add the blocked points
        if (blockedSteps > 0) {
          points.push(...blockedPoints);
          blockedPoints.length = 0;
          blockedSteps = 0;
        }
        points.push(next);
        current = next;
      } else {
        // Point is blocked - try lookahead
        blockedSteps++;
        blockedPoints.push(next);
        current = next; // Keep moving even through blocked space

        if (blockedSteps > maxBlockedSteps) {
          // We've been blocked too long, give up
          // Don't add the blocked points - they were in occupied space
          break;
        }
      }
    }

    return points;
  }

  /**
   * Create a single streamline with maximum length strategy
   */
  private createStreamline(
    startPoint: Vec2,
    forceEngine: ForceEngine,
    strokeColor: string
  ): { streamline: RawStreamline | null; newSeeds: PrioritySeed[] } {
    const newSeeds: PrioritySeed[] = [];
    const { maxSteps, minLength, dSep } = this.lineParams;

    // Trace both directions
    const forward = this.traceDirection(startPoint, forceEngine, false, maxSteps);
    const backward = this.traceDirection(startPoint, forceEngine, true, maxSteps);

    // Combine: backward (reversed) + start + forward
    const allPoints = [
      ...backward.reverse(),
      startPoint,
      ...forward,
    ];

    // Skip if too short
    if (allPoints.length < minLength) {
      this.mark(startPoint);
      this._rejectedCount++;
      return { streamline: null, newSeeds };
    }

    // Mark all points
    this.markPoints(allPoints);
    this._generatedCount++;

    // Generate seed points along the line for propagation
    let accumulatedDist = 0;

    for (let i = 1; i < allPoints.length; i++) {
      const dist = allPoints[i].distance(allPoints[i - 1]);
      accumulatedDist += dist;

      if (accumulatedDist >= dSep) {
        accumulatedDist = 0;

        const angle = forceEngine.getAngle({ x: allPoints[i].x, y: allPoints[i].y });
        const normalAngle = angle + Math.PI / 2;

        // Seeds on both sides
        const seedLeft = new Vec2(
          allPoints[i].x + Math.cos(normalAngle) * dSep,
          allPoints[i].y + Math.sin(normalAngle) * dSep
        );
        const seedRight = new Vec2(
          allPoints[i].x + Math.cos(normalAngle + Math.PI) * dSep,
          allPoints[i].y + Math.sin(normalAngle + Math.PI) * dSep
        );

        // Priority based on distance from edges (prefer center for longer lines)
        const priorityLeft = this.calculateSeedPriority(seedLeft);
        const priorityRight = this.calculateSeedPriority(seedRight);

        if (rectContains(this.drawingBounds, seedLeft)) {
          newSeeds.push({ point: seedLeft, normalAngle, priority: priorityLeft });
        }
        if (rectContains(this.drawingBounds, seedRight)) {
          newSeeds.push({ point: seedRight, normalAngle, priority: priorityRight });
        }
      }
    }

    // Get line color
    const centerIdx = Math.floor(allPoints.length / 2);
    const color = this.getLineColor(allPoints[centerIdx], strokeColor);
    this.lineIndex++;

    return {
      streamline: { points: allPoints, color },
      newSeeds,
    };
  }

  /**
   * Calculate priority for a seed point
   * Higher priority = more likely to produce long lines
   */
  private calculateSeedPriority(point: Vec2): number {
    // Distance from center of canvas (normalized 0-1)
    const centerX = this.drawingBounds.x + this.drawingBounds.width / 2;
    const centerY = this.drawingBounds.y + this.drawingBounds.height / 2;
    const dx = (point.x - centerX) / (this.drawingBounds.width / 2);
    const dy = (point.y - centerY) / (this.drawingBounds.height / 2);
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);

    // Distance from edges
    const edgeDist = Math.min(
      point.x - this.drawingBounds.x,
      this.drawingBounds.x + this.drawingBounds.width - point.x,
      point.y - this.drawingBounds.y,
      this.drawingBounds.y + this.drawingBounds.height - point.y
    );
    const normalizedEdgeDist = edgeDist / Math.min(this.drawingBounds.width, this.drawingBounds.height);

    // Higher priority for points far from edges
    return normalizedEdgeDist * 0.7 + (1 - distFromCenter) * 0.3;
  }

  // ============================================================================
  // Seed Strategies
  // ============================================================================

  /**
   * Generate initial seeds using Poisson disk sampling
   * This gives better coverage than random placement
   */
  private generateInitialSeeds(): Vec2[] {
    const seeds: Vec2[] = [];
    const { dSep } = this.lineParams;
    const bounds = this.drawingBounds;

    // Start with center (usually produces longest line)
    seeds.push(new Vec2(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2
    ));

    // Add golden ratio spiral points for even distribution
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const numSeeds = Math.floor(Math.sqrt(
      (bounds.width * bounds.height) / (dSep * dSep * 4)
    ));

    for (let i = 1; i <= numSeeds; i++) {
      const r = Math.sqrt(i / numSeeds) * Math.min(bounds.width, bounds.height) / 2 * 0.9;
      const theta = i * goldenAngle;
      seeds.push(new Vec2(
        bounds.x + bounds.width / 2 + r * Math.cos(theta),
        bounds.y + bounds.height / 2 + r * Math.sin(theta)
      ));
    }

    return seeds;
  }

  /**
   * Find gaps in the current coverage and return seed points
   */
  private findGaps(): Vec2[] {
    const gaps: Vec2[] = [];
    const { dSep } = this.lineParams;
    const step = dSep * 2;

    for (let x = this.drawingBounds.x + step; x < this.drawingBounds.x + this.drawingBounds.width - step; x += step) {
      for (let y = this.drawingBounds.y + step; y < this.drawingBounds.y + this.drawingBounds.height - step; y += step) {
        const point = new Vec2(x + (this.rng() - 0.5) * step, y + (this.rng() - 0.5) * step);
        if (this.isValidPoint(point, 2)) {
          gaps.push(point);
        }
      }
    }

    return gaps;
  }

  // ============================================================================
  // Color Management
  // ============================================================================

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

  private lerpColor(color1: string, color2: string, t: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private multiLerpColor(colors: string[], t: number): string {
    if (colors.length === 0) return '#000000';
    if (colors.length === 1) return colors[0];

    const clampedT = Math.max(0, Math.min(1, t));
    const segmentCount = colors.length - 1;
    const segment = Math.min(Math.floor(clampedT * segmentCount), segmentCount - 1);
    const localT = (clampedT * segmentCount) - segment;

    return this.lerpColor(colors[segment], colors[segment + 1], localT);
  }

  private getLineColor(centerPoint: Vec2, fallbackColor: string): string {
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
          case 'horizontal': t = nx; break;
          case 'vertical': t = ny; break;
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
          default: t = ny;
        }
        return this.multiLerpColor(colors, t);
      }

      case 'noise': {
        const scale = this.colorPalette.noiseScale;
        const colors = this.colorPalette.noiseColors;
        const noiseVal = (this.colorNoise(centerPoint.x / scale, centerPoint.y / scale) + 1) / 2;
        return this.multiLerpColor(colors, noiseVal);
      }

      case 'palette': {
        const colors = this.colorPalette.paletteColors;
        if (colors.length === 0) return fallbackColor;

        switch (this.colorPalette.paletteMode) {
          case 'random': return colors[Math.floor(this.rng() * colors.length)];
          case 'sequential': return colors[this.lineIndex % colors.length];
          case 'position': {
            const index = Math.floor((nx + ny) / 2 * colors.length) % colors.length;
            return colors[index];
          }
          default: return colors[0];
        }
      }

      default:
        return fallbackColor;
    }
  }

  // ============================================================================
  // Generation Methods
  // ============================================================================

  /**
   * Synchronous generation (original behavior)
   */
  generate(forceEngine: ForceEngine, strokeColor: string = '#1a1a1a'): RawStreamline[] {
    const streamlines: RawStreamline[] = [];
    const seedQueue: PrioritySeed[] = [];

    // Initialize with smart seeds
    const initialSeeds = this.generateInitialSeeds();
    for (const seed of initialSeeds) {
      seedQueue.push({
        point: seed,
        normalAngle: this.rng() * Math.PI * 2,
        priority: this.calculateSeedPriority(seed),
      });
    }

    // Sort by priority (higher first)
    seedQueue.sort((a, b) => b.priority - a.priority);

    // Calculate max iterations
    const canvasArea = this.drawingBounds.width * this.drawingBounds.height;
    const cellArea = this.lineParams.dSep * this.lineParams.dSep;
    const maxIterations = Math.ceil(canvasArea / cellArea) * 4;

    let iterations = 0;
    let gapFillAttempts = 0;
    const maxGapFillAttempts = 3;

    while (iterations < maxIterations) {
      // If queue is empty, try gap filling
      if (seedQueue.length === 0) {
        if (gapFillAttempts >= maxGapFillAttempts) break;

        const gaps = this.findGaps();
        if (gaps.length === 0) break;

        for (const gap of gaps) {
          seedQueue.push({
            point: gap,
            normalAngle: this.rng() * Math.PI * 2,
            priority: this.calculateSeedPriority(gap),
          });
        }
        seedQueue.sort((a, b) => b.priority - a.priority);
        gapFillAttempts++;
        continue;
      }

      iterations++;

      // Take highest priority seed
      const seed = seedQueue.shift()!;

      if (!this.isValidPoint(seed.point)) {
        continue;
      }

      const result = this.createStreamline(seed.point, forceEngine, strokeColor);

      if (result.streamline) {
        streamlines.push(result.streamline);

        // Add new seeds sorted by priority
        if (result.newSeeds.length > 0) {
          // Shuffle first to add some randomness
          for (let i = result.newSeeds.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng() * (i + 1));
            [result.newSeeds[i], result.newSeeds[j]] = [result.newSeeds[j], result.newSeeds[i]];
          }
          seedQueue.push(...result.newSeeds);
          // Re-sort periodically (not every time for performance)
          if (streamlines.length % 50 === 0) {
            seedQueue.sort((a, b) => b.priority - a.priority);
          }
        }
      }
    }

    console.log(`[StreamlineV2] Generated ${streamlines.length} lines, rejected ${this._rejectedCount}`);
    return streamlines;
  }

  /**
   * Async generator for progressive rendering
   * Yields streamlines one at a time
   */
  async *generateAsync(
    forceEngine: ForceEngine,
    strokeColor: string = '#1a1a1a',
    batchSize: number = 5,
    delayMs: number = 0
  ): AsyncGenerator<RawStreamline, void, unknown> {
    const seedQueue: PrioritySeed[] = [];

    // Initialize with smart seeds
    const initialSeeds = this.generateInitialSeeds();
    for (const seed of initialSeeds) {
      seedQueue.push({
        point: seed,
        normalAngle: this.rng() * Math.PI * 2,
        priority: this.calculateSeedPriority(seed),
      });
    }

    seedQueue.sort((a, b) => b.priority - a.priority);

    const canvasArea = this.drawingBounds.width * this.drawingBounds.height;
    const cellArea = this.lineParams.dSep * this.lineParams.dSep;
    const maxIterations = Math.ceil(canvasArea / cellArea) * 4;

    let iterations = 0;
    let processedInBatch = 0;
    let gapFillAttempts = 0;
    const maxGapFillAttempts = 3;

    while (iterations < maxIterations) {
      // Gap filling when queue empty
      if (seedQueue.length === 0) {
        if (gapFillAttempts >= maxGapFillAttempts) break;

        const gaps = this.findGaps();
        if (gaps.length === 0) break;

        for (const gap of gaps) {
          seedQueue.push({
            point: gap,
            normalAngle: this.rng() * Math.PI * 2,
            priority: this.calculateSeedPriority(gap),
          });
        }
        seedQueue.sort((a, b) => b.priority - a.priority);
        gapFillAttempts++;
        continue;
      }

      iterations++;

      const seed = seedQueue.shift()!;

      if (!this.isValidPoint(seed.point)) {
        continue;
      }

      const result = this.createStreamline(seed.point, forceEngine, strokeColor);

      if (result.streamline) {
        yield result.streamline;
        processedInBatch++;

        if (result.newSeeds.length > 0) {
          for (let i = result.newSeeds.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng() * (i + 1));
            [result.newSeeds[i], result.newSeeds[j]] = [result.newSeeds[j], result.newSeeds[i]];
          }
          seedQueue.push(...result.newSeeds);
        }

        // Yield control to allow rendering
        if (processedInBatch >= batchSize) {
          processedInBatch = 0;
          if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          } else {
            await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
          }
        }
      }
    }
  }

  /**
   * Progressive generation with callback
   */
  async generateProgressive(
    forceEngine: ForceEngine,
    strokeColor: string,
    onStreamline: StreamlineCallback,
    options: { batchSize?: number; delayMs?: number } = {}
  ): Promise<RawStreamline[]> {
    const { batchSize = 5, delayMs = 0 } = options;
    const streamlines: RawStreamline[] = [];

    for await (const streamline of this.generateAsync(forceEngine, strokeColor, batchSize, delayMs)) {
      streamlines.push(streamline);
      onStreamline(streamline, streamlines.length - 1, -1); // -1 for unknown total
    }

    return streamlines;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  clear(): void {
    this.occupiedCells.clear();
    this._generatedCount = 0;
    this._rejectedCount = 0;
    this.lineIndex = 0;
  }

  getStats(): { generated: number; rejected: number } {
    return {
      generated: this._generatedCount,
      rejected: this._rejectedCount,
    };
  }

  getDrawingBounds(): Rect {
    return this.drawingBounds;
  }
}
