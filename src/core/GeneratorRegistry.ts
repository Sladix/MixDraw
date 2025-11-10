import type { Generator, ParamDefinition } from '../types';

/**
 * Central registry for all available generators
 */
class GeneratorRegistryClass {
  private generators: Map<string, Generator> = new Map();

  /**
   * Register a new generator
   * @param generator - Generator to register
   */
  register(generator: Generator): void {
    if (this.generators.has(generator.type)) {
      console.warn(
        `Generator with type "${generator.type}" is already registered. Overwriting.`
      );
    }
    this.generators.set(generator.type, generator);
  }

  /**
   * Get a generator by type
   * @param type - Generator type identifier
   * @returns Generator instance or undefined
   */
  get(type: string): Generator | undefined {
    return this.generators.get(type);
  }

  /**
   * Get all registered generators
   * @returns Array of all generators
   */
  list(): Generator[] {
    return Array.from(this.generators.values());
  }

  /**
   * Get parameter definitions for a generator type
   * @param type - Generator type identifier
   * @returns Parameter definitions or empty array
   */
  getParamDefinitions(type: string): ParamDefinition[] {
    const generator = this.generators.get(type);
    return generator ? generator.getParamDefinitions() : [];
  }

  /**
   * Get default parameters for a generator type
   * @param type - Generator type identifier
   * @returns Default parameters or empty object
   */
  getDefaultParams(type: string): Record<string, any> {
    const generator = this.generators.get(type);
    return generator ? generator.getDefaultParams() : {};
  }

  /**
   * Check if a generator type is registered
   * @param type - Generator type identifier
   * @returns True if registered
   */
  has(type: string): boolean {
    return this.generators.has(type);
  }

  /**
   * Get all generator types
   * @returns Array of generator type strings
   */
  getTypes(): string[] {
    return Array.from(this.generators.keys());
  }
}

// Export singleton instance
export const GeneratorRegistry = new GeneratorRegistryClass();
