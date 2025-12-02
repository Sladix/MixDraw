/**
 * Magazine Cover Templates
 *
 * 10 predefined layout templates for magazine cover composition:
 * 1. Centered Hero - Large central subject with decorative borders
 * 2. Sidebar + Main - Vertical sidebar with main area
 * 3. Triptych - Three vertical panels
 * 4. Golden Ratio - Fibonacci-inspired recursive divisions
 * 5. Frame - Decorative border framing central subject
 * 6. Stacked Bands - Horizontal bands with varying content
 * 7. Scattered - Organic scattered elements
 * 8. Minimal - Single hero, maximum whitespace
 * 9. Dense Editorial - Modular grid, many small cells
 * 10. Random - Procedurally generated using grid algorithms
 */

import type { CompositionTemplate, TemplateSlot } from '../types/composition';

// ============================================================================
// Template 1: Centered Hero
// ============================================================================

export const TEMPLATE_CENTERED_HERO: CompositionTemplate = {
  id: 'centered-hero',
  name: 'Centered Hero',
  description: 'Large central subject with decorative borders',
  category: 'magazine',
  tags: ['classic', 'focused', 'minimal'],
  slots: [
    {
      id: 'hero',
      role: 'hero',
      bounds: { x: 0.15, y: 0.2, width: 0.7, height: 0.5 },
      fillMode: 'single',
      allowedTags: ['character', 'organic', 'silhouette'],
      layer: 'foreground'
    },
    {
      id: 'title-zone',
      role: 'headline',
      bounds: { x: 0.1, y: 0.05, width: 0.8, height: 0.1 },
      fillMode: 'flowpath',
      preferredGenerators: ['glyph'],
      layer: 'foreground'
    },
    {
      id: 'accent-left',
      role: 'accent',
      bounds: { x: 0.02, y: 0.3, width: 0.1, height: 0.4 },
      fillMode: 'packed',
      allowedTags: ['geometric', 'plant'],
      optional: true,
      skipProbability: 0.3,
      layer: 'midground'
    },
    {
      id: 'accent-right',
      role: 'accent',
      bounds: { x: 0.88, y: 0.3, width: 0.1, height: 0.4 },
      fillMode: 'packed',
      allowedTags: ['geometric', 'plant'],
      optional: true,
      skipProbability: 0.3,
      layer: 'midground'
    },
    {
      id: 'footer',
      role: 'decoration',
      bounds: { x: 0, y: 0.85, width: 1, height: 0.15 },
      fillMode: 'flowpath',
      allowedTags: ['nature', 'plant'],
      layer: 'background'
    }
  ],
  settings: { globalDensity: 0.5 },
  variations: { slotPositionJitter: 0.02, minActiveSlots: 3 }
};

// ============================================================================
// Template 2: Sidebar + Main
// ============================================================================

export const TEMPLATE_SIDEBAR_MAIN: CompositionTemplate = {
  id: 'sidebar-main',
  name: 'Sidebar + Main',
  description: 'Vertical sidebar with large main area',
  category: 'magazine',
  tags: ['editorial', 'asymmetric'],
  slots: [
    {
      id: 'sidebar',
      role: 'sidebar',
      bounds: { x: 0, y: 0, width: 0.22, height: 1 },
      fillMode: 'flowpath',
      allowedTags: ['plant', 'organic'],
      layer: 'midground'
    },
    {
      id: 'main-hero',
      role: 'hero',
      bounds: { x: 0.28, y: 0.18, width: 0.65, height: 0.55 },
      fillMode: 'single',
      allowedTags: ['character', 'animal', 'organic'],
      layer: 'foreground'
    },
    {
      id: 'title',
      role: 'headline',
      bounds: { x: 0.28, y: 0.03, width: 0.65, height: 0.1 },
      fillMode: 'flowpath',
      preferredGenerators: ['glyph'],
      layer: 'foreground'
    },
    {
      id: 'footer-accent',
      role: 'decoration',
      bounds: { x: 0.28, y: 0.78, width: 0.65, height: 0.18 },
      fillMode: 'packed',
      allowedTags: ['geometric', 'nature'],
      optional: true,
      layer: 'midground'
    }
  ],
  settings: { globalDensity: 0.4 }
};

// ============================================================================
// Template 3: Triptych
// ============================================================================

