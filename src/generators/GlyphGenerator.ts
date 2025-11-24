import paper from 'paper';
import type { Generator, Shape, ParamDefinition } from '../types';
import { seededRandom, lerp } from '../utils/random';
import { mmToPx } from '../types/formats';

/**
 * Typographic format defining consistent character proportions.
 * All glyphs use the same bounding box defined by the format.
 */
interface LetterFormat {
  name: string;
  aspectRatio: number; // width/height
  gridRows: number;
  gridCols: number;
  // Weight zones define where strokes are more likely to appear
  zoneWeights: {
    top: number;    // 0-1: probability weight for top third
    middle: number; // 0-1: probability weight for middle third
    bottom: number; // 0-1: probability weight for bottom third
  };
}

const LETTER_FORMATS: Record<string, LetterFormat> = {
  square: {
    name: 'Square (CJK)',
    aspectRatio: 1.0,
    gridRows: 5,
    gridCols: 5,
    zoneWeights: { top: 0.3, middle: 0.5, bottom: 0.2 },
  },
  tall: {
    name: 'Tall',
    aspectRatio: 0.65,
    gridRows: 7,
    gridCols: 4,
    zoneWeights: { top: 0.25, middle: 0.5, bottom: 0.25 },
  },
  wide: {
    name: 'Wide',
    aspectRatio: 1.5,
    gridRows: 4,
    gridCols: 6,
    zoneWeights: { top: 0.35, middle: 0.4, bottom: 0.25 },
  },
};

type StrokeType = 'straight' | 'curve' | 'dot';

interface GridPoint {
  row: number;
  col: number;
}

interface Stroke {
  type: StrokeType;
  start: GridPoint;
  end: GridPoint;
  curveDirection?: 'left' | 'right'; // For curves only
}

/**
 * Manages stroke placement ensuring no overlaps.
 * Tracks all grid cells occupied by strokes to prevent any overlapping paths.
 */
class StrokeGraph {
  private occupiedCells = new Set<string>();
  private junctions = new Map<string, GridPoint>();
  public strokes: Stroke[] = [];

  private cellKey(row: number, col: number): string {
    return `${row},${col}`;
  }

  /**
   * Get all grid cells that a stroke passes through.
   */
  private getStrokeCells(stroke: Stroke): string[] {
    const cells: string[] = [];

    if (stroke.type === 'dot') {
      cells.push(this.cellKey(stroke.start.row, stroke.start.col));
      return cells;
    }

    // For straight lines, calculate all cells along the path
    const dr = stroke.end.row - stroke.start.row;
    const dc = stroke.end.col - stroke.start.col;
    const steps = Math.max(Math.abs(dr), Math.abs(dc));

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const row = Math.round(stroke.start.row + dr * t);
      const col = Math.round(stroke.start.col + dc * t);
      cells.push(this.cellKey(row, col));
    }

    return cells;
  }

  /**
   * Check if a stroke would overlap any existing strokes.
   */
  private wouldOverlap(newStroke: Stroke): boolean {
    const cells = this.getStrokeCells(newStroke);

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const isEndpoint = i === 0 || i === cells.length - 1;

      if (!this.occupiedCells.has(cell)) {
        continue; // Cell is free, no problem
      }

      // Cell is occupied - check if overlap is allowed
      if (isEndpoint) {
        // Endpoints can only overlap with other endpoints (junctions)
        // Check if the occupied cell is a junction
        const isJunction = this.junctions.has(cell);

        if (!isJunction) {
          // Trying to place endpoint on an interior cell of another stroke - not allowed!
          return true;
        }

        // Dots can't share junctions (they need their own space)
        if (newStroke.type === 'dot') {
          return true;
        }

        // Regular stroke endpoint on junction - allowed
      } else {
        // Interior cell is occupied - never allowed
        return true;
      }
    }

    return false;
  }

  /**
   * Add a stroke to the graph if it doesn't overlap existing strokes.
   */
  addStroke(stroke: Stroke): boolean {
    if (this.wouldOverlap(stroke)) {
      return false;
    }

    const cells = this.getStrokeCells(stroke);

    this.strokes.push(stroke);

    // Mark all cells as occupied
    cells.forEach(cell => this.occupiedCells.add(cell));

    // Register junctions (endpoints only)
    this.junctions.set(this.cellKey(stroke.start.row, stroke.start.col), stroke.start);
    this.junctions.set(this.cellKey(stroke.end.row, stroke.end.col), stroke.end);

    return true;
  }

  getJunctions(): GridPoint[] {
    return Array.from(this.junctions.values());
  }
}

