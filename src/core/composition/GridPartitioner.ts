/**
 * GridPartitioner - Grid division algorithms for magazine layouts
 *
 * Implements multiple partitioning strategies:
 * - Modular Grid (Swiss design): Equal rows/columns
 * - Golden Ratio: Recursive phi-based division
 * - Rule of Thirds: Classic 3x3 photography grid
 * - Column Grid: Vertical columns for editorial layouts
 */

import { nanoid } from 'nanoid';
import type {
  TemplateSlot,
  SlotRole,
  LayoutGrid,
  GridType,
  CompositionLayer
} from '../../types/composition';

// Golden ratio constant
const PHI = 1.618033988749;

// ============================================================================
// Types
// ============================================================================

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a TemplateSlot with computed properties
 */
function createSlot(
  bounds: Bounds,
  role: SlotRole,
  fillMode: TemplateSlot['fillMode'] = 'flowpath',
  layer?: CompositionLayer
): TemplateSlot {
  return {
    id: nanoid(),
    role,
    bounds: { ...bounds },
    fillMode,
    layer
  };
}

/**
 * Apply margins to get content area bounds
 */
function getContentBounds(grid: LayoutGrid): Bounds {
  return {
    x: grid.margins.left,
    y: grid.margins.top,
    width: 1 - grid.margins.left - grid.margins.right,
    height: 1 - grid.margins.top - grid.margins.bottom
  };
}

/**
 * Get aspect ratio of bounds
 */
function getAspectRatio(bounds: Bounds): number {
  return bounds.width / bounds.height;
}

/**
 * Determine appropriate role based on slot properties
 */
function inferRole(
  bounds: Bounds,
  position: { row: number; col: number; totalRows: number; totalCols: number }
): SlotRole {
  const aspect = getAspectRatio(bounds);
  const area = bounds.width * bounds.height;
  const { row, col, totalRows, totalCols } = position;

  // Large area = hero
  if (area > 0.15) return 'hero';

  // Top row, wide = headline
  if (row === 0 && aspect > 1.5) return 'headline';

  // Very wide = headline or subhead
  if (aspect > 2.5) return row < totalRows / 2 ? 'headline' : 'subhead';

  // Very tall = sidebar
  if (aspect < 0.5) return 'sidebar';

  // Edge columns = sidebar or decoration
  if (col === 0 || col === totalCols - 1) {
    return aspect < 0.8 ? 'sidebar' : 'decoration';
  }

  // Bottom row = decoration or accent
  if (row === totalRows - 1) return 'decoration';

  // Small area = accent
  if (area < 0.05) return 'accent';

  // Default to decoration
  return 'decoration';
}

/**
 * Determine fill mode based on role and aspect ratio
 */
function inferFillMode(role: SlotRole, bounds: Bounds): TemplateSlot['fillMode'] {
  switch (role) {
    case 'hero':
      return 'single';
    case 'headline':
    case 'subhead':
      return 'flowpath'; // Glyphs along a line
    case 'sidebar':
      return 'flowpath'; // Vertical elements
    case 'background':
      return 'packed';
    case 'accent':
      return getAspectRatio(bounds) > 1.2 ? 'flowpath' : 'packed';
    case 'decoration':
    default:
      return 'packed';
  }
}

// ============================================================================
// Modular Grid (Swiss Design)
// ============================================================================

/**
 * Create a modular grid with equal rows and columns.
 * Classic Swiss design approach.
 */
export function partitionModular(grid: LayoutGrid): TemplateSlot[] {
  const slots: TemplateSlot[] = [];
  const content = getContentBounds(grid);
  const cols = grid.columns || 3;
  const rows = grid.rows || 4;
  const gutter = grid.gutter || 0.02;

  const cellWidth = (content.width - gutter * (cols - 1)) / cols;
  const cellHeight = (content.height - gutter * (rows - 1)) / rows;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const bounds: Bounds = {
        x: content.x + col * (cellWidth + gutter),
        y: content.y + row * (cellHeight + gutter),
        width: cellWidth,
        height: cellHeight
      };

      const role = inferRole(bounds, { row, col, totalRows: rows, totalCols: cols });
      const fillMode = inferFillMode(role, bounds);

      slots.push(createSlot(bounds, role, fillMode));
    }
  }

  return mergeAdjacentHeroSlots(slots);
}

/**
 * Merge adjacent slots that are both 'hero' role into a single larger slot
 */
function mergeAdjacentHeroSlots(slots: TemplateSlot[]): TemplateSlot[] {
  // For now, just ensure only one hero exists by promoting the largest
  const heroSlots = slots.filter(s => s.role === 'hero');

  if (heroSlots.length <= 1) return slots;

  // Find the largest hero slot
  const largest = heroSlots.reduce((a, b) =>
    (a.bounds.width * a.bounds.height) > (b.bounds.width * b.bounds.height) ? a : b
  );

  // Demote other heroes to decoration
  return slots.map(slot => {
    if (slot.role === 'hero' && slot.id !== largest.id) {
      return { ...slot, role: 'decoration' as SlotRole, fillMode: 'packed' as const };
    }
    return slot;
  });
}