export const TEMPLATE_TRIPTYCH: CompositionTemplate = {
  id: 'triptych',
  name: 'Triptych',
  description: 'Three vertical panels',
  category: 'magazine',
  tags: ['classic', 'balanced', 'grid'],
  slots: [
    {
      id: 'panel-left',
      role: 'decoration',
      bounds: { x: 0.02, y: 0.1, width: 0.28, height: 0.8 },
      fillMode: 'flowpath',
      allowedTags: ['nature', 'plant'],
      layer: 'midground'
    },
    {
      id: 'panel-center',
      role: 'hero',
      bounds: { x: 0.35, y: 0.05, width: 0.3, height: 0.9 },
      fillMode: 'single',
      allowedTags: ['character', 'organic', 'silhouette'],
      layer: 'foreground'
    },
    {
      id: 'panel-right',
      role: 'decoration',
      bounds: { x: 0.7, y: 0.1, width: 0.28, height: 0.8 },
      fillMode: 'flowpath',
      allowedTags: ['nature', 'plant'],
      layer: 'midground'
    }
  ],
  settings: { globalDensity: 0.35 }
};

// ============================================================================
// Template 4: Golden Ratio
// ============================================================================

export const TEMPLATE_GOLDEN_RATIO: CompositionTemplate = {
  id: 'golden-ratio',
  name: 'Golden Ratio',
  description: 'Fibonacci-inspired layout with phi proportions',
  category: 'magazine',
  tags: ['mathematical', 'elegant', 'classic'],
  slots: [
    {
      id: 'phi-main',
      role: 'hero',
      bounds: { x: 0.03, y: 0.03, width: 0.58, height: 0.94 },
      fillMode: 'single',
      allowedTags: ['organic', 'character', 'silhouette'],
      layer: 'foreground'
    },
    {
      id: 'phi-top-right',
      role: 'headline',
      bounds: { x: 0.64, y: 0.03, width: 0.33, height: 0.35 },
      fillMode: 'flowpath',
      preferredGenerators: ['glyph'],
      layer: 'foreground'
    },
    {
      id: 'phi-mid-right',
      role: 'decoration',
      bounds: { x: 0.64, y: 0.41, width: 0.33, height: 0.25 },
      fillMode: 'packed',
      allowedTags: ['geometric', 'nature'],
      layer: 'midground'
    },
    {
      id: 'phi-bottom-right',
      role: 'accent',
      bounds: { x: 0.64, y: 0.69, width: 0.33, height: 0.28 },
      fillMode: 'packed',
      allowedTags: ['geometric'],
      layer: 'midground'
    }
  ],
  settings: { globalDensity: 0.45 }
};

// ============================================================================
// Template 5: Frame
// ============================================================================

export const TEMPLATE_FRAME: CompositionTemplate = {
  id: 'frame',
  name: 'Frame',
  description: 'Decorative border framing central subject',
  category: 'magazine',
  tags: ['decorative', 'formal', 'classic'],
  slots: [
    {
      id: 'frame-top',
      role: 'decoration',
      bounds: { x: 0, y: 0, width: 1, height: 0.1 },
      fillMode: 'flowpath',
      allowedTags: ['plant', 'geometric'],
      layer: 'midground'
    },
    {
      id: 'frame-bottom',
      role: 'decoration',
      bounds: { x: 0, y: 0.9, width: 1, height: 0.1 },
      fillMode: 'flowpath',
      allowedTags: ['plant', 'geometric'],
      layer: 'midground'
    },
    {
      id: 'frame-left',
      role: 'sidebar',
      bounds: { x: 0, y: 0.1, width: 0.08, height: 0.8 },
      fillMode: 'flowpath',
      allowedTags: ['plant', 'nature'],
      layer: 'midground'
    },
    {
      id: 'frame-right',
      role: 'sidebar',
      bounds: { x: 0.92, y: 0.1, width: 0.08, height: 0.8 },
      fillMode: 'flowpath',
      allowedTags: ['plant', 'nature'],
      layer: 'midground'
    },
    {
      id: 'center-hero',
      role: 'hero',
      bounds: { x: 0.15, y: 0.15, width: 0.7, height: 0.7 },
      fillMode: 'single',
      allowedTags: ['character', 'organic', 'silhouette'],
      layer: 'foreground'
    }
  ],
  settings: { globalDensity: 0.6 }
};

// ============================================================================
// Template 6: Stacked Bands
// ============================================================================