export class GlyphGenerator implements Generator {
  type = 'glyph';
  name = 'Glyph';
  description = 'Consistent typographic glyphs with non-crossing strokes';
  tags = ['geometric', 'calligraphy', 'asian', 'character'];

  generate(_t: number, params: Record<string, any>, seed: number): Shape {
    const rng = seededRandom(seed);

    // Get format for consistent sizing
    const formatKey = params.letterFormat ?? 'square';
    const format = LETTER_FORMATS[formatKey] || LETTER_FORMATS.square;

    // Calculate consistent bounding box in pixels
    const unitSizeMm = typeof params.unitSize === 'object'
      ? lerp(params.unitSize.min, params.unitSize.max, rng())
      : params.unitSize;
    const unitSize = mmToPx(unitSizeMm);

    const width = format.gridCols * unitSize;
    const height = format.gridRows * unitSize;

    // Extract parameters
    const complexity = params.complexity ?? 0.5; // 0-1: how many strokes
    const enableDiagonals = params.enableDiagonals ?? true;
    const enableCurves = params.enableCurves ?? true;
    const enableDots = params.enableDots ?? true;
    const zoneWeighting = params.zoneWeighting ?? 0.7;
    const variation = params.strokeVariation ?? 0.1;
    const symmetry = params.symmetry ?? 'none';

    // When using symmetry, only generate strokes in one quadrant to prevent overlaps
    // Use floor to exclude center line for odd-sized grids (prevents center overlaps)
    const effectiveFormat = {
      ...format,
      gridRows: (symmetry === 'vertical' || symmetry === 'both')
        ? Math.floor(format.gridRows / 2)
        : format.gridRows,
      gridCols: (symmetry === 'horizontal' || symmetry === 'both')
        ? Math.floor(format.gridCols / 2)
        : format.gridCols,
    };

    // Build stroke graph
    const graph = new StrokeGraph();

    // Phase 1: Place backbone strokes (1-2 main strokes)
    const backboneCount = Math.floor(lerp(1, 2.99, rng()));
    for (let i = 0; i < backboneCount; i++) {
      const stroke = this.generateBackbone(effectiveFormat, rng, zoneWeighting);
      graph.addStroke(stroke);
    }

    // Phase 2: Add branching strokes from junctions
    const targetStrokeCount = Math.floor(complexity * effectiveFormat.gridRows * effectiveFormat.gridCols * 0.3);
    let attempts = 0;
    const maxAttempts = targetStrokeCount * 5;

    while (graph.strokes.length < targetStrokeCount && attempts < maxAttempts) {
      attempts++;

      const junctions = graph.getJunctions();
      if (junctions.length === 0) break;

      // Pick random junction
      const junction = junctions[Math.floor(rng() * junctions.length)];

      // Generate stroke from this junction
      const stroke = this.generateBranchStroke(
        junction,
        effectiveFormat,
        rng,
        enableDiagonals,
        enableCurves
      );

      if (stroke) {
        graph.addStroke(stroke);
      }
    }

    // Phase 3: Add decorative dots
    if (enableDots && rng() > 0.6) {
      const dotCount = Math.floor(lerp(1, 3.99, rng()));
      for (let i = 0; i < dotCount; i++) {
        const row = Math.floor(rng() * effectiveFormat.gridRows);
        const col = Math.floor(rng() * effectiveFormat.gridCols);
        graph.addStroke({
          type: 'dot',
          start: { row, col },
          end: { row, col },
        });
      }
    }

    // Convert strokes to Paper.js paths
    const paths = this.strokesToPaths(
      graph.strokes,
      width,
      height,
      unitSize,
      variation,
      rng
    );

    // Apply symmetry if needed
    const allPaths = this.applySymmetry(paths, symmetry);

    // Clean up original paths before merging (symmetry creates clones)
    paths.forEach(p => p.remove());

    // Merge connected paths for minimal plotter paths
    const mergedPaths = this.mergePaths(allPaths);

    // Clean up pre-merge paths
    allPaths.forEach(p => p.remove());

    // Calculate bounds (mergedPaths are the final output, don't remove yet)
    const group = new paper.Group(mergedPaths);
    const bounds = group.bounds.clone();
    group.remove();

    return {
      paths: mergedPaths,
      bounds,
      anchor: new paper.Point(0, 0),
    };
  }

