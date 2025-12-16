import type { Zone, ZoneParams, FalloffType, Force } from './types';

// ============================================================================
// Zone System - Local force blending based on regions
// ============================================================================

/**
 * Falloff functions for zone influence
 */
const FALLOFF_FUNCTIONS: Record<FalloffType, (dist: number, radius: number) => number> = {
  smooth: (dist, radius) => {
    const t = Math.min(1, dist / radius);
    const x = 1 - t;
    return x * x * (3 - 2 * x); // smoothstep
  },
  linear: (dist, radius) => Math.max(0, 1 - dist / radius),
  sharp: (dist, radius) => {
    const t = Math.min(1, dist / radius);
    return 1 - t * t * t * t;
  },
};

/**
 * Generate zone anchors based on placement strategy
 */
export function generateZoneAnchors(
  count: number,
  placement: ZoneParams['placement'],
  rng: () => number
): Array<{ x: number; y: number }> {
  const anchors: Array<{ x: number; y: number }> = [];

  if (placement === 'corners') {
    const corners = [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.2, y: 0.8 },
      { x: 0.8, y: 0.8 },
      { x: 0.5, y: 0.5 },
    ];

    for (let i = 0; i < Math.min(count, corners.length); i++) {
      anchors.push({
        x: corners[i].x + (rng() - 0.5) * 0.1,
        y: corners[i].y + (rng() - 0.5) * 0.1,
      });
    }
  } else if (placement === 'grid') {
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      anchors.push({
        x: (col + 0.5) / cols + (rng() - 0.5) * 0.1,
        y: (row + 0.5) / rows + (rng() - 0.5) * 0.1,
      });
    }
  } else {
    // Random with rule-of-thirds bias
    const thirds = [0.33, 0.5, 0.67];

    for (let i = 0; i < count; i++) {
      if (rng() < 0.6 && i < 4) {
        // Bias toward thirds intersections
        anchors.push({
          x: thirds[Math.floor(rng() * 3)] + (rng() - 0.5) * 0.15,
          y: thirds[Math.floor(rng() * 3)] + (rng() - 0.5) * 0.15,
        });
      } else {
        anchors.push({
          x: 0.1 + rng() * 0.8,
          y: 0.1 + rng() * 0.8,
        });
      }
    }
  }

  return anchors;
}

/**
 * Generate random force weights for a zone
 * Ensures clear dominance to avoid turbulent competing forces
 */
export function generateZoneForceWeights(
  forces: Force[],
  rng: () => number
): Record<string, number> {
  const weights: Record<string, number> = {};

  // Shuffle force IDs to pick random dominant
  const shuffledIds = forces.map((f) => f.id).sort(() => rng() - 0.5);

  for (let i = 0; i < shuffledIds.length; i++) {
    const id = shuffledIds[i];

    if (i === 0) {
      // First force is strongly dominant (0.7-1.0)
      weights[id] = 0.7 + rng() * 0.3;
    } else if (i === 1 && rng() < 0.3) {
      // 30% chance of a secondary force, but still weaker
      weights[id] = 0.1 + rng() * 0.2;
    } else {
      // Negligible (0-0.1)
      weights[id] = rng() * 0.1;
    }
  }

  return weights;
}

/**
 * Generate zones based on params
 */
export function generateZones(
  params: ZoneParams,
  forces: Force[],
  rng: () => number
): Zone[] {
  if (!params.enabled || params.count === 0 || forces.length === 0) {
    return [];
  }

  const anchors = generateZoneAnchors(params.count, params.placement, rng);
  const zones: Zone[] = [];

  for (let i = 0; i < anchors.length; i++) {
    const falloffTypes: FalloffType[] = ['smooth', 'smooth', 'linear'];

    zones.push({
      id: `zone-${i}`,
      anchor: anchors[i],
      radius: (0.25 + rng() * 0.35) * params.transitionWidth * 2,
      falloff: falloffTypes[Math.floor(rng() * falloffTypes.length)],
      forceWeights: generateZoneForceWeights(forces, rng),
    });
  }

  return zones;
}

/**
 * Get blended force weights at a point based on zone influences
 * Returns null if zones are disabled or no influence
 */
export function getZoneInfluence(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number },
  zones: Zone[],
  forces: Force[]
): Record<string, number> | null {
  if (zones.length === 0) {
    return null;
  }

  // Normalize point to 0-1
  const nx = (point.x - bounds.x) / bounds.width;
  const ny = (point.y - bounds.y) / bounds.height;

  const influences: Array<{ zone: Zone; weight: number }> = [];
  let totalWeight = 0;

  for (const zone of zones) {
    const dx = nx - zone.anchor.x;
    const dy = ny - zone.anchor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const falloffFn = FALLOFF_FUNCTIONS[zone.falloff] || FALLOFF_FUNCTIONS.smooth;
    const weight = falloffFn(dist, zone.radius);

    if (weight > 0.001) {
      influences.push({ zone, weight });
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) {
    return null;
  }

  // Blend force weights from all influencing zones
  const blendedWeights: Record<string, number> = {};

  // Initialize with zeros
  for (const force of forces) {
    blendedWeights[force.id] = 0;
  }

  for (const inf of influences) {
    const normWeight = inf.weight / totalWeight;

    for (const [id, w] of Object.entries(inf.zone.forceWeights)) {
      if (id in blendedWeights) {
        blendedWeights[id] += w * normWeight;
      }
    }
  }

  return blendedWeights;
}
