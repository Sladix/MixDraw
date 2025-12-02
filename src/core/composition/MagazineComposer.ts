/**
 * MagazineComposer - Main orchestrator for magazine cover composition
 *
 * Coordinates:
 * 1. Template selection (predefined or procedural)
 * 2. Slot randomization
 * 3. Content selection (generator matching)
 * 4. Slot rendering (FlowPaths/Standalones)
 * 5. Layer creation
 * 6. Spawning (1-level)
 */

import { nanoid } from 'nanoid';
import type {
  Layer,
  FlowPath,
  StandaloneGenerator,
  BrushEffect
} from '../../types';
import type {
  CompositionTemplate,
  TemplateSlot,
  CompositionLayer,
  GeneratorMatch
} from '../../types/composition';
import { COMPOSITION_LAYER_CONFIG } from '../../types/composition';
import { MAGAZINE_TEMPLATES, getTemplateById } from '../../data/magazineTemplates';
import { partitionGrid, generateRandomGrid } from './GridPartitioner';
import { selectGeneratorsForSlots } from './ContentSelector';
import { renderSlots, getLayerForSlot } from './SlotRenderer';

// ============================================================================
// Types
// ============================================================================

export interface ComposerOptions {
  /** Template ID or 'random' for procedural generation */
  templateId: string;
  /** Random seed for reproducibility */
  seed: number;
  /** Enable spawning (1-level) */
  enableSpawning?: boolean;
}

export interface ComposedLayers {
  /** Generated layers with content */
  layers: Layer[];
  /** Metadata about the composition */
  metadata: {
    templateId: string;
    templateName: string;
    seed: number;
    slotCount: number;
    generatorTypes: string[];
  };
}

// ============================================================================
// Layer Creation
// ============================================================================

const DEFAULT_BRUSH_EFFECT: BrushEffect = {
  enabled: false,
  fadeStart: 0.7,
  fadeEnd: 1.0
};

/**
 * Create the three composition layers (background, midground, foreground)
 */
