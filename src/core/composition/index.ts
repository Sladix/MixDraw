/**
 * Magazine Composition Module
 *
 * Exports all composition-related functionality:
 * - MagazineComposer: Main orchestrator
 * - GridPartitioner: Layout algorithms
 * - ContentSelector: Generator matching
 * - SlotRenderer: FlowPath/Standalone generation
 */

// Main composer
export {
  composeMagazineCover,
  getTemplateOptions,
  quickCompose,
  type ComposerOptions,
  type ComposedLayers
} from './MagazineComposer';

// Grid partitioning
export {
  partitionGrid,
  partitionModular,
  partitionGoldenRatio,
  partitionRuleOfThirds,
  partitionColumn,
  createDefaultGrid,
  generateRandomGrid
} from './GridPartitioner';

// Content selection
export {
  selectGeneratorForSlot,
  selectPreferredGenerator,
  selectGeneratorsForSlots,
  getDensityForSlot
} from './ContentSelector';

// Slot rendering
export {
  renderSlot,
  renderSlots,
  getLayerForSlot,
  type RenderResult
} from './SlotRenderer';