// ============================================================================
// Golden Ratio Grid
// ============================================================================

/**
 * Create a golden ratio grid with recursive phi-based divisions.
 * Creates visually balanced, organic-feeling layouts.
 */
export function partitionGoldenRatio(
  grid: LayoutGrid,
  bounds?: Bounds,
  depth?: number,
  orientation?: 'horizontal' | 'vertical'
): TemplateSlot[] {
  const content = bounds || getContentBounds(grid);
  const maxDepth = grid.goldenDepth || 4;
  const currentDepth = depth ?? maxDepth;
  const orient = orientation ?? grid.goldenOrientation ?? 'horizontal';

  // Base case: create a slot at this level
  if (currentDepth === 0) {
    const role = inferRoleFromDepth(content, maxDepth, currentDepth);
    return [createSlot(content, role, inferFillMode(role, content))];
  }

  const slots: TemplateSlot[] = [];

  if (orient === 'horizontal' || orient === 'alternating') {
    const actualOrient = orient === 'alternating' ? 'horizontal' : orient;
    const splitPoint = content.width / PHI;

    // Larger region (left)
    const largerBounds: Bounds = {
      x: content.x,
      y: content.y,
      width: splitPoint,
      height: content.height
    };

    // Smaller region (right)
    const smallerBounds: Bounds = {
      x: content.x + splitPoint,
      y: content.y,
      width: content.width - splitPoint,
      height: content.height
    };

    // Recurse on larger, create slot for smaller
    const nextOrient = orient === 'alternating' ? 'vertical' : actualOrient;
    slots.push(...partitionGoldenRatio(grid, largerBounds, currentDepth - 1, nextOrient));

    const role = inferRoleFromDepth(smallerBounds, maxDepth, currentDepth);
    slots.push(createSlot(smallerBounds, role, inferFillMode(role, smallerBounds)));

  } else {
    // Vertical split
    const splitPoint = content.height / PHI;

    const largerBounds: Bounds = {
      x: content.x,
      y: content.y,
      width: content.width,
      height: splitPoint
    };

    const smallerBounds: Bounds = {
      x: content.x,
      y: content.y + splitPoint,
      width: content.width,
      height: content.height - splitPoint
    };

    const nextOrient = grid.goldenOrientation === 'alternating' ? 'horizontal' : 'vertical';
    slots.push(...partitionGoldenRatio(grid, largerBounds, currentDepth - 1, nextOrient));

    const role = inferRoleFromDepth(smallerBounds, maxDepth, currentDepth);
    slots.push(createSlot(smallerBounds, role, inferFillMode(role, smallerBounds)));
  }

  return slots;
}

/**
 * Infer role based on recursion depth in golden ratio
 */
function inferRoleFromDepth(bounds: Bounds, maxDepth: number, currentDepth: number): SlotRole {
  const area = bounds.width * bounds.height;
  const aspect = getAspectRatio(bounds);

  // Deepest levels (largest areas) = hero
  if (currentDepth >= maxDepth - 1 && area > 0.1) return 'hero';

  // Second level = headline or sidebar based on aspect
  if (currentDepth >= maxDepth - 2) {
    if (aspect > 1.5) return 'headline';
    if (aspect < 0.7) return 'sidebar';
    return 'decoration';
  }

  // Upper levels = decoration or accent
  if (area < 0.05) return 'accent';
  return 'decoration';
}

// ============================================================================
// Rule of Thirds
// ============================================================================

/**
 * Create a classic rule of thirds grid (3x3).
 * Intersection points are natural focal points.
 */
export function partitionRuleOfThirds(grid: LayoutGrid): TemplateSlot[] {
  const content = getContentBounds(grid);
  const cellWidth = content.width / 3;
  const cellHeight = content.height / 3;
  const slots: TemplateSlot[] = [];

  // Define role map: power points get hero/headline
  const roleMap: SlotRole[][] = [
    ['headline', 'headline', 'accent'],
    ['hero', 'hero', 'sidebar'],
    ['decoration', 'subhead', 'decoration']
  ];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const bounds: Bounds = {
        x: content.x + col * cellWidth,
        y: content.y + row * cellHeight,
        width: cellWidth,
        height: cellHeight
      };

      const role = roleMap[row][col];
      const fillMode = inferFillMode(role, bounds);

      slots.push(createSlot(bounds, role, fillMode));
    }
  }

  // Merge center hero cells into one large hero
  return mergeHeroCenter(slots);
}

/**
 * Merge center cells marked as hero into a single large hero
 */
function mergeHeroCenter(slots: TemplateSlot[]): TemplateSlot[] {
  const heroSlots = slots.filter(s => s.role === 'hero');

  if (heroSlots.length < 2) return slots;

  // Calculate merged bounds
  const minX = Math.min(...heroSlots.map(s => s.bounds.x));
  const minY = Math.min(...heroSlots.map(s => s.bounds.y));
  const maxX = Math.max(...heroSlots.map(s => s.bounds.x + s.bounds.width));
  const maxY = Math.max(...heroSlots.map(s => s.bounds.y + s.bounds.height));

  const mergedBounds: Bounds = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };

  // Remove hero slots and add merged one
  const nonHeroSlots = slots.filter(s => s.role !== 'hero');
  nonHeroSlots.push(createSlot(mergedBounds, 'hero', 'single'));

  return nonHeroSlots;
}

