/**
 * ContentSelector - Generator-to-slot matching for magazine compositions
 *
 * Selects appropriate generators based on:
 * - Slot role (hero, headline, decoration, etc.)
 * - Tag matching (organic, geometric, nature, etc.)
 * - Aspect ratio fitness
 * - Area-based parameter scaling
 */

import { GeneratorRegistry } from '../GeneratorRegistry';
import type { Generator } from '../../types';
import type {
  TemplateSlot,
  SlotRole,
  GeneratorMatch
} from '../../types/composition';
import { ROLE_TAG_PREFERENCES as rolePrefs } from '../../types/composition';

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate tag match score between a generator and slot requirements.
 * Returns 0-1 score based on how many preferred tags match.
 */
function calculateTagScore(
  generatorTags: string[],
  role: SlotRole,
  allowedTags?: string[],
  excludedTags?: string[]
): number {
  // Check excluded tags first - instant disqualification
  if (excludedTags && excludedTags.length > 0) {
    const hasExcluded = generatorTags.some(t => excludedTags.includes(t));
    if (hasExcluded) return -1; // Negative score = excluded
  }

  // If allowed tags specified, use those
  const preferredTags = allowedTags && allowedTags.length > 0
    ? allowedTags
    : rolePrefs[role].preferredTags;

  if (preferredTags.length === 0) return 0.5; // Neutral if no preferences

  // Count matches
  const matches = generatorTags.filter(t => preferredTags.includes(t));
  return matches.length / preferredTags.length;
}

/**
 * Calculate aspect ratio fitness score.
 * Some generators work better in certain aspect ratios.
 */
function calculateAspectScore(aspectRatio: number, generatorType: string): number {
  // Tall regions (aspect < 0.7)
  if (aspectRatio < 0.7) {
    const tallGenerators = ['tree', 'grass', 'silhouette'];
    if (tallGenerators.includes(generatorType)) return 1.0;
    // Penalize wide-oriented generators
    const wideGenerators = ['glyph'];
    if (wideGenerators.includes(generatorType)) return 0.4;
    return 0.6;
  }

  // Wide regions (aspect > 1.5)
  if (aspectRatio > 1.5) {
    const wideGenerators = ['glyph', 'bird', 'polygon'];
    if (wideGenerators.includes(generatorType)) return 1.0;
    // Tall generators don't work well
    const tallGenerators = ['tree', 'grass'];
    if (tallGenerators.includes(generatorType)) return 0.4;
    return 0.6;
  }

  // Square-ish regions: most generators work well
  return 0.8;
}

/**
 * Calculate role-specific bonus.
 * Gives extra weight to generators that are ideal for a role.
 */
function calculateRoleBonus(generatorType: string, role: SlotRole): number {
  const defaultGen = rolePrefs[role].defaultGenerator;
  if (generatorType === defaultGen) return 0.3;
  return 0;
}

// ============================================================================
// Generator Selection
// ============================================================================

/**
 * Select the best generator for a slot based on role, tags, and aspect ratio.
 *
 * @param slot - Template slot to fill
 * @returns GeneratorMatch with selected generator, score, and params
 */
