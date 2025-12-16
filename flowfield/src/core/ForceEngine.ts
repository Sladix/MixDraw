import { createNoise2D, NoiseFunction2D } from 'simplex-noise';
import type {
  Force,
  FormulaContext,
  SuperParams,
  NoiseForce,
  CircularForce,
  FormulaForce,
  Zone,
} from './types';
import { compileFormula, evaluateFormula } from './FormulaParser';
import { isMinMaxValue } from '@mixdraw/types';
import { getZoneInfluence } from './ZoneSystem';

// ============================================================================
// Force Engine - Computes angle at any point based on active forces
// ============================================================================

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Create a formula context for a given point
 */
export function createFormulaContext(
  point: { x: number; y: number },
  bounds: Bounds,
  superParams: SuperParams,
  noise2D: NoiseFunction2D
): FormulaContext {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  const dx = point.x - centerX;
  const dy = point.y - centerY;

  return {
    x: point.x,
    y: point.y,
    nx: (point.x - bounds.x) / bounds.width,
    ny: (point.y - bounds.y) / bounds.height,
    scale: superParams.scale,
    dist: Math.sqrt(dx * dx + dy * dy),
    angle: Math.atan2(dy, dx),
    warp: superParams.warp,
    twist: superParams.twist,
    turbulence: superParams.turbulence,
    noise: (x: number, y: number) => noise2D(x / 100, y / 100),
    PI: Math.PI,
    TAU: Math.PI * 2,
  };
}

/**
 * Apply domain warping to coordinates
 */
export function applyDomainWarp(
  x: number,
  y: number,
  superParams: SuperParams,
  noise2D: NoiseFunction2D
): { x: number; y: number } {
  if (superParams.warp === 0) {
    return { x, y };
  }

  const warpScale = 100;
  const warpX = noise2D(x / warpScale, y / warpScale) * superParams.warp * 50;
  const warpY = noise2D(x / warpScale + 100, y / warpScale + 100) * superParams.warp * 50;

  return { x: x + warpX, y: y + warpY };
}

/**
 * Apply twist deformation
 */
export function applyTwist(
  x: number,
  y: number,
  bounds: Bounds,
  superParams: SuperParams
): { x: number; y: number } {
  if (superParams.twist === 0) {
    return { x, y };
  }

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  const dx = x - centerX;
  const dy = y - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  // Twist increases with distance from center
  const twistAngle = (superParams.twist * Math.PI / 180) * (dist / 500);

  return {
    x: centerX + dist * Math.cos(angle + twistAngle),
    y: centerY + dist * Math.sin(angle + twistAngle),
  };
}

/**
 * Apply all super param transformations
 */
export function applyAllTransforms(
  x: number,
  y: number,
  bounds: Bounds,
  superParams: SuperParams,
  noise2D: NoiseFunction2D
): { x: number; y: number } {
  let point = { x, y };

  point = applyDomainWarp(point.x, point.y, superParams, noise2D);
  point = applyTwist(point.x, point.y, bounds, superParams);

  return point;
}

// ============================================================================
// Individual Force Evaluators
// ============================================================================

/**
 * Evaluate noise force
 */
export function evaluateNoiseForce(
  point: { x: number; y: number },
  params: NoiseForce['params'],
  noise2D: NoiseFunction2D,
  rng: () => number
): number {
  const scale = isMinMaxValue(params.scale)
    ? params.scale.min + rng() * (params.scale.max - params.scale.min)
    : params.scale;

  let n = 0;
  let amp = 1;
  let freq = 1;

  for (let o = 0; o < params.octaves; o++) {
    n += amp * noise2D(
      point.x / scale * freq,
      point.y / scale * freq
    );
    amp *= 0.5;
    freq *= 2;
  }

  return n * Math.PI * params.complexity;
}

/**
 * Evaluate circular force
 */
export function evaluateCircularForce(
  point: { x: number; y: number },
  params: CircularForce['params'],
  bounds: Bounds,
  rng: () => number
): number {
  const cx = bounds.x + bounds.width * params.centerX;
  const cy = bounds.y + bounds.height * params.centerY;
  const dx = point.x - cx;
  const dy = point.y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const baseAngle = Math.atan2(dy, dx);

  const frequency = isMinMaxValue(params.frequency)
    ? params.frequency.min + rng() * (params.frequency.max - params.frequency.min)
    : params.frequency;

  switch (params.mode) {
    case 'tangent':
      return baseAngle + Math.PI / 2 + Math.sin(dist / 50 * frequency) * 0.5;
    case 'radial':
      return baseAngle + Math.cos(dist / 30 * frequency) * Math.PI;
    case 'spiral':
      return baseAngle + Math.PI / 2 + dist / 100 * frequency;
    default:
      return baseAngle + Math.PI / 2;
  }
}

