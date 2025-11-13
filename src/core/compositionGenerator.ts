import paper from 'paper';
import { nanoid } from 'nanoid';
import type { FlowPath, GeneratorConfig } from '../types';
import { GeneratorRegistry } from './GeneratorRegistry';
import { seededRandom } from '../utils/random';
import { absoluteToNormalized } from '../utils/coordinates';
import type { FormatType } from '../types/formats';

/**
 * Well-known aesthetic compositions for generative art
 */
type CompositionType =
  | 'spiral'           // Golden spiral
  | 'wave'             // Sine wave
  | 's-curve'          // S-shaped curve
  | 'circle'           // Circular path
  | 'diagonal'         // Diagonal line (rule of thirds)
  | 'arc'              // Arc curve
  | 'zigzag'           // Angular zigzag
  | 'fibonacci'        // Fibonacci spiral approximation
  | 'random-organic';  // Organic random curve

interface CompositionConfig {
  type: CompositionType;
  generatorType: string;
  usePacking: boolean;
  addStandalones: boolean;
  canvasWidth: number;
  canvasHeight: number;
  seed: number;
  paperFormat: FormatType;
  paperOrientation: 'portrait' | 'landscape';
}

/**
 * Generate a golden ratio spiral curve
 */
function generateSpiralCurve(
  centerX: number,
  centerY: number,
  turns: number,
  maxRadius: number,
  rng: () => number
): paper.Path {
  const path = new paper.Path();
  const segments = 20; // Reduced from 50 for performance
  const phi = 1.618033988749; // Golden ratio

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * turns * Math.PI * 2;
    const radius = maxRadius * Math.pow(phi, -angle / (Math.PI * 2));

    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    path.add(new paper.Point(x, y));
  }

  path.smooth({ type: 'continuous' });
  return path;
}

/**
 * Generate a sine wave curve
 */
function generateWaveCurve(
  startX: number,
  startY: number,
  endX: number,
  amplitude: number,
  frequency: number,
  rng: () => number
): paper.Path {
  const path = new paper.Path();
  const segments = 20; // Reduced from 60 for performance

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = startX + (endX - startX) * t;
    const y = startY + Math.sin(t * Math.PI * 2 * frequency) * amplitude;

    path.add(new paper.Point(x, y));
  }

  path.smooth({ type: 'continuous' });
  return path;
}

/**
 * Generate an S-curve (rule of thirds composition)
 */
function generateSCurve(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  curvature: number,
  rng: () => number
): paper.Path {
  const path = new paper.Path();
  const segments = 20; // Sample the curve into discrete points

  // Control points for cubic Bezier S-curve
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  const cp1X = startX + (midX - startX) * 0.5;
  const cp1Y = startY + curvature;
  const cp2X = midX + (endX - midX) * 0.5;
  const cp2Y = endY - curvature;

  // Sample points along the cubic bezier curve
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;

    // Cubic Bezier formula: B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
    const t1 = 1 - t;
    const t1_2 = t1 * t1;
    const t1_3 = t1_2 * t1;
    const t_2 = t * t;
    const t_3 = t_2 * t;

    const x = t1_3 * startX + 3 * t1_2 * t * cp1X + 3 * t1 * t_2 * cp2X + t_3 * endX;
    const y = t1_3 * startY + 3 * t1_2 * t * cp1Y + 3 * t1 * t_2 * cp2Y + t_3 * endY;

    path.add(new paper.Point(x, y));
  }

  path.smooth({ type: 'continuous' });
  return path;
}

/**
 * Generate a circular arc
 */
function generateCircleCurve(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  rng: () => number
): paper.Path {
  const path = new paper.Path();
  const segments = 20; // Reduced from 40 for performance

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + (endAngle - startAngle) * t;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    path.add(new paper.Point(x, y));
  }

  path.smooth({ type: 'continuous' });
  return path;
}

/**
 * Generate a diagonal line (rule of thirds)
 */
function generateDiagonalCurve(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  variation: number,
  rng: () => number
): paper.Path {
  const path = new paper.Path();
  const segments = 20;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = startX + (endX - startX) * t + (rng() - 0.5) * variation;
    const y = startY + (endY - startY) * t + (rng() - 0.5) * variation;

    path.add(new paper.Point(x, y));
  }

  path.smooth({ type: 'continuous' });
  return path;
}

/**
 * Generate a zigzag pattern
 */
function generateZigzagCurve(
  startX: number,
  startY: number,
  endX: number,
  amplitude: number,
  peaks: number,
  rng: () => number
): paper.Path {
  const path = new paper.Path();
  const steps = peaks * 2;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = startX + (endX - startX) * t;
    const y = startY + (i % 2 === 0 ? amplitude : -amplitude);

    path.add(new paper.Point(x, y));
  }

  return path;
}

/**
 * Generate an organic random curve using Bezier
 */