export const TEMPLATE_STACKED_BANDS: CompositionTemplate = {
  id: 'stacked-bands',
  name: 'Stacked Bands',
  description: 'Horizontal bands with varying content',
  category: 'magazine',
  tags: ['horizontal', 'layered', 'modern'],
  slots: [
    {
      id: 'band-top',
      role: 'headline',
      bounds: { x: 0, y: 0, width: 1, height: 0.12 },
      fillMode: 'flowpath',
      preferredGenerators: ['glyph'],
      layer: 'foreground'
    },
    {
      id: 'band-hero',
      role: 'hero',
      bounds: { x: 0.1, y: 0.15, width: 0.8, height: 0.45 },
      fillMode: 'single',
      allowedTags: ['character', 'organic', 'silhouette'],
      layer: 'foreground'
    },
    {
      id: 'band-middle',
      role: 'decoration',
      bounds: { x: 0, y: 0.63, width: 1, height: 0.15 },
      fillMode: 'flowpath',
      allowedTags: ['nature', 'plant'],
      layer: 'midground'
    },
    {
      id: 'band-bottom',
      role: 'accent',
      bounds: { x: 0, y: 0.82, width: 1, height: 0.18 },
      fillMode: 'packed',
      allowedTags: ['geometric'],
      optional: true,
      layer: 'background'
    }
  ],
  settings: { globalDensity: 0.45 }
};

// ============================================================================
// Template 7: Scattered
// ============================================================================

export const TEMPLATE_SCATTERED: CompositionTemplate = {
  id: 'scattered',
  name: 'Scattered',
  description: 'Organic scattered elements',
  category: 'magazine',
  tags: ['organic', 'playful', 'dynamic'],
  slots: [
    {
      id: 'scatter-main',
      role: 'hero',
      bounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      fillMode: 'single',
      allowedTags: ['character', 'organic', 'silhouette'],
      layer: 'foreground'
    },
    {
      id: 'scatter-tl',
      role: 'accent',
      bounds: { x: 0.03, y: 0.03, width: 0.2, height: 0.2 },
      fillMode: 'packed',
      allowedTags: ['nature', 'geometric'],
      optional: true,
      skipProbability: 0.3,
      layer: 'midground'
    },
    {
      id: 'scatter-tr',
      role: 'accent',
      bounds: { x: 0.77, y: 0.05, width: 0.2, height: 0.2 },
      fillMode: 'packed',
      allowedTags: ['nature', 'geometric'],
      optional: true,
      skipProbability: 0.3,
      layer: 'midground'
    },
    {
      id: 'scatter-bl',
      role: 'accent',
      bounds: { x: 0.05, y: 0.75, width: 0.2, height: 0.2 },
      fillMode: 'packed',
      allowedTags: ['nature', 'geometric'],
      optional: true,
      skipProbability: 0.3,
      layer: 'midground'
    },
    {
      id: 'scatter-br',
      role: 'accent',
      bounds: { x: 0.75, y: 0.77, width: 0.2, height: 0.2 },
      fillMode: 'packed',
      allowedTags: ['nature', 'geometric'],
      optional: true,
      skipProbability: 0.3,
      layer: 'midground'
    }
  ],
  settings: { globalDensity: 0.3 },
  variations: { slotPositionJitter: 0.05 }
};

// ============================================================================
// Template 8: Minimal
// ============================================================================

export const TEMPLATE_MINIMAL: CompositionTemplate = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Single hero with maximum whitespace',
  category: 'minimal',
  tags: ['clean', 'simple', 'elegant'],
  slots: [
    {
      id: 'single-hero',
      role: 'hero',
      bounds: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
      fillMode: 'single',
      allowedTags: ['character', 'organic', 'nature', 'silhouette'],
      layer: 'foreground'
    }
  ],
  settings: { globalDensity: 0.3 },
  variations: { slotPositionJitter: 0.1 }
};

// ============================================================================
// Template 9: Dense Editorial
// ============================================================================

