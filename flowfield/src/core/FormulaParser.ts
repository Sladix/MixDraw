import { compile, EvalFunction } from 'mathjs';
import type { FormulaContext } from './types';

// Cache compiled expressions for performance
const compiledCache = new Map<string, EvalFunction>();

/**
 * Compile a formula expression with caching
 * @param expression - Math.js expression string
 * @returns Compiled expression ready for evaluation
 */
export function compileFormula(expression: string): EvalFunction {
  const cached = compiledCache.get(expression);
  if (cached) {
    return cached;
  }

  try {
    const compiled = compile(expression);
    compiledCache.set(expression, compiled);
    return compiled;
  } catch (error) {
    console.error(`Failed to compile formula: ${expression}`, error);
    // Return a fallback that returns 0
    const fallback = compile('0');
    return fallback;
  }
}

/**
 * Evaluate a compiled formula with the given context
 * @param compiled - Compiled math.js expression
 * @param context - Variables to inject into the expression
 * @returns Evaluated result (number)
 */
export function evaluateFormula(
  compiled: EvalFunction,
  context: FormulaContext
): number {
  try {
    const result = compiled.evaluate(context);
    // Ensure we return a valid number
    if (typeof result === 'number' && isFinite(result)) {
      return result;
    }
    return 0;
  } catch (error) {
    console.error('Failed to evaluate formula:', error);
    return 0;
  }
}

/**
 * Validate a formula expression
 * @param expression - Formula string to validate
 * @returns Object with valid flag and optional error message
 */
export function validateFormula(expression: string): {
  valid: boolean;
  error?: string;
} {
  if (!expression || expression.trim() === '') {
    return { valid: false, error: 'Expression is empty' };
  }

  try {
    compile(expression);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid expression',
    };
  }
}

/**
 * Clear the formula cache (useful when memory is a concern)
 */
export function clearFormulaCache(): void {
  compiledCache.clear();
}

/**
 * Get available variables for formula context
 * Useful for displaying help in the UI
 */
export const FORMULA_VARIABLES = [
  { name: 'x', description: 'Absolute X position (pixels)' },
  { name: 'y', description: 'Absolute Y position (pixels)' },
  { name: 'nx', description: 'Normalized X position (0-1)' },
  { name: 'ny', description: 'Normalized Y position (0-1)' },
  { name: 'scale', description: 'Global scale parameter' },
  { name: 'dist', description: 'Distance from center (pixels)' },
  { name: 'angle', description: 'Angle from center (radians)' },
  { name: 'warp', description: 'Domain warping intensity' },
  { name: 'twist', description: 'Twist deformation amount' },
  { name: 'turbulence', description: 'Turbulence overlay' },
  { name: 'noise(x, y)', description: 'Simplex noise at position' },
  { name: 'PI', description: 'Mathematical constant (3.14159...)' },
  { name: 'TAU', description: '2 * PI (6.28318...)' },
];

/**
 * Get available math functions
 */
export const FORMULA_FUNCTIONS = [
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sqrt', 'pow', 'abs', 'floor', 'ceil', 'round',
  'min', 'max', 'exp', 'log', 'log10',
  'sign', 'mod',
];