// ============================================================================
// Column Grid
// ============================================================================

/**
 * Create a column-based grid for editorial layouts.
 * Columns can span multiple rows.
 */
export function partitionColumn(grid: LayoutGrid): TemplateSlot[] {
  const content = getContentBounds(grid);
  const cols = grid.columns || 4;
  const gutter = grid.gutter || 0.02;
  const slots: TemplateSlot[] = [];

  const colWidth = (content.width - gutter * (cols - 1)) / cols;

  // Create varied column heights
  for (let col = 0; col < cols; col++) {
    const x = content.x + col * (colWidth + gutter);

    // Vary column structure
    if (col === 0) {
      // First column: sidebar (full height)
      slots.push(createSlot(
        { x, y: content.y, width: colWidth, height: content.height },
        'sidebar',
        'flowpath'
      ));
    } else if (col === cols - 1) {
      // Last column: accent (full height)
      slots.push(createSlot(
        { x, y: content.y, width: colWidth, height: content.height },
        'decoration',
        'packed'
      ));
    } else {
      // Middle columns: split into header + content
      const headerHeight = content.height * 0.15;

      // Header row
      slots.push(createSlot(
        { x, y: content.y, width: colWidth, height: headerHeight },
        col === 1 ? 'headline' : 'subhead',
        'flowpath'
      ));

      // Main content
      slots.push(createSlot(
        { x, y: content.y + headerHeight + gutter, width: colWidth, height: content.height - headerHeight - gutter },
        col === 1 ? 'hero' : 'decoration',
        col === 1 ? 'single' : 'packed'
      ));
    }
  }

  return slots;
}

// ============================================================================
// Main Partitioner
// ============================================================================

/**
 * Partition a canvas using the specified grid type.
 *
 * @param grid - Grid configuration
 * @returns Array of template slots
 */
export function partitionGrid(grid: LayoutGrid): TemplateSlot[] {
  switch (grid.type) {
    case 'modular':
      return partitionModular(grid);
    case 'golden-ratio':
      return partitionGoldenRatio(grid);
    case 'rule-of-thirds':
      return partitionRuleOfThirds(grid);
    case 'column':
      return partitionColumn(grid);
    case 'custom':
      // Custom grids should provide their own slots
      return [];
    default:
      return partitionModular(grid);
  }
}

/**
 * Create a default grid configuration
 */
export function createDefaultGrid(type: GridType = 'golden-ratio'): LayoutGrid {
  const baseMargins = { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 };

  switch (type) {
    case 'modular':
      return {
        type: 'modular',
        columns: 3,
        rows: 4,
        gutter: 0.02,
        margins: baseMargins
      };
    case 'golden-ratio':
      return {
        type: 'golden-ratio',
        goldenDepth: 4,
        goldenOrientation: 'alternating',
        margins: baseMargins
      };
    case 'rule-of-thirds':
      return {
        type: 'rule-of-thirds',
        margins: baseMargins
      };
    case 'column':
      return {
        type: 'column',
        columns: 4,
        gutter: 0.02,
        margins: baseMargins
      };
    default:
      return {
        type: 'modular',
        columns: 3,
        rows: 3,
        gutter: 0.02,
        margins: baseMargins
      };
  }
}

/**
 * Generate a random grid configuration
 */
export function generateRandomGrid(seed: number): LayoutGrid {
  // Simple seeded random
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff);
  };

  const types: GridType[] = ['modular', 'golden-ratio', 'rule-of-thirds', 'column'];
  const type = types[Math.floor(rng() * types.length)];

  const margin = 0.03 + rng() * 0.04; // 3-7% margins
  const margins = { top: margin, right: margin, bottom: margin, left: margin };

  switch (type) {
    case 'modular':
      return {
        type: 'modular',
        columns: 2 + Math.floor(rng() * 3), // 2-4 columns
        rows: 3 + Math.floor(rng() * 3),    // 3-5 rows
        gutter: 0.01 + rng() * 0.02,        // 1-3% gutter
        margins
      };
    case 'golden-ratio':
      return {
        type: 'golden-ratio',
        goldenDepth: 3 + Math.floor(rng() * 2), // 3-4 depth
        goldenOrientation: rng() < 0.7 ? 'alternating' : (rng() < 0.5 ? 'horizontal' : 'vertical'),
        margins
      };
    case 'rule-of-thirds':
      return {
        type: 'rule-of-thirds',
        margins
      };
    case 'column':
      return {
        type: 'column',
        columns: 3 + Math.floor(rng() * 2), // 3-4 columns
        gutter: 0.01 + rng() * 0.02,
        margins
      };
    default:
      return createDefaultGrid();
  }
}