/**
 * Evaluate formula force
 */
export function evaluateFormulaForce(
  params: FormulaForce['params'],
  context: FormulaContext
): number {
  const compiled = compileFormula(params.expression);
  const result = evaluateFormula(compiled, context);

  // Formula can return angle directly or a value that maps to angle
  // By convention, result is in radians
  return result;
}

// ============================================================================
// Main Force Engine
// ============================================================================

export interface ForceEngineConfig {
  forces: Force[];
  superParams: SuperParams;
  bounds: Bounds;
  seed: number;
  zones?: Zone[];  // Optional zone system for regional force blending
}

export class ForceEngine {
  private noise2D: NoiseFunction2D;
  private forces: Force[];
  private superParams: SuperParams;
  private bounds: Bounds;
  private zones: Zone[];
  private rng: () => number;
  private lastAngle = 0;

  constructor(config: ForceEngineConfig) {
    // Create seeded noise
    const seedRng = this.createRng(config.seed);
    this.noise2D = createNoise2D(seedRng);

    this.forces = config.forces;
    this.superParams = config.superParams;
    this.bounds = config.bounds;
    this.zones = config.zones || [];
    this.rng = this.createRng(config.seed + 1);
  }

  private createRng(seed: number): () => number {
    // Simple mulberry32 PRNG
    return () => {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /**
   * Update configuration
   */
  update(config: Partial<ForceEngineConfig>): void {
    if (config.forces !== undefined) this.forces = config.forces;
    if (config.superParams !== undefined) this.superParams = config.superParams;
    if (config.bounds !== undefined) this.bounds = config.bounds;
    if (config.zones !== undefined) this.zones = config.zones;
    if (config.seed !== undefined) {
      const seedRng = this.createRng(config.seed);
      this.noise2D = createNoise2D(seedRng);
      this.rng = this.createRng(config.seed + 1);
    }
  }

  /**
   * Get angle at a point by combining all active forces
   */
  getAngle(point: { x: number; y: number }): number {
    // Apply super param transformations to the point
    const transformed = applyAllTransforms(
      point.x,
      point.y,
      this.bounds,
      this.superParams,
      this.noise2D
    );

    // Create formula context
    const context = createFormulaContext(
      transformed,
      this.bounds,
      this.superParams,
      this.noise2D
    );

    // Get zone-based weight overrides (if zones are enabled)
    const zoneWeights = this.zones.length > 0
      ? getZoneInfluence(transformed, this.bounds, this.zones, this.forces)
      : null;

    // Debug: Log zone influence for first few points
    if (this.zones.length > 0 && Math.random() < 0.0001) {
      console.log('[ForceEngine] Zone influence at point:', transformed, 'weights:', zoneWeights);
    }

    // Use vector averaging to avoid angle discontinuity issues
    let vx = 0;
    let vy = 0;

    for (const force of this.forces) {
      if (!force.enabled) continue;

      // Use zone weight if available, otherwise use force's own weight
      let weight: number;
      if (zoneWeights && force.id in zoneWeights) {
        weight = zoneWeights[force.id];
      } else {
        weight = isMinMaxValue(force.weight)
          ? force.weight.min + this.rng() * (force.weight.max - force.weight.min)
          : force.weight;
      }

      if (weight <= 0) continue;

      let angle: number;

      switch (force.type) {
        case 'noise':
          angle = evaluateNoiseForce(transformed, force.params, this.noise2D, this.rng);
          break;
        case 'circular':
          angle = evaluateCircularForce(transformed, force.params, this.bounds, this.rng);
          break;
        case 'formula':
          angle = evaluateFormulaForce(force.params, context);
          break;
        default:
          continue;
      }

      // Convert to weighted vector
      vx += Math.cos(angle) * weight;
      vy += Math.sin(angle) * weight;
    }

    // Check vector magnitude - if too small, forces are canceling out
    const magnitude = Math.sqrt(vx * vx + vy * vy);
    if (magnitude < 0.01) {
      return this.lastAngle;
    }

    // Compute final angle
    let finalAngle = Math.atan2(vy, vx);

    // Apply turbulence ONCE to the final result (not per-force)
    if (this.superParams.turbulence > 0) {
      const turbNoise = this.noise2D(point.x / 20, point.y / 20);
      finalAngle += turbNoise * this.superParams.turbulence * Math.PI * 0.5;
    }

    this.lastAngle = finalAngle;
    return this.lastAngle;
  }

  /**
   * Get the noise function (for external use)
   */
  getNoise2D(): NoiseFunction2D {
    return this.noise2D;
  }
}
