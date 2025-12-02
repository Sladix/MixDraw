/**
 * SlotRenderer - Converts template slots to FlowPaths and StandaloneGenerators
 *
 * Handles different fill modes:
 * - single: Creates a StandaloneGenerator at slot center
 * - flowpath: Creates a FlowPath with curve through slot
 * - packed: Creates a FlowPath with packed fill mode
 * - spawn: Creates content that can trigger spawning
 */

import { nanoid } from 'nanoid';
import type {
  FlowPath,
  StandaloneGenerator,
  GeneratorConfig,
  DistributionParams,
  FlowParams
} from '../../types';
import type {
  TemplateSlot,
  GeneratorMatch,
  CompositionLayer
} from '../../types/composition';
import { getDensityForSlot } from './ContentSelector';

// ============================================================================
// Types
// ============================================================================

export interface RenderResult {
  flowPaths: Omit<FlowPath, 'id' | 'layerId'>[];
  standalones: Omit<StandaloneGenerator, 'id' | 'layerId'>[];
}

interface BezierSegment {
  point: { x: number; y: number };
  handleIn: { x: number; y: number } | null;
  handleOut: { x: number; y: number } | null;
}

// ============================================================================
// Curve Generation
// ============================================================================

/**
 * Create a bezier curve for a slot based on its aspect ratio and role.
 * Returns segments in normalized coordinates (0-1).
 */
function createCurveForSlot(slot: TemplateSlot, seed: number): BezierSegment[] {
  const { x, y, width, height } = slot.bounds;
  const aspect = width / height;
  const rng = seededRandom(seed);

  // Choose curve type based on role and aspect
  if (slot.role === 'headline' || slot.role === 'subhead' || aspect > 1.5) {
    // Horizontal text-like curve
    return createHorizontalCurve(x, y, width, height, rng);
  } else if (slot.role === 'sidebar' || aspect < 0.6) {
    // Vertical curve
    return createVerticalCurve(x, y, width, height, rng);
  } else {
    // Organic curve through the center
    return createOrganicCurve(x, y, width, height, rng);
  }
}

/**
 * Create a horizontal curve (for text, wide slots)
 */
function createHorizontalCurve(
  x: number, y: number, width: number, height: number,
  rng: () => number
): BezierSegment[] {
  const segments: BezierSegment[] = [];
  const numPoints = 4 + Math.floor(rng() * 2);
  const centerY = y + height / 2;
  const waveAmplitude = height * 0.15;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const px = x + width * 0.05 + t * width * 0.9;
    const py = centerY + Math.sin(t * Math.PI * 2) * waveAmplitude * (rng() - 0.5);

    segments.push({
      point: { x: px, y: py },
      handleIn: null,
      handleOut: null
    });
  }

  return segments;
}

/**
 * Create a vertical curve (for sidebars, tall slots)
 */
function createVerticalCurve(
  x: number, y: number, width: number, height: number,
  rng: () => number
): BezierSegment[] {
  const segments: BezierSegment[] = [];
  const numPoints = 4 + Math.floor(rng() * 2);
  const centerX = x + width / 2;
  const waveAmplitude = width * 0.2;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const py = y + height * 0.05 + t * height * 0.9;
    const px = centerX + Math.sin(t * Math.PI * 2) * waveAmplitude * (rng() - 0.5);

    segments.push({
      point: { x: px, y: py },
      handleIn: null,
      handleOut: null
    });
  }

  return segments;
}

/**
 * Create an organic flowing curve
 */
function createOrganicCurve(
  x: number, y: number, width: number, height: number,
  rng: () => number
): BezierSegment[] {
  const segments: BezierSegment[] = [];
  const numPoints = 5 + Math.floor(rng() * 2);

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    // Diagonal with noise
    const px = x + width * 0.1 + t * width * 0.8 + (rng() - 0.5) * width * 0.1;
    const py = y + height * 0.1 + t * height * 0.8 + (rng() - 0.5) * height * 0.1;

    segments.push({
      point: { x: px, y: py },
      handleIn: null,
      handleOut: null
    });
  }

  return segments;
}

// Note: createRectangleCurve removed - using createOrganicCurve for packed fills instead

// ============================================================================
// Slot Rendering
// ============================================================================

/**
 * Render a single slot to FlowPaths and/or StandaloneGenerators.
 *
 * @param slot - Template slot to render
 * @param match - Selected generator for this slot
 * @param seed - Random seed
 * @returns RenderResult with flowPaths and standalones
 */
export function renderSlot(
  slot: TemplateSlot,
  match: GeneratorMatch,
  seed: number
): RenderResult {
  switch (slot.fillMode) {
    case 'single':
      return renderSingleSlot(slot, match, seed);
    case 'flowpath':
      return renderFlowPathSlot(slot, match, seed);
    case 'packed':
      return renderPackedSlot(slot, match, seed);
    case 'spawn':
      // Spawn mode renders as single, spawning happens in MagazineComposer
      return renderSingleSlot(slot, match, seed);
    default:
      return { flowPaths: [], standalones: [] };
  }
}

/**
 * Render a slot as a single standalone generator
 */
