/**
 * Magazine Cover Composition System Types
 *
 * Defines types for template-based magazine cover generation with:
 * - Semantic slot roles (hero, headline, decoration, etc.)
 * - Grid partitioning algorithms
 * - Role-based layer mapping for plotter pen changes
 */

// ============================================================================
// Slot Roles & Fill Modes
// ============================================================================

/**
 * Semantic role for a slot in a magazine composition.
 * Determines content selection and layer assignment.
 */
export type SlotRole =
  | 'hero'       // Main subject (1 large shape)
  | 'headline'   // Primary text/glyph area
  | 'subhead'    // Secondary text area
  | 'decoration' // Decorative fill patterns
  | 'sidebar'    // Vertical accent region
  | 'background' // Full-area background pattern
  | 'accent';    // Small highlighted accent

/**
 * How content fills a slot
 */
export type SlotFillMode =
  | 'single'    // One standalone generator instance
  | 'flowpath'  // FlowPath with curve through slot
  | 'packed'    // FlowPath with packed fill mode
  | 'spawn';    // Triggers 1-level spawning after placement

/**
 * Layer assignment for role-based plotter pen mapping
 */
export type CompositionLayer = 'background' | 'midground' | 'foreground';

// ============================================================================
// Template Slot
// ============================================================================

/**
 * A single slot within a composition template.
 * Defines position, content type, and generator constraints.
 */
export interface TemplateSlot {
  id: string;
  role: SlotRole;

  /**
   * Bounding box in normalized coordinates (0-1).
   * Will be scaled to actual canvas dimensions during rendering.
   */
  bounds: {
    x: number;      // Left edge (0-1)
    y: number;      // Top edge (0-1)
    width: number;  // Width fraction (0-1)
    height: number; // Height fraction (0-1)
  };

  /** How this slot should be filled with content */
  fillMode: SlotFillMode;

  // Generator constraints
  /** Only use generators with these tags */
  allowedTags?: string[];
  /** Exclude generators with these tags */
  excludedTags?: string[];
  /** Specific generator types to prefer */
  preferredGenerators?: string[];

  // Variation ranges
  variations?: {
    /** Scale multiplier range for generated shapes */
    sizeMultiplier?: { min: number; max: number };
    /** Density range for flowpath/packed fills */
    density?: { min: number; max: number };
    /** Rotation range in degrees */
    rotation?: { min: number; max: number };
  };

  /** Layer assignment (defaults based on role if not specified) */
  layer?: CompositionLayer;

  /** Whether this slot can be skipped */
  optional?: boolean;
  /** Probability to skip this slot (0-1) */
  skipProbability?: number;

  /** Spawning configuration for 'spawn' fill mode */
  spawnConfig?: SpawnConfig;
}

/**
 * Configuration for 1-level spawning.
 * When a hero shape is placed, empty space around it can spawn decorations.
 */
export interface SpawnConfig {
  /** Probability that spawning occurs (0-1) */
  probability: number;
  /** Minimum area (normalized) for a spawn region */
  minRegionArea?: number;
  /** Roles that can be spawned */
  spawnRoles?: SlotRole[];
}

// ============================================================================
// Composition Template
// ============================================================================

/**
 * A complete layout template for magazine cover composition.
 */
export interface CompositionTemplate {
  id: string;
  name: string;
  description: string;

  /** Category for filtering templates */
  category?: 'magazine' | 'poster' | 'minimal' | 'complex';
  /** Tags for searching/filtering */
  tags?: string[];

  /** Slot definitions for this template */
  slots: TemplateSlot[];

  /** Template-level settings */
  settings?: {
    /** Default density for flowpath fills */
    globalDensity?: number;
    /** Stroke width range in mm */
    strokeWidthRange?: { min: number; max: number };
  };

  /** Randomization options */
  variations?: {
    /** How much to jitter slot positions (0-1) */
    slotPositionJitter?: number;
    /** How much to jitter slot sizes (0-1) */
    slotSizeJitter?: number;
    /** Minimum number of active slots */
    minActiveSlots?: number;
  };
}

// ============================================================================
// Grid Partitioning
// ============================================================================

/**
 * Grid division algorithm type
 */