export const TEMPLATE_DENSE_EDITORIAL: CompositionTemplate = {
  id: 'dense-editorial',
  name: 'Dense Editorial',
  description: 'Modular grid with many small cells',
  category: 'complex',
  tags: ['dense', 'editorial', 'grid'],
  slots: [
    // Row 1
    {
      id: 'cell-1-1',
      role: 'headline',
      bounds: { x: 0.02, y: 0.02, width: 0.46, height: 0.12 },
      fillMode: 'flowpath',
      preferredGenerators: ['glyph'],
      layer: 'foreground'
    },
    {
      id: 'cell-1-2',
      role: 'accent',
      bounds: { x: 0.52, y: 0.02, width: 0.46, height: 0.12 },
      fillMode: 'packed',
      allowedTags: ['geometric'],
      layer: 'midground'
    },
    // Row 2-3 (Hero spanning)
    {
      id: 'cell-hero',
      role: 'hero',
      bounds: { x: 0.02, y: 0.18, width: 0.56, height: 0.45 },
      fillMode: 'single',
      allowedTags: ['character', 'silhouette', 'organic'],
      layer: 'foreground'
    },
    {
      id: 'cell-2-2',
      role: 'sidebar',
      bounds: { x: 0.62, y: 0.18, width: 0.36, height: 0.2 },
      fillMode: 'flowpath',
      allowedTags: ['plant', 'nature'],
      layer: 'midground'
    },
    {
      id: 'cell-3-2',
      role: 'decoration',
      bounds: { x: 0.62, y: 0.42, width: 0.36, height: 0.21 },
      fillMode: 'packed',
      allowedTags: ['nature', 'geometric'],
      layer: 'midground'
    },
    // Row 4
    {
      id: 'cell-4-1',
      role: 'subhead',
      bounds: { x: 0.02, y: 0.67, width: 0.3, height: 0.1 },
      fillMode: 'flowpath',
      preferredGenerators: ['glyph'],
      layer: 'foreground'
    },
    {
      id: 'cell-4-2',
      role: 'decoration',
      bounds: { x: 0.36, y: 0.67, width: 0.62, height: 0.1 },
      fillMode: 'flowpath',
      allowedTags: ['nature', 'plant'],
      layer: 'midground'
    },
    // Row 5
    {
      id: 'cell-5',
      role: 'background',
      bounds: { x: 0.02, y: 0.81, width: 0.96, height: 0.17 },
      fillMode: 'packed',
      allowedTags: ['geometric', 'nature'],
      layer: 'background'
    }
  ],
  settings: { globalDensity: 0.5 }
};

// ============================================================================
// Template 10: Nested (with spawning)
// ============================================================================

export const TEMPLATE_NESTED: CompositionTemplate = {
  id: 'nested',
  name: 'Nested',
  description: 'Hero with spawning decorations around it',
  category: 'complex',
  tags: ['recursive', 'complex'],
  slots: [
    {
      id: 'background-fill',
      role: 'background',
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      fillMode: 'packed',
      allowedTags: ['geometric'],
      layer: 'background',
      variations: { density: { min: 0.3, max: 0.5 } }
    },
    {
      id: 'spawn-hero',
      role: 'hero',
      bounds: { x: 0.15, y: 0.15, width: 0.7, height: 0.7 },
      fillMode: 'spawn',
      allowedTags: ['character', 'silhouette', 'organic'],
      layer: 'foreground',
      spawnConfig: {
        probability: 0.7,
        minRegionArea: 0.03,
        spawnRoles: ['decoration', 'accent']
      }
    }
  ],
  settings: { globalDensity: 0.4 }
};

// ============================================================================
// All Templates
// ============================================================================

export const MAGAZINE_TEMPLATES: CompositionTemplate[] = [
  TEMPLATE_CENTERED_HERO,
  TEMPLATE_SIDEBAR_MAIN,
  TEMPLATE_TRIPTYCH,
  TEMPLATE_GOLDEN_RATIO,
  TEMPLATE_FRAME,
  TEMPLATE_STACKED_BANDS,
  TEMPLATE_SCATTERED,
  TEMPLATE_MINIMAL,
  TEMPLATE_DENSE_EDITORIAL,
  TEMPLATE_NESTED
];

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): CompositionTemplate | undefined {
  return MAGAZINE_TEMPLATES.find(t => t.id === id);
}

/**
 * Get all template IDs
 */
export function getTemplateIds(): string[] {
  return MAGAZINE_TEMPLATES.map(t => t.id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: CompositionTemplate['category']): CompositionTemplate[] {
  return MAGAZINE_TEMPLATES.filter(t => t.category === category);
}

/**
 * Validate a template's structure
 */
export function validateTemplate(template: CompositionTemplate): boolean {
  if (!template.id || !template.name || !template.slots) return false;
  if (template.slots.length === 0) return false;

  for (const slot of template.slots) {
    if (!slot.id || !slot.role || !slot.bounds || !slot.fillMode) return false;
    const { x, y, width, height } = slot.bounds;
    if (x < 0 || y < 0 || width <= 0 || height <= 0) return false;
    if (x + width > 1 || y + height > 1) return false;
  }

  return true;
}
