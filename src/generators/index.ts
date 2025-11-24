import { GeneratorRegistry } from '../core/GeneratorRegistry';
import { BirdGenerator } from './BirdGenerator';
import { LeafGenerator } from './LeafGenerator';
import { PolygonGenerator } from './PolygonGenerator';
import { GrassGenerator } from './GrassGenerator';
import { TreeGenerator } from './TreeGenerator';
import { GlyphGenerator } from './GlyphGenerator';
import { SilhouetteGenerator } from './SilhouetteGenerator';

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

  GeneratorRegistry.register(new GlyphGenerator());
  GeneratorRegistry.register(new BirdGenerator());
  GeneratorRegistry.register(new LeafGenerator());
  GeneratorRegistry.register(new PolygonGenerator());
  GeneratorRegistry.register(new GrassGenerator());
  GeneratorRegistry.register(new TreeGenerator());
  GeneratorRegistry.register(new SilhouetteGenerator());

  generatorsRegistered = true;
}

// Export generators
export { BirdGenerator, LeafGenerator, PolygonGenerator, GrassGenerator, TreeGenerator };