function renderSingleSlot(
  slot: TemplateSlot,
  match: GeneratorMatch,
  seed: number
): RenderResult {
  const rng = seededRandom(seed);
  const { x, y, width, height } = slot.bounds;

  // Center position with slight random offset
  const centerX = x + width / 2 + (rng() - 0.5) * width * 0.1;
  const centerY = y + height / 2 + (rng() - 0.5) * height * 0.1;

  // Rotation variation
  const rotation = slot.variations?.rotation
    ? lerp(slot.variations.rotation.min, slot.variations.rotation.max, rng())
    : (rng() - 0.5) * 15; // Default ±7.5°

  // Scale based on slot size
  const scale = slot.variations?.sizeMultiplier
    ? lerp(slot.variations.sizeMultiplier.min, slot.variations.sizeMultiplier.max, rng())
    : 1.0;

  const standalone: Omit<StandaloneGenerator, 'id' | 'layerId'> = {
    position: { x: centerX, y: centerY },
    rotation,
    scale,
    generatorType: match.generatorType,
    params: match.params,
    seed: Math.floor(rng() * 100000)
  };

  return { flowPaths: [], standalones: [standalone] };
}

/**
 * Render a slot as a FlowPath with curve
 */
function renderFlowPathSlot(
  slot: TemplateSlot,
  match: GeneratorMatch,
  seed: number
): RenderResult {
  const rng = seededRandom(seed);
  const segments = createCurveForSlot(slot, seed);

  // Calculate spread based on slot dimensions
  const minDim = Math.min(slot.bounds.width, slot.bounds.height);
  const spread = minDim * 0.6; // Spread relative to slot size (normalized)

  const density = getDensityForSlot(slot, seed);

  const generatorConfig: GeneratorConfig = {
    id: nanoid(),
    type: match.generatorType,
    weight: 1,
    params: match.params
  };

  const distributionParams: DistributionParams = {
    mode: 'linear',
    density,
    spacing: [0.8, 1.2],
    seed: Math.floor(rng() * 100000),
    packingMode: 'normal'
  };

  const flowParams: FlowParams = {
    followCurve: slot.role === 'headline' || slot.role === 'subhead' ? 0 : 0.7,
    spread,
    fillMode: 'noise'
  };

  const flowPath: Omit<FlowPath, 'id' | 'layerId'> = {
    bezierCurve: { segments } as any,
    distributionParams,
    flowParams,
    generators: [generatorConfig],
    modifiers: [],
    timelines: []
  };

  return { flowPaths: [flowPath], standalones: [] };
}

/**
 * Render a slot as a packed FlowPath
 */
function renderPackedSlot(
  slot: TemplateSlot,
  match: GeneratorMatch,
  seed: number
): RenderResult {
  const rng = seededRandom(seed);

  // Use organic curve for packed fills (more natural distribution)
  const segments = createOrganicCurve(
    slot.bounds.x, slot.bounds.y,
    slot.bounds.width, slot.bounds.height,
    rng
  );

  // Spread covers the entire slot
  const minDim = Math.min(slot.bounds.width, slot.bounds.height);
  const spread = minDim * 0.8;

  const density = getDensityForSlot(slot, seed);

  const generatorConfig: GeneratorConfig = {
    id: nanoid(),
    type: match.generatorType,
    weight: 1,
    params: match.params
  };

  const distributionParams: DistributionParams = {
    mode: 'linear',
    density,
    spacing: [0.8, 1.2],
    seed: Math.floor(rng() * 100000),
    packingMode: 'normal'
  };

  const flowParams: FlowParams = {
    followCurve: 0.5,
    spread,
    fillMode: 'packed'
  };

  const flowPath: Omit<FlowPath, 'id' | 'layerId'> = {
    bezierCurve: { segments } as any,
    distributionParams,
    flowParams,
    generators: [generatorConfig],
    modifiers: [],
    timelines: []
  };

  return { flowPaths: [flowPath], standalones: [] };
}

// ============================================================================
// Batch Rendering
// ============================================================================

/**
 * Render all slots with their assigned generators.
 *
 * @param slots - Template slots
 * @param matches - Map of slot ID to GeneratorMatch
 * @param baseSeed - Base seed for randomization
 * @returns Map of slot ID to RenderResult
 */
export function renderSlots(
  slots: TemplateSlot[],
  matches: Map<string, GeneratorMatch>,
  baseSeed: number
): Map<string, RenderResult> {
  const results = new Map<string, RenderResult>();

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const match = matches.get(slot.id);

    if (!match) continue;

    const slotSeed = baseSeed + i * 7919; // Different seed per slot
    const result = renderSlot(slot, match, slotSeed);
    results.set(slot.id, result);
  }

  return results;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Simple seeded random number generator
 */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/**
 * Linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Get layer for a slot based on its role
 */
export function getLayerForSlot(slot: TemplateSlot): CompositionLayer {
  // Use explicit layer if specified
  if (slot.layer) return slot.layer;

  // Default based on role
  switch (slot.role) {
    case 'hero':
    case 'headline':
    case 'subhead':
      return 'foreground';
    case 'background':
      return 'background';
    default:
      return 'midground';
  }
}
