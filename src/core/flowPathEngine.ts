import paper from 'paper';
import type { FlowPath, GeneratedInstance, Shape, AnyModifier, Timeline, FlowParams, MinMaxValue } from '../types';
import { isMinMaxValue } from '../types';
import { generateTubePositions } from './tubeFilling';
import { weightedRandomChoice, seededRandom, lerp } from '../utils/random';
import { GeneratorRegistry } from './GeneratorRegistry';
import {
  calculateSizeMultiplier,
  calculateRotationOffset,
  calculateAverageGeneratorSize,
  calculateSpreadWidth,
} from './modifierEngine';
import { applyTimelineToParam } from '../utils/interpolation';
import { evaluateAnimatableParams } from '../utils/animatable';

/**
 * Helper function to evaluate a value that may be a number or MinMaxValue
 * @param value - The value to evaluate
 * @param rng - Random number generator
 * @returns Evaluated number value
 */
function evaluateMinMaxValue(value: number | MinMaxValue, rng: () => number): number {
  if (isMinMaxValue(value)) {
    return lerp(value.min, value.max, rng());
  }
  return value;
}

/**
 * Regenerate all instances along a FlowPath using 2D tube filling
 * @param flowPath - FlowPath to regenerate
 * @returns Array of generated instances
 */
export function regenerateFlowPath(flowPath: FlowPath): GeneratedInstance[] {
  const avgShapeSize = calculateAverageGeneratorSize(flowPath.generators);
  const packingMode = flowPath.distributionParams.packingMode || 'normal';

  // Pre-calculate accurate bounds for each generator by sampling
  const generatorBounds = new Map<string, number>();
  for (const genConfig of flowPath.generators) {
    const generator = GeneratorRegistry.get(genConfig.type);
    if (generator) {
      // Evaluate parameters at middle of path for representative sample
      const sampleRng = seededRandom(flowPath.distributionParams.seed);
      const evaluatedSampleParams = evaluateAnimatableParams(
        genConfig.params,
        0.5, // Middle of path
        sampleRng,
        flowPath.timelines,
        `gen.${genConfig.id}` // Pass generator ID as prefix
      );

      // Generate sample shape to get accurate bounds
      const sampleShape = generator.generate(0.5, evaluatedSampleParams, 0);

      // Calculate bounding circle radius from actual geometry
      let maxRadius = 0;
      for (const path of sampleShape.paths) {
        const bounds = path.bounds;
        const width = bounds.width;
        const height = bounds.height;
        // Use circumradius (diagonal / 2) for conservative estimate
        const radius = Math.sqrt(width * width + height * height) / 2;
        maxRadius = Math.max(maxRadius, radius);
        path.remove(); // Clean up
      }

      generatorBounds.set(genConfig.id, maxRadius);
    }
  }

  // Create RNG for evaluating MinMaxValues
  const minMaxRng = seededRandom(flowPath.distributionParams.seed + 999);

  // Create evaluator functions that combine base values + modifiers + timelines
  const spreadEvaluator = (t: number): number => {
    // Evaluate MinMaxValue if needed, then apply timeline
    const evaluatedSpread = evaluateMinMaxValue(flowPath.flowParams.spread, minMaxRng);
    const withTimeline = applyTimelineToParam(t, 'spread', evaluatedSpread, flowPath.timelines);
    return calculateSpreadWidth(t, flowPath.modifiers || [], withTimeline);
  };

  const densityEvaluator = (t: number): number => {
    // Evaluate MinMaxValue if needed, then apply timeline
    const evaluatedDensity = evaluateMinMaxValue(flowPath.distributionParams.density, minMaxRng);
    return applyTimelineToParam(t, 'density', evaluatedDensity, flowPath.timelines);
  };

  // Generate 2D positions within tube with accurate bounds
  const minSpacing = flowPath.distributionParams.minSpacing ?? 0;
  const tubePositions = generateTubePositions(
    flowPath.bezierCurve,
    spreadEvaluator,
    flowPath.flowParams.fillMode,
    densityEvaluator,
    avgShapeSize,
    packingMode,
    minSpacing,
    flowPath.modifiers || [],
    flowPath.distributionParams.seed,
    flowPath.generators,
    generatorBounds
  );

  // Generate shapes at each 2D position
  const instances = tubePositions.map((tubePos, index) => {
    // Choose generator based on weights
    if (flowPath.generators.length === 0) {
      throw new Error('FlowPath has no generators');
    }

    const generatorConfig = weightedRandomChoice(
      flowPath.generators,
      flowPath.distributionParams.seed + index
    );

    // Get curve information at t
    const offset = tubePos.t * flowPath.bezierCurve.length;
    const tangent = flowPath.bezierCurve.getTangentAt(offset);
    const normal = flowPath.bezierCurve.getNormalAt(offset);

    // Generate shape (pure function!)
    const generator = GeneratorRegistry.get(generatorConfig.type);
    if (!generator) {
      throw new Error(`Generator "${generatorConfig.type}" not found`);
    }

    // Evaluate animatable parameters at this position t
    // Pass generator ID as prefix for parameter lookup (e.g., "gen.abc123")
    const rng = seededRandom(flowPath.distributionParams.seed + index);
    const evaluatedParams = evaluateAnimatableParams(
      generatorConfig.params,
      tubePos.t,
      rng,
      flowPath.timelines,
      `gen.${generatorConfig.id}`
    );

    const shape = generator.generate(
      tubePos.t,
      evaluatedParams,
      flowPath.distributionParams.seed + index
    );

    // Apply transformations (rotation from curve, size/rotation modifiers)
    const transformedShape = applyTubeTransform(
      shape,
      tubePos.position,
      tangent,
      normal,
      flowPath.flowParams,
      flowPath.modifiers || [],
      generatorConfig,
      tubePos.t,
      flowPath.timelines,
      rng
    );

    const instance: GeneratedInstance = {
      id: `${flowPath.id}-instance-${index}`,
      shape: transformedShape,
      position: tubePos.position,
      rotation: 0,
      scale: 1,
      sourceId: flowPath.id,
      generatorType: generatorConfig.type,
    };

    return instance;
  });

  return instances;
}