export type GridType =
  | 'modular'        // Equal rows/columns (Swiss design)
  | 'golden-ratio'   // Phi-based recursive division
  | 'rule-of-thirds' // 3x3 grid
  | 'column'         // Vertical columns
  | 'custom';        // User-defined

/**
 * Configuration for grid-based layout generation.
 * Used by the "random" template option.
 */
export interface LayoutGrid {
  type: GridType;

  // Modular/column grid settings
  columns?: number;
  rows?: number;
  gutter?: number; // Gap between cells (normalized 0-1)

  // Golden ratio settings
  goldenDepth?: number; // Recursion depth for golden divisions
  goldenOrientation?: 'horizontal' | 'vertical' | 'alternating';

  // Margins (normalized 0-1)
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

// ============================================================================
// Composition Result
// ============================================================================

/**
 * Result of composition generation.
 * Contains layers with FlowPaths and StandaloneGenerators ready for rendering.
 */
export interface CompositionResult {
  /** Generated layers (background, midground, foreground) */
  layers: CompositionLayerData[];
  /** Metadata about the generation */
  metadata: {
    templateId: string;
    templateName: string;
    seed: number;
    slotsUsed: string[];
    generatorsUsed: string[];
  };
}

/**
 * Data for a single composition layer
 */
export interface CompositionLayerData {
  id: string;
  name: string;
  role: CompositionLayer;
  color: string;
  strokeWidth: number;
  flowPathIds: string[];
  standaloneIds: string[];
}

// ============================================================================
// Generator Matching
// ============================================================================

/**
 * Criteria for selecting a generator for a slot
 */
export interface GeneratorCriteria {
  role: SlotRole;
  aspectRatio: number;
  area: number;
  allowedTags?: string[];
  excludedTags?: string[];
  preferredGenerators?: string[];
}

/**
 * Result of generator selection
 */
export interface GeneratorMatch {
  generatorType: string;
  score: number;
  params: Record<string, any>;
  reason?: string;
}

// ============================================================================
// Layer Configuration
// ============================================================================

/**
 * Default layer configuration for role-based plotter pen mapping
 */
export const COMPOSITION_LAYER_CONFIG: Record<CompositionLayer, {
  roles: SlotRole[];
  strokeWidth: number;
  defaultColor: string;
}> = {
  background: {
    roles: ['background'],
    strokeWidth: 0.2,
    defaultColor: '#888888'
  },
  midground: {
    roles: ['decoration', 'sidebar', 'accent'],
    strokeWidth: 0.3,
    defaultColor: '#444444'
  },
  foreground: {
    roles: ['hero', 'headline', 'subhead'],
    strokeWidth: 0.35,
    defaultColor: '#000000'
  }
};

/**
 * Get the default layer for a slot role
 */
export function getDefaultLayerForRole(role: SlotRole): CompositionLayer {
  for (const [layer, config] of Object.entries(COMPOSITION_LAYER_CONFIG)) {
    if (config.roles.includes(role)) {
      return layer as CompositionLayer;
    }
  }
  return 'midground'; // fallback
}

// ============================================================================
// Role Tag Preferences
// ============================================================================

/**
 * Default tag preferences for each role.
 * Used by ContentSelector when no explicit tags are specified.
 */
export const ROLE_TAG_PREFERENCES: Record<SlotRole, {
  preferredTags: string[];
  defaultGenerator: string;
}> = {
  hero: {
    preferredTags: ['character', 'organic', 'silhouette', 'figure'],
    defaultGenerator: 'silhouette'
  },
  headline: {
    preferredTags: ['calligraphy', 'geometric', 'character'],
    defaultGenerator: 'glyph'
  },
  subhead: {
    preferredTags: ['calligraphy', 'geometric'],
    defaultGenerator: 'glyph'
  },
  decoration: {
    preferredTags: ['nature', 'plant', 'organic'],
    defaultGenerator: 'leaf'
  },
  sidebar: {
    preferredTags: ['plant', 'nature', 'organic'],
    defaultGenerator: 'grass'
  },
  background: {
    preferredTags: ['geometric', 'nature'],
    defaultGenerator: 'polygon'
  },
  accent: {
    preferredTags: ['geometric', 'character', 'animal'],
    defaultGenerator: 'bird'
  }
};