export function selectGeneratorForSlot(slot: TemplateSlot, seed: number = 0): GeneratorMatch {
  const generators = GeneratorRegistry.list();
  const aspectRatio = slot.bounds.width / slot.bounds.height;

  // Score all generators
  const scored: GeneratorMatch[] = [];

  for (const gen of generators) {
    const tagScore = calculateTagScore(
      gen.tags,
      slot.role,
      slot.allowedTags,
      slot.excludedTags
    );

    // Skip excluded generators
    if (tagScore < 0) continue;

    const aspectScore = calculateAspectScore(aspectRatio, gen.type);
    const roleBonus = calculateRoleBonus(gen.type, slot.role);

    // Weighted combination
    const score = tagScore * 0.5 + aspectScore * 0.3 + roleBonus + 0.2;

    scored.push({
      generatorType: gen.type,
      score,
      params: calculateParams(gen, slot, seed),
      reason: `Tags: ${(tagScore * 100).toFixed(0)}%, Aspect: ${(aspectScore * 100).toFixed(0)}%`
    });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // If no valid generators, use default for role
  if (scored.length === 0) {
    const defaultType = rolePrefs[slot.role].defaultGenerator;
    const defaultGen = GeneratorRegistry.get(defaultType);
    return {
      generatorType: defaultType,
      score: 0.5,
      params: defaultGen ? calculateParams(defaultGen, slot, seed) : {},
      reason: 'Fallback to role default'
    };
  }

  // Weighted random selection among top candidates
  // This adds variety while still preferring better matches
  const topN = Math.min(3, scored.length);
  const topCandidates = scored.slice(0, topN);

  // Simple seeded random for reproducibility
  const rng = seededRandom(seed);
  const totalScore = topCandidates.reduce((sum, c) => sum + c.score, 0);
  let random = rng() * totalScore;

  for (const candidate of topCandidates) {
    random -= candidate.score;
    if (random <= 0) {
      return candidate;
    }
  }

  return topCandidates[0];
}

/**
 * Select generators for a slot that prefers specific types.
 */
export function selectPreferredGenerator(
  slot: TemplateSlot,
  seed: number = 0
): GeneratorMatch {
  if (slot.preferredGenerators && slot.preferredGenerators.length > 0) {
    // Pick from preferred list
    const rng = seededRandom(seed);
    const idx = Math.floor(rng() * slot.preferredGenerators.length);
    const preferredType = slot.preferredGenerators[idx];
    const gen = GeneratorRegistry.get(preferredType);

    if (gen) {
      return {
        generatorType: gen.type,
        score: 1.0,
        params: calculateParams(gen, slot, seed),
        reason: 'Preferred generator'
      };
    }
  }

  // Fall back to regular selection
  return selectGeneratorForSlot(slot, seed);
}

// ============================================================================
// Parameter Generation
// ============================================================================

/**
 * Calculate appropriate parameters for a generator based on slot properties.
 * Scales size and density based on slot dimensions.
 */
function calculateParams(
  generator: Generator,
  slot: TemplateSlot,
  seed: number
): Record<string, any> {
  const defaults = generator.getDefaultParams();
  const params: Record<string, any> = { ...defaults };
  const rng = seededRandom(seed);

  // Get slot dimensions for size multiplier calculations

  // Apply size multiplier if specified
  const sizeMultiplier = slot.variations?.sizeMultiplier
    ? lerp(slot.variations.sizeMultiplier.min, slot.variations.sizeMultiplier.max, rng())
    : 1.0;

  // Scale size parameters based on slot and role
  const paramDefs = generator.getParamDefinitions();

  for (const def of paramDefs) {
    if (isSizeParam(def.name)) {
      params[def.name] = scaleSizeParam(
        defaults[def.name],
        slot.role,
        sizeMultiplier,
        rng
      );
    }
  }

  // Role-specific parameter adjustments
  switch (slot.role) {
    case 'hero':
      // Heroes should be large and prominent
      params['height'] = scaleForHero(params['height'] || 60);
      params['size'] = scaleForHero(params['size'] || 20);
      break;

    case 'headline':
    case 'subhead':
      // Text should use glyph-specific settings
      if (generator.type === 'glyph') {
        params['unitSize'] = slot.role === 'headline'
          ? { min: 3, max: 5 }
          : { min: 2, max: 3 };
        params['complexity'] = { min: 0.2, max: 0.4 };
      }
      break;

    case 'background':
      // Background should be small and dense
      if (params['size']) {
        params['size'] = scaleDown(params['size'], 0.5);
      }
      break;

    case 'accent':
      // Accents are medium-small
      if (params['size']) {
        params['size'] = scaleDown(params['size'], 0.7);
      }
      break;
  }

  return params;
}

/**
 * Check if a parameter name represents a size parameter
 */
function isSizeParam(name: string): boolean {
  const sizeNames = ['size', 'height', 'width', 'unitSize', 'baseWidth'];
  return sizeNames.some(s => name.toLowerCase().includes(s.toLowerCase()));
}

/**
 * Scale a size parameter based on slot role
 */
function scaleSizeParam(
  value: any,
  role: SlotRole,
  multiplier: number,
  rng: () => number
): any {
  // Handle MinMaxValue
  if (typeof value === 'object' && 'min' in value && 'max' in value) {
    const scale = getRoleScale(role) * multiplier;
    return {
      min: value.min * scale * (0.8 + rng() * 0.4),
      max: value.max * scale * (0.8 + rng() * 0.4)
    };
  }

  // Handle number
  if (typeof value === 'number') {
    return value * getRoleScale(role) * multiplier;
  }

  return value;
}

/**
 * Get scale factor based on role
 */
function getRoleScale(role: SlotRole): number {
  switch (role) {
    case 'hero': return 2.0;
    case 'headline': return 1.5;
    case 'subhead': return 1.0;
    case 'sidebar': return 0.8;
    case 'decoration': return 0.7;
    case 'background': return 0.5;
    case 'accent': return 0.6;
    default: return 1.0;
  }
}

/**
 * Scale a value for hero role
 */
function scaleForHero(value: any): any {
  if (typeof value === 'object' && 'min' in value && 'max' in value) {
    return { min: value.min * 1.5, max: value.max * 2 };
  }
  if (typeof value === 'number') {
    return value * 1.8;
  }
  return value;
}

/**
 * Scale down a value
 */
function scaleDown(value: any, factor: number): any {
  if (typeof value === 'object' && 'min' in value && 'max' in value) {
    return { min: value.min * factor, max: value.max * factor };
  }
  if (typeof value === 'number') {
    return value * factor;
  }
  return value;
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
    return (seed / 0x7fffffff);
  };
}

/**
 * Linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ============================================================================
// Batch Selection
// ============================================================================

/**
 * Select generators for all slots in a template.
 *
 * @param slots - Array of template slots
 * @param baseSeed - Base seed for randomization
 * @returns Map of slot ID to GeneratorMatch
 */
export function selectGeneratorsForSlots(
  slots: TemplateSlot[],
  baseSeed: number
): Map<string, GeneratorMatch> {
  const selections = new Map<string, GeneratorMatch>();

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const slotSeed = baseSeed + i * 1000; // Different seed per slot

    const match = slot.preferredGenerators && slot.preferredGenerators.length > 0
      ? selectPreferredGenerator(slot, slotSeed)
      : selectGeneratorForSlot(slot, slotSeed);

    selections.set(slot.id, match);
  }

  return selections;
}

/**
 * Get density for a slot based on role and variations
 */
export function getDensityForSlot(slot: TemplateSlot, seed: number): number {
  const rng = seededRandom(seed);

  // Use slot-specific density if specified
  if (slot.variations?.density) {
    return lerp(slot.variations.density.min, slot.variations.density.max, rng());
  }

  // Role-based defaults
  switch (slot.role) {
    case 'hero': return 0.1;        // Very sparse (1-2 items)
    case 'headline': return 1.5;    // Dense for text
    case 'subhead': return 1.2;
    case 'decoration': return 0.8;
    case 'sidebar': return 0.6;
    case 'background': return 1.5;  // Dense but small
    case 'accent': return 0.5;
    default: return 0.6;
  }
}