/**
 * Apply transformations for tube filling system
 * Position is already calculated by tube filling algorithm
 *
 * @param shape - Original shape
 * @param position - Already calculated 2D position
 * @param tangent - Tangent vector at position
 * @param normal - Normal vector at position
 * @param flowParams - Flow parameters
 * @param modifiers - Array of modifiers to apply
 * @param generatorConfig - Generator configuration
 * @param t - Normalized position along curve
 * @returns Transformed shape
 */
function applyTubeTransform(
  shape: Shape,
  position: paper.Point,
  tangent: paper.Point,
  normal: paper.Point,
  flowParams: FlowParams,
  modifiers: AnyModifier[],
  generatorConfig: any,
  t: number,
  timelines?: Timeline[],
  rng?: () => number
): Shape {
  // Evaluate MinMaxValue if needed, then apply timeline
  const evaluatedFollowCurve = rng
    ? evaluateMinMaxValue(flowParams.followCurve, rng)
    : (typeof flowParams.followCurve === 'number' ? flowParams.followCurve : (flowParams.followCurve.min + flowParams.followCurve.max) / 2);
  const followCurve = applyTimelineToParam(t, 'followCurve', evaluatedFollowCurve, timelines);

  // Calculate rotation based on curve following
  let curveAngle: number;

  if (generatorConfig.followNormal) {
    // Point toward the normal (perpendicular to curve)
    curveAngle = Math.atan2(normal.y, normal.x);
  } else {
    // Point along the tangent (default behavior)
    curveAngle = Math.atan2(tangent.y, tangent.x);
  }

  const followRotation = (curveAngle * followCurve * 180) / Math.PI;

  // Apply rotation modifier
  const rotationOffset = calculateRotationOffset(t, modifiers);

  // Apply size modifier
  const sizeMultiplier = calculateSizeMultiplier(t, modifiers);

  // Clone and transform all paths
  const transformedPaths = shape.paths.map((path) => {
    const transformed = path.clone();

    // Apply size scaling at anchor point
    if (sizeMultiplier !== 1.0) {
      transformed.scale(sizeMultiplier, shape.anchor);
    }

    // Apply rotation (flow following + modifier)
    const totalRotation = followRotation + rotationOffset;
    transformed.rotate(totalRotation, shape.anchor);

    // Apply translation to final position
    transformed.position = transformed.position.subtract(shape.anchor).add(position);

    return transformed;
  });

  return {
    paths: transformedPaths,
    bounds: shape.bounds,
    anchor: position,
  };
}

/**
 * Generate a standalone generator instance
 * @param generatorType - Type of generator
 * @param params - Generator parameters
 * @param position - Position on canvas
 * @param rotation - Rotation in degrees
 * @param scale - Scale factor
 * @param seed - Random seed
 * @returns Generated instance
 */
export function generateStandaloneInstance(
  generatorType: string,
  params: Record<string, any>,
  position: paper.Point,
  rotation: number,
  scale: number,
  seed: number
): GeneratedInstance {
  const generator = GeneratorRegistry.get(generatorType);
  if (!generator) {
    throw new Error(`Generator "${generatorType}" not found`);
  }

  // Evaluate animatable parameters before passing to generator
  const rng = seededRandom(seed);
  const evaluatedParams = evaluateAnimatableParams(params, 0.5, rng);

  const shape = generator.generate(0.5, evaluatedParams, seed);

  // Transform shape
  const transformedPaths = shape.paths.map((path) => {
    const transformed = path.clone();
    transformed.scale(scale);
    transformed.rotate(rotation, shape.anchor);
    transformed.position = transformed.position
      .subtract(shape.anchor)
      .add(position);
    return transformed;
  });

  return {
    id: `standalone-${seed}`,
    shape: {
      paths: transformedPaths,
      bounds: shape.bounds,
      anchor: position,
    },
    position,
    rotation,
    scale,
    sourceId: `standalone-${seed}`,
    generatorType,
  };
}