  /**
   * Generate a backbone stroke (main structural element).
   */
  private generateBackbone(
    format: LetterFormat,
    rng: () => number,
    zoneWeighting: number
  ): Stroke {
    const isHorizontal = rng() > 0.5;
    const row = this.pickZoneWeightedRow(format, rng, zoneWeighting);
    const col = Math.floor(rng() * format.gridCols);

    if (isHorizontal) {
      // Horizontal backbone across most of the width
      const startCol = Math.floor(rng() * 2);
      const endCol = format.gridCols - 1 - Math.floor(rng() * 2);
      return {
        type: 'straight',
        start: { row, col: startCol },
        end: { row, col: endCol },
      };
    } else {
      // Vertical backbone across most of the height
      const startRow = Math.floor(rng() * 2);
      const endRow = format.gridRows - 1 - Math.floor(rng() * 2);
      return {
        type: 'straight',
        start: { row: startRow, col },
        end: { row: endRow, col },
      };
    }
  }

  /**
   * Generate a branch stroke from a junction point.
   */
  private generateBranchStroke(
    junction: GridPoint,
    format: LetterFormat,
    rng: () => number,
    enableDiagonals: boolean,
    enableCurves: boolean
  ): Stroke | null {
    const directions: Array<{ dr: number; dc: number; type: StrokeType; curveDir?: 'left' | 'right' }> = [
      { dr: 0, dc: 1, type: 'straight' },  // right
      { dr: 0, dc: -1, type: 'straight' }, // left
      { dr: 1, dc: 0, type: 'straight' },  // down
      { dr: -1, dc: 0, type: 'straight' }, // up
    ];

    if (enableDiagonals) {
      directions.push(
        { dr: 1, dc: 1, type: 'straight' },   // down-right
        { dr: 1, dc: -1, type: 'straight' },  // down-left
        { dr: -1, dc: 1, type: 'straight' },  // up-right
        { dr: -1, dc: -1, type: 'straight' }  // up-left
      );
    }

    if (enableCurves) {
      directions.push(
        { dr: 0, dc: 1, type: 'curve', curveDir: 'left' },
        { dr: 0, dc: 1, type: 'curve', curveDir: 'right' },
        { dr: 1, dc: 0, type: 'curve', curveDir: 'left' },
        { dr: 1, dc: 0, type: 'curve', curveDir: 'right' }
      );
    }

    // Shuffle directions
    for (let i = directions.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [directions[i], directions[j]] = [directions[j], directions[i]];
    }

    // Try each direction
    for (const dir of directions) {
      const length = Math.floor(lerp(1, 3.99, rng()));
      const endRow = junction.row + dir.dr * length;
      const endCol = junction.col + dir.dc * length;

      // Check bounds
      if (endRow < 0 || endRow >= format.gridRows || endCol < 0 || endCol >= format.gridCols) {
        continue;
      }

      return {
        type: dir.type,
        start: junction,
        end: { row: endRow, col: endCol },
        curveDirection: dir.curveDir,
      };
    }

    return null;
  }