function createCompositionLayers(templateName: string): Map<CompositionLayer, Layer> {
  const layers = new Map<CompositionLayer, Layer>();

  const layerOrder: CompositionLayer[] = ['background', 'midground', 'foreground'];

  for (let i = 0; i < layerOrder.length; i++) {
    const role = layerOrder[i];
    const config = COMPOSITION_LAYER_CONFIG[role];

    const layer: Layer = {
      id: `comp-${role}-${nanoid(8)}`,
      name: `${templateName} - ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      color: config.defaultColor,
      strokeWidth: config.strokeWidth,
      visible: true,
      locked: false,
      order: i,
      brushEffect: DEFAULT_BRUSH_EFFECT,
      flowPaths: [],
      standaloneGenerators: []
    };

    layers.set(role, layer);
  }

  return layers;
}

// ============================================================================
// Slot Processing
// ============================================================================

/**
 * Filter slots based on optional skip probability
 */
function filterOptionalSlots(slots: TemplateSlot[], seed: number): TemplateSlot[] {
  const rng = seededRandom(seed);

  return slots.filter(slot => {
    if (!slot.optional) return true;
    const skipChance = slot.skipProbability ?? 0.5;
    return rng() > skipChance;
  });
}

/**
 * Apply position/size jitter to slots
 */
function applySlotJitter(
  slots: TemplateSlot[],
  variations: CompositionTemplate['variations'],
  seed: number
): TemplateSlot[] {
  if (!variations) return slots;

  const rng = seededRandom(seed);
  const posJitter = variations.slotPositionJitter ?? 0;
  const sizeJitter = variations.slotSizeJitter ?? 0;

  return slots.map(slot => ({
    ...slot,
    bounds: {
      x: clamp(slot.bounds.x + (rng() - 0.5) * posJitter, 0, 1 - slot.bounds.width),
      y: clamp(slot.bounds.y + (rng() - 0.5) * posJitter, 0, 1 - slot.bounds.height),
      width: clamp(slot.bounds.width * (1 + (rng() - 0.5) * sizeJitter), 0.05, 1),
      height: clamp(slot.bounds.height * (1 + (rng() - 0.5) * sizeJitter), 0.05, 1)
    }
  }));
}

// ============================================================================
// Main Composer
// ============================================================================

/**
 * Generate a magazine cover composition.
 *
 * @param options - Composer options (template, seed, etc.)
 * @returns ComposedLayers with generated layers and metadata
 */
export function composeMagazineCover(options: ComposerOptions): ComposedLayers {
  const { templateId, seed, enableSpawning = true } = options;

  // Step 1: Get or generate template
  let template: CompositionTemplate;
  let slots: TemplateSlot[];

  if (templateId === 'random') {
    // Generate procedural template
    const grid = generateRandomGrid(seed);
    slots = partitionGrid(grid);
    template = {
      id: 'random',
      name: 'Random',
      description: 'Procedurally generated layout',
      slots
    };
  } else {
    // Use predefined template
    const found = getTemplateById(templateId);
    if (!found) {
      throw new Error(`Template not found: ${templateId}`);
    }
    template = found;
    slots = [...template.slots];
  }

  // Step 2: Process slots (filter optional, apply jitter)
  slots = filterOptionalSlots(slots, seed);
  slots = applySlotJitter(slots, template.variations, seed + 1000);

  // Step 3: Select generators for each slot
  const generatorMatches = selectGeneratorsForSlots(slots, seed + 2000);

  // Step 4: Create composition layers
  const layerMap = createCompositionLayers(template.name);

  // Step 5: Render slots to FlowPaths/Standalones
  const renderResults = renderSlots(slots, generatorMatches, seed + 3000);

  // Step 6: Assign rendered content to layers
  const spawnTargets: { slot: TemplateSlot; match: GeneratorMatch; layer: Layer }[] = [];

  for (const slot of slots) {
    const result = renderResults.get(slot.id);
    if (!result) continue;

    const layerRole = getLayerForSlot(slot);
    const layer = layerMap.get(layerRole);
    if (!layer) continue;

    // Add FlowPaths
    for (const fp of result.flowPaths) {
      const flowPath: FlowPath = {
        id: `flowpath-${nanoid(8)}`,
        layerId: layer.id,
        ...fp
      };
      layer.flowPaths.push(flowPath);
    }

    // Add StandaloneGenerators
    for (const sg of result.standalones) {
      const standalone: StandaloneGenerator = {
        id: `standalone-${nanoid(8)}`,
        layerId: layer.id,
        ...sg
      };
      layer.standaloneGenerators.push(standalone);
    }

    // Track spawn targets
    if (enableSpawning && slot.fillMode === 'spawn' && slot.spawnConfig) {
      const match = generatorMatches.get(slot.id);
      if (match) {
        spawnTargets.push({ slot, match, layer });
      }
    }
  }

  // Step 7: Process spawning (1-level)
  if (enableSpawning && spawnTargets.length > 0) {
    processSpawning(spawnTargets, layerMap, seed + 4000);
  }

  // Build metadata
  const generatorTypes = new Set<string>();
  for (const [, match] of generatorMatches) {
    generatorTypes.add(match.generatorType);
  }

  return {
    layers: Array.from(layerMap.values()),
    metadata: {
      templateId: template.id,
      templateName: template.name,
      seed,
      slotCount: slots.length,
      generatorTypes: Array.from(generatorTypes)
    }
  };
}

// ============================================================================
// Spawning (1-Level)
// ============================================================================

/**
 * Process spawning for hero slots.
 * Finds empty regions around the hero and spawns decorations.
 */
function processSpawning(
  spawnTargets: { slot: TemplateSlot; match: GeneratorMatch; layer: Layer }[],
  layerMap: Map<CompositionLayer, Layer>,
  seed: number
): void {
  const rng = seededRandom(seed);
  const midgroundLayer = layerMap.get('midground');
  if (!midgroundLayer) return;

  for (const { slot } of spawnTargets) {
    const config = slot.spawnConfig;
    if (!config) continue;

    // Check spawn probability
    if (rng() > config.probability) continue;

    // Find empty regions around the slot
    const emptyRegions = findEmptyRegions(slot.bounds, config.minRegionArea ?? 0.02);

    // Spawn decorations in empty regions
    for (const region of emptyRegions) {
      const spawnSeed = seed + Math.floor(rng() * 100000);

      // Create a decoration slot for this region
      const spawnSlot: TemplateSlot = {
        id: nanoid(),
        role: config.spawnRoles?.[Math.floor(rng() * (config.spawnRoles?.length || 1))] || 'decoration',
        bounds: region,
        fillMode: 'packed',
        allowedTags: ['nature', 'geometric'],
        layer: 'midground'
      };

      // Select generator for spawn
      const spawnMatches = selectGeneratorsForSlots([spawnSlot], spawnSeed);
      const spawnMatch = spawnMatches.get(spawnSlot.id);
      if (!spawnMatch) continue;

      // Render spawn slot
      const spawnResults = renderSlots([spawnSlot], spawnMatches, spawnSeed);
      const spawnResult = spawnResults.get(spawnSlot.id);
      if (!spawnResult) continue;

      // Add to midground layer
      for (const fp of spawnResult.flowPaths) {
        const flowPath: FlowPath = {
          id: `spawn-flowpath-${nanoid(8)}`,
          layerId: midgroundLayer.id,
          ...fp
        };
        midgroundLayer.flowPaths.push(flowPath);
      }

      for (const sg of spawnResult.standalones) {
        const standalone: StandaloneGenerator = {
          id: `spawn-standalone-${nanoid(8)}`,
          layerId: midgroundLayer.id,
          ...sg
        };
        midgroundLayer.standaloneGenerators.push(standalone);
      }
    }
  }
}

/**
 * Find empty rectangular regions around a hero bounds.
 * Returns regions that are large enough for spawning.
 */
function findEmptyRegions(
  heroBounds: TemplateSlot['bounds'],
  minArea: number
): TemplateSlot['bounds'][] {
  const regions: TemplateSlot['bounds'][] = [];
  const { x, y, width, height } = heroBounds;

  // Left region
  if (x > 0.1) {
    const left = { x: 0.02, y, width: x - 0.04, height };
    if (left.width * left.height >= minArea) {
      regions.push(left);
    }
  }

  // Right region
  const heroRight = x + width;
  if (heroRight < 0.9) {
    const right = { x: heroRight + 0.02, y, width: 0.96 - heroRight, height };
    if (right.width * right.height >= minArea) {
      regions.push(right);
    }
  }

  // Top region
  if (y > 0.1) {
    const top = { x, y: 0.02, width, height: y - 0.04 };
    if (top.width * top.height >= minArea) {
      regions.push(top);
    }
  }

  // Bottom region
  const heroBottom = y + height;
  if (heroBottom < 0.9) {
    const bottom = { x, y: heroBottom + 0.02, width, height: 0.96 - heroBottom };
    if (bottom.width * bottom.height >= minArea) {
      regions.push(bottom);
    }
  }

  return regions;
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
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get all available template options for UI
 */
export function getTemplateOptions(): { id: string; name: string; description: string }[] {
  const options = MAGAZINE_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description
  }));

  // Add random option
  options.unshift({
    id: 'random',
    name: 'Random',
    description: 'Procedurally generated layout'
  });

  return options;
}

/**
 * Quick compose with defaults
 */
export function quickCompose(seed: number = Date.now()): ComposedLayers {
  return composeMagazineCover({
    templateId: 'random',
    seed
  });
}
