import { GeneratorRegistry } from '../core/GeneratorRegistry';
import { BirdGenerator } from './BirdGenerator';
import { LeafGenerator } from './LeafGenerator';
import { PolygonGenerator } from './PolygonGenerator';

// Track if generators have been registered to prevent double registration
let generatorsRegistered = false;

/**
 * Register all generators
 * Call this function at app startup
 * Safe to call multiple times - only registers once
 */
export function registerAllGenerators(): void {
  if (generatorsRegistered) {
    return;
  }

  GeneratorRegistry.register(new BirdGenerator());
  GeneratorRegistry.register(new LeafGenerator());
  GeneratorRegistry.register(new PolygonGenerator());

  generatorsRegistered = true;
}

// Export generators
export { BirdGenerator, LeafGenerator, PolygonGenerator };