  /**
   * Pick a row biased toward weighted zones.
   */
  private pickZoneWeightedRow(
    format: LetterFormat,
    rng: () => number,
    weighting: number
  ): number {
    if (rng() > weighting) {
      return Math.floor(rng() * format.gridRows);
    }

    const zones = [
      { weight: format.zoneWeights.top, range: [0, Math.floor(format.gridRows / 3)] },
      { weight: format.zoneWeights.middle, range: [Math.floor(format.gridRows / 3), Math.floor(2 * format.gridRows / 3)] },
      { weight: format.zoneWeights.bottom, range: [Math.floor(2 * format.gridRows / 3), format.gridRows] },
    ];

    const totalWeight = zones.reduce((sum, z) => sum + z.weight, 0);
    let random = rng() * totalWeight;

    for (const zone of zones) {
      random -= zone.weight;
      if (random <= 0) {
        return Math.floor(lerp(zone.range[0], zone.range[1] - 0.01, rng()));
      }
    }

    return Math.floor(format.gridRows / 2);
  }

  /**
   * Convert strokes to Paper.js paths.
   */
  private strokesToPaths(
    strokes: Stroke[],
    width: number,
    height: number,
    unitSize: number,
    variation: number,
    rng: () => number
  ): paper.Path[] {
    const paths: paper.Path[] = [];

    const gridToPixel = (point: GridPoint): [number, number] => {
      const x = (point.col * unitSize) - width / 2;
      const y = (point.row * unitSize) - height / 2;
      const vx = (rng() - 0.5) * variation * unitSize;
      const vy = (rng() - 0.5) * variation * unitSize;
      return [x + vx, y + vy];
    };

    for (const stroke of strokes) {
      if (stroke.type === 'dot') {
        const [x, y] = gridToPixel(stroke.start);
        const dot = new paper.Path.Circle({
          center: [x, y],
          radius: unitSize * 0.2,
        });
        dot.fillColor = new paper.Color('black');
        paths.push(dot);
      } else if (stroke.type === 'straight') {
        const [x1, y1] = gridToPixel(stroke.start);
        const [x2, y2] = gridToPixel(stroke.end);
        const path = new paper.Path();
        path.add(new paper.Point(x1, y1));
        path.add(new paper.Point(x2, y2));
        path.strokeColor = new paper.Color('black');
        path.strokeWidth = 1;
        paths.push(path);
      } else if (stroke.type === 'curve') {
        const [x1, y1] = gridToPixel(stroke.start);
        const [x2, y2] = gridToPixel(stroke.end);
        const path = new paper.Path();
        path.add(new paper.Point(x1, y1));

        // Control point perpendicular to stroke direction
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const perpX = -dy;
        const perpY = dx;
        const curvature = unitSize * 0.4 * (stroke.curveDirection === 'left' ? -1 : 1);
        const cx = mx + perpX * curvature / Math.hypot(perpX, perpY);
        const cy = my + perpY * curvature / Math.hypot(perpX, perpY);

        path.cubicCurveTo(
          new paper.Point(cx, cy),
          new paper.Point(cx, cy),
          new paper.Point(x2, y2)
        );
        path.strokeColor = new paper.Color('black');
        path.strokeWidth = 1;
        paths.push(path);
      }
    }

    return paths;
  }

  /**
   * Apply symmetry transformations.
   */
  private applySymmetry(
    paths: paper.Path[],
    symmetry: string
  ): paper.Path[] {
    const allPaths = [...paths];

    if (symmetry === 'horizontal' || symmetry === 'both') {
      for (const path of paths) {
        const mirrored = path.clone();
        mirrored.scale(-1, 1);
        allPaths.push(mirrored);
      }
    }

    if (symmetry === 'vertical' || symmetry === 'both') {
      const pathsToMirror = symmetry === 'both' ? allPaths.slice() : paths;
      for (const path of pathsToMirror) {
        const mirrored = path.clone();
        mirrored.scale(1, -1);
        allPaths.push(mirrored);
      }
    }

    return allPaths;
  }