function generateOrganicCurve(
  width: number,
  height: number,
  points: number,
  rng: () => number
): paper.Path {
  const path = new paper.Path();

  // Generate random points with some structure
  const pointsList: paper.Point[] = [];
  for (let i = 0; i < points; i++) {
    const x = rng() * width;
    const y = rng() * height;
    pointsList.push(new paper.Point(x, y));
  }

  // Sort by x to create a flowing path
  pointsList.sort((a, b) => a.x - b.x);

  pointsList.forEach(point => path.add(point));
  path.smooth({ type: 'continuous' });

  return path;
}

/**
 * Pick a random generator weighted by aesthetic compatibility
 */
function pickGenerator(rng: () => number): string {
  const generators = GeneratorRegistry.list();

  // Weight certain generators higher for compositions
  const weights = generators.map(gen => {
    // Favor organic shapes for compositions
    if (gen.tags.includes('organic') || gen.tags.includes('nature')) {
      return 2.0;
    }
    return 1.0;
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = rng() * totalWeight;

  for (let i = 0; i < generators.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return generators[i].type;
    }
  }

  return generators[0].type;
}

/**
 * Generate aesthetic parameters for a generator
 */
function generateGeneratorParams(
  generatorType: string,
  rng: () => number
): Record<string, any> {
  const generator = GeneratorRegistry.get(generatorType);
  if (!generator) return {};

  const defaultParams = generator.getDefaultParams();
  const paramDefs = generator.getParamDefinitions();

  const params: Record<string, any> = {};

  paramDefs.forEach(paramDef => {
    if (paramDef.type === 'minmax') {
      // Create varied ranges for interesting variation
      const range = (paramDef.max || 10) - (paramDef.min || 0);
      const center = (paramDef.min || 0) + range * 0.5;
      const variation = range * (0.2 + rng() * 0.3); // 20-50% variation

      params[paramDef.name] = {
        min: Math.max(paramDef.min || 0, center - variation),
        max: Math.min(paramDef.max || 10, center + variation),
      };
    } else if (paramDef.type === 'slider') {
      // Pick a random value in the range
      const range = (paramDef.max || 1) - (paramDef.min || 0);
      params[paramDef.name] = (paramDef.min || 0) + rng() * range;
    } else {
      // Use default for other types
      params[paramDef.name] = defaultParams[paramDef.name];
    }
  });

  return params;
}

/**
 * Generate a complete composition with flowpath and optional standalones
 */
export function generateComposition(config: CompositionConfig): {
  flowPath: FlowPath;
  standalones: any[];
} {
  const rng = seededRandom(config.seed);
  const { canvasWidth, canvasHeight, type } = config;


  // Generate the curve based on composition type
  let curve: paper.Path;

  switch (type) {
    case 'spiral':
      curve = generateSpiralCurve(
        canvasWidth / 2,
        canvasHeight / 2,
        2 + rng() * 1, // 2-3 turns
        Math.min(canvasWidth, canvasHeight) * 0.4,
        rng
      );
      break;

    case 'wave':
      curve = generateWaveCurve(
        canvasWidth * 0.1,
        canvasHeight / 2,
        canvasWidth * 0.9,
        canvasHeight * (0.15 + rng() * 0.1), // 15-25% amplitude
        1 + rng() * 2, // 1-3 waves
        rng
      );
      break;

    case 's-curve':
      curve = generateSCurve(
        canvasWidth * (0.1 + rng() * 0.1),
        canvasHeight * (0.2 + rng() * 0.1),
        canvasWidth * (0.8 + rng() * 0.1),
        canvasHeight * (0.7 + rng() * 0.1),
        canvasHeight * (0.2 + rng() * 0.1),
        rng
      );
      break;

    case 'circle':
      curve = generateCircleCurve(
        canvasWidth / 2,
        canvasHeight / 2,
        Math.min(canvasWidth, canvasHeight) * (0.3 + rng() * 0.1),
        0,
        Math.PI * 2,
        rng
      );
      break;

    case 'diagonal':
      curve = generateDiagonalCurve(
        canvasWidth * 0.1,
        canvasHeight * 0.1,
        canvasWidth * 0.9,
        canvasHeight * 0.9,
        20 + rng() * 30,
        rng
      );
      break;

    case 'arc':
      curve = generateCircleCurve(
        canvasWidth / 2,
        canvasHeight,
        Math.min(canvasWidth, canvasHeight) * 0.5,
        Math.PI * 0.2,
        Math.PI * 0.8,
        rng
      );
      break;

    case 'zigzag':
      curve = generateZigzagCurve(
        canvasWidth * 0.1,
        canvasHeight / 2,
        canvasWidth * 0.9,
        canvasHeight * (0.1 + rng() * 0.05),
        3 + Math.floor(rng() * 3),
        rng
      );
      break;

    case 'fibonacci':
      curve = generateSpiralCurve(
        canvasWidth * (0.4 + rng() * 0.2),
        canvasHeight * (0.4 + rng() * 0.2),
        1.618, // Phi
        Math.min(canvasWidth, canvasHeight) * 0.35,
        rng
      );
      break;

    case 'random-organic':
    default:
      curve = generateOrganicCurve(
        canvasWidth,
        canvasHeight,
        5 + Math.floor(rng() * 5),
        rng
      );
      break;
  }

  // Pick a generator
  const generatorType = config.generatorType || pickGenerator(rng);
  const generatorParams = generateGeneratorParams(generatorType, rng);

  // Create generator config
  const generatorConfig: GeneratorConfig = {
    id: nanoid(),
    type: generatorType,
    weight: 1,
    params: generatorParams,
  };

  // Calculate curve length to estimate shape count
  const curveLength = curve.length;

  // DRASTICALLY reduce shape count for performance
  // Target: 50-150 shapes maximum for instant generation
  const targetShapes = 50 + rng() * 100; // 50-150 shapes (was 300-600)
  const avgShapeSize = 20; // Average shape size in px (larger shapes = fewer needed)

  // Very small spread to concentrate shapes along the curve
  // This creates a nice aesthetic line without overwhelming the renderer
  const spread = 8 + rng() * 7; // 8-15mm spread (was 15-25mm)

  // Calculate density to achieve target shape count
  // Lower density = fewer shapes = faster generation
  const estimatedDensity = Math.max(0.2, Math.min(0.8, targetShapes / (curveLength * spread / avgShapeSize)));

  // Choose fill mode - prefer grid/noise for performance
  // Packing can be slow for large compositions
  let fillMode: 'grid' | 'noise' | 'random' | 'packed';
  if (config.usePacking) {
    fillMode = 'packed';
    console.warn('⚠️  Packing mode selected - may be slow for large compositions');
  } else {
    fillMode = rng() < 0.6 ? 'noise' : 'grid'; // Favor noise for organic look
  }

  // Create flowpath
  const flowPath: FlowPath = {
    id: nanoid(),
    bezierCurve: curve,
    generators: [generatorConfig],
    flowParams: {
      spread, // 15-25mm spread
      followCurve: 0.7 + rng() * 0.3, // 70-100% follow curve
      fillMode,
      closed: curve.closed || false,
    },
    distributionParams: {
      density: estimatedDensity, // Calculated to target 50-150 shapes
      seed: Math.floor(rng() * 10000),
      minSpacing: 15, // Large spacing to drastically reduce shape count
    },
    modifiers: [],
    timelines: [],
  };

  // Normalize the curve coordinates from absolute pixels to 0-1 range
  const normalizedCurve = new paper.Path();
  curve.segments.forEach((seg: any) => {
    const normalizedPoint = absoluteToNormalized(
      { x: seg.point.x, y: seg.point.y },
      config.paperFormat,
      config.paperOrientation
    );
    normalizedCurve.add(new paper.Point(normalizedPoint.x, normalizedPoint.y));
  });
  normalizedCurve.smooth({ type: 'continuous' });

  // Replace the absolute curve with the normalized one
  flowPath.bezierCurve = normalizedCurve;

  // Generate standalone instances if requested
  const standalones: any[] = [];
  if (config.addStandalones) {
    const numStandalones = 2 + Math.floor(rng() * 4); // 2-5 standalones

    for (let i = 0; i < numStandalones; i++) {
      // Place near golden ratio points or rule of thirds
      const goldenX = rng() < 0.5 ? canvasWidth * 0.382 : canvasWidth * 0.618;
      const goldenY = rng() < 0.5 ? canvasHeight * 0.382 : canvasHeight * 0.618;

      const variation = 100 + rng() * 100;
      const x = goldenX + (rng() - 0.5) * variation;
      const y = goldenY + (rng() - 0.5) * variation;

      standalones.push({
        id: nanoid(),
        generatorType,
        params: generateGeneratorParams(generatorType, rng),
        position: new paper.Point(x, y),
        rotation: rng() * 360,
        scale: 0.8 + rng() * 0.4, // 80-120% scale
        seed: Math.floor(rng() * 10000),
      });
    }
  }

  return { flowPath, standalones };
}

/**
 * Get list of available composition types with descriptions
 */
export function getCompositionTypes(): { type: CompositionType; name: string; description: string }[] {
  return [
    { type: 'spiral', name: 'Golden Spiral', description: 'Classic golden ratio spiral' },
    { type: 'wave', name: 'Wave', description: 'Flowing sine wave' },
    { type: 's-curve', name: 'S-Curve', description: 'Elegant S-shaped composition' },
    { type: 'circle', name: 'Circle', description: 'Circular mandala-like pattern' },
    { type: 'diagonal', name: 'Diagonal', description: 'Dynamic diagonal line' },
    { type: 'arc', name: 'Arc', description: 'Graceful arc curve' },
    { type: 'zigzag', name: 'Zigzag', description: 'Angular zigzag pattern' },
    { type: 'fibonacci', name: 'Fibonacci', description: 'Fibonacci spiral approximation' },
    { type: 'random-organic', name: 'Organic', description: 'Random organic flowing curve' },
  ];
}