  /**
   * Merge connected paths into continuous paths for efficient plotting.
   */
  private mergePaths(paths: paper.Path[]): paper.Path[] {
    // Filter out dots (filled circles) - they can't be merged
    const dots = paths.filter(p => p.fillColor !== null && p.fillColor !== undefined);
    const lines = paths.filter(p => p.strokeColor !== null && p.strokeColor !== undefined && !p.closed);

    if (lines.length === 0) {
      return paths;
    }

    const merged: paper.Path[] = [];
    const used = new Set<number>();

    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;

      const chain = new paper.Path();
      chain.strokeColor = new paper.Color('black');
      chain.strokeWidth = 1;

      let current = lines[i];
      used.add(i);

      // Add first path
      for (const segment of current.segments) {
        chain.add(segment.point.clone());
      }

      // Try to extend chain
      let extended = true;
      while (extended) {
        extended = false;
        const endPoint = chain.lastSegment.point;

        for (let j = 0; j < lines.length; j++) {
          if (used.has(j)) continue;

          const candidate = lines[j];
          const startDist = endPoint.getDistance(candidate.firstSegment.point);
          const endDist = endPoint.getDistance(candidate.lastSegment.point);
          const threshold = 1; // pixels

          if (startDist < threshold) {
            // Connect start to chain end
            for (let k = 1; k < candidate.segments.length; k++) {
              chain.add(candidate.segments[k].point.clone());
            }
            used.add(j);
            extended = true;
            break;
          } else if (endDist < threshold) {
            // Connect end to chain end (reverse)
            for (let k = candidate.segments.length - 2; k >= 0; k--) {
              chain.add(candidate.segments[k].point.clone());
            }
            used.add(j);
            extended = true;
            break;
          }
        }
      }

      merged.push(chain);
    }

    return [...merged, ...dots];
  }

  getDefaultParams(): Record<string, any> {
    return {
      unitSize: { min: 1.5, max: 2.5 }, // Reduced for better grid density
      letterFormat: 'square',
      complexity: 0.3, // Lower default for cleaner glyphs
      zoneWeighting: 0.7,
      strokeVariation: 0.1,
      enableDiagonals: true,
      enableCurves: false, // Disabled by default: curves don't follow grid cells precisely
      enableDots: true,
      symmetry: 'none',
    };
  }

  getParamDefinitions(): ParamDefinition[] {
    return [
      {
        name: 'unitSize',
        label: 'Unit Size',
        type: 'minmax',
        min: 0.5,
        max: 20,
        step: 0.5,
        defaultValue: { min: 1.5, max: 2.5 },
        unit: 'mm',
        description: 'Size of each grid unit (larger = bigger glyphs)',
      },
      {
        name: 'letterFormat',
        label: 'Letter Format',
        type: 'select',
        options: ['square', 'tall', 'wide'],
        defaultValue: 'square',
        description: 'Character proportions (consistent sizing)',
      },
      {
        name: 'complexity',
        label: 'Complexity',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.3,
        description: 'Stroke density (0=minimal, 1=complex)',
      },
      {
        name: 'zoneWeighting',
        label: 'Zone Weight',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.1,
        defaultValue: 0.7,
        description: 'Bias toward typographic zones (0=uniform, 1=strict)',
      },
      {
        name: 'strokeVariation',
        label: 'Variation',
        type: 'slider',
        min: 0,
        max: 0.5,
        step: 0.05,
        defaultValue: 0.1,
        description: 'Random stroke position variation',
      },
      {
        name: 'enableDiagonals',
        label: 'Diagonals',
        type: 'checkbox',
        defaultValue: true,
        description: 'Allow diagonal strokes',
      },
      {
        name: 'enableCurves',
        label: 'Curves',
        type: 'checkbox',
        defaultValue: false,
        description: 'Allow curved strokes (may cause overlaps)',
      },
      {
        name: 'enableDots',
        label: 'Dots',
        type: 'checkbox',
        defaultValue: true,
        description: 'Allow decorative dots',
      },
      {
        name: 'symmetry',
        label: 'Symmetry',
        type: 'select',
        options: ['none', 'horizontal', 'vertical', 'both'],
        defaultValue: 'none',
        description: 'Mirror strokes for symmetry',
      },
    ];
  }
}
