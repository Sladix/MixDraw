import paper from 'paper';
import type { FlowPath, GeneratedInstance, Shape, FlowParams, AnyModifier } from '../types';
import { generateTValues } from './distribution';
import { generateTubePositions } from './tubeFilling';
import { weightedRandomChoice, seededRandom } from '../utils/random';
import { GeneratorRegistry } from './GeneratorRegistry';
import { mmToPx } from '../types/formats';
import {
  calculateSizeMultiplier,
  calculateRotationOffset,
  calculateAverageGeneratorSize,
} from './modifierEngine';

/**
 * Regenerate all instances along a FlowPath
 * @param flowPath - FlowPath to regenerate
 * @returns Array of generated instances
 */
export function regenerateFlowPath(flowPath: FlowPath): GeneratedInstance[] {
  console.log(`🔄 regenerateFlowPath() - FlowPath ID: ${flowPath.id}`);
  const curveLength = flowPath.bezierCurve.length;
  console.log(`  🔍 Curve length: ${curveLength.toFixed(2)}`);

  // Check if using new tube filling system or old 1D distribution
  const useNewSystem = flowPath.flowParams.spread !== undefined && flowPath.flowParams.fillMode !== undefined;

  if (useNewSystem) {
    // NEW SYSTEM: 2D tube filling
    console.log(`  🎨 Using NEW tube filling system`);
    return regenerateFlowPathWithTubeFilling(flowPath);
  } else {
    // OLD SYSTEM: 1D distribution with deviation
    console.log(`  📏 Using OLD 1D distribution system`);
    return regenerateFlowPathLegacy(flowPath);
  }
}

/**
 * NEW SYSTEM: Regenerate FlowPath using 2D tube filling
 */
function regenerateFlowPathWithTubeFilling(flowPath: FlowPath): GeneratedInstance[] {
  const avgShapeSize = calculateAverageGeneratorSize(flowPath.generators);
  const packingMode = flowPath.distributionParams.packingMode || 'normal';

  // Generate 2D positions within tube
  const tubePositions = generateTubePositions(
    flowPath.bezierCurve,
    flowPath.flowParams.spread,
    flowPath.flowParams.fillMode,
    flowPath.distributionParams.density,
    avgShapeSize,
    packingMode,
    flowPath.modifiers || [],
    flowPath.distributionParams.seed
  );

  console.log(`  🔍 Generated ${tubePositions.length} 2D tube positions`);

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

    const shape = generator.generate(
      tubePos.t,
      generatorConfig.params,
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
      tubePos.t
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

  console.log(`  ✅ Generated ${instances.length} total instances (tube filling)`);

  // Apply boids simulation if enabled
  if (flowPath.flowParams.boidsStrength > 0) {
    applyBoidsSimulation(instances, flowPath.flowParams);
  }

  return instances;
}

/**
 * OLD SYSTEM: Regenerate FlowPath using 1D distribution
 * Kept for backward compatibility
 */
function regenerateFlowPathLegacy(flowPath: FlowPath): GeneratedInstance[] {
  const curveLength = flowPath.bezierCurve.length;

  // 1. Generate t values based on distribution mode
  // Pass curve, generators and modifiers for visual density calculations
  const tValues = generateTValues(
    flowPath.distributionParams,
    flowPath.bezierCurve,
    flowPath.generators.length,
    flowPath.generators,
    flowPath.modifiers || []
  );
  console.log(`  🔍 Generated ${tValues.length} t-values for ${flowPath.generators.length} generator(s)`);

  // 2. Generate shapes at each t position
  const instances = tValues.map((t, index) => {
    // Choose generator based on weights
    if (flowPath.generators.length === 0) {
      throw new Error('FlowPath has no generators');
    }

    const generatorConfig = weightedRandomChoice(
      flowPath.generators,
      flowPath.distributionParams.seed + index
    );

    // Get curve information at t
    const offset = t * curveLength;
    const basePoint = flowPath.bezierCurve.getPointAt(offset);
    const tangent = flowPath.bezierCurve.getTangentAt(offset);
    const normal = flowPath.bezierCurve.getNormalAt(offset);

    // Generate shape (pure function!)
    const generator = GeneratorRegistry.get(generatorConfig.type);
    if (!generator) {
      throw new Error(`Generator "${generatorConfig.type}" not found`);
    }

    const shape = generator.generate(
      t,
      generatorConfig.params,
      flowPath.distributionParams.seed + index
    );

    // Apply flow transformations
    const transformedShape = applyFlowTransform(
      shape,
      basePoint,
      tangent,
      normal,
      flowPath.flowParams,
      flowPath.modifiers || [],
      flowPath.distributionParams.seed + index,
      generatorConfig,
      t // Pass t for modifiers and deviation gradient
    );

    const instance: GeneratedInstance = {
      id: `${flowPath.id}-instance-${index}`,
      shape: transformedShape,
      position: basePoint,
      rotation: 0,
      scale: 1,
      sourceId: flowPath.id,
      generatorType: generatorConfig.type,
    };

    return instance;
  });

  console.log(`  ✅ Generated ${instances.length} total instances`);

  // 3. Apply boids simulation if enabled
  if (flowPath.flowParams.boidsStrength > 0) {
    applyBoidsSimulation(instances, flowPath.flowParams);
  }

  return instances;
}

/**
 * Apply flow transformations to a shape
 * @param shape - Original shape
 * @param basePoint - Position on curve
 * @param tangent - Tangent vector at position
 * @param normal - Normal vector at position
 * @param flowParams - Flow parameters
 * @param modifiers - Array of modifiers to apply
 * @param seed - Random seed for this instance
 * @param generatorConfig - Generator configuration (for followNormal setting)
 * @param t - Normalized position along curve [0, 1] for modifiers and deviation gradient
 * @returns Transformed shape
 */
function applyFlowTransform(
  shape: Shape,
  basePoint: paper.Point,
  tangent: paper.Point,
  normal: paper.Point,
  flowParams: FlowParams,
  modifiers: AnyModifier[],
  seed: number,
  generatorConfig: any,
  t: number = 0
): Shape {
  // Calculate rotation based on curve following
  let curveAngle: number;

  if (generatorConfig.followNormal) {
    // Point toward the normal (perpendicular to curve)
    curveAngle = Math.atan2(normal.y, normal.x);
  } else {
    // Point along the tangent (default behavior)
    curveAngle = Math.atan2(tangent.y, tangent.x);
  }

  const followRotation = (curveAngle * flowParams.followCurve * 180) / Math.PI;

  // Apply rotation modifier
  const rotationOffset = calculateRotationOffset(t, modifiers);

  // Calculate position with deviation
  const rng = seededRandom(seed);

  // Apply gradient to deviation (cone dispersion effect)
  let deviationMultiplier = 1;
  if (flowParams.deviationGradient?.enabled) {
    const gradient = flowParams.deviationGradient;
    const { startMultiplier, endMultiplier, startT, endT, reverse } = gradient;

    // Clamp t to the gradient range
    if (t >= startT && t <= endT) {
      // Calculate normalized position within the gradient range
      const normalizedT = (t - startT) / (endT - startT);

      // Apply reverse if needed
      const effectiveT = reverse ? 1 - normalizedT : normalizedT;

      // Lerp between start and end multipliers
      deviationMultiplier = startMultiplier + effectiveT * (endMultiplier - startMultiplier);
    } else if (t < startT) {
      // Before gradient range
      deviationMultiplier = reverse ? endMultiplier : startMultiplier;
    } else {
      // After gradient range
      deviationMultiplier = reverse ? startMultiplier : endMultiplier;
    }
  }

  // Convert deviation and normalOffset from mm to px
  const effectiveDeviationMm = flowParams.deviation * deviationMultiplier;
  const effectiveDeviation = mmToPx(effectiveDeviationMm);

  const deviation = (rng() - 0.5) * 2 * effectiveDeviation;
  const normalOffset = mmToPx(flowParams.normalOffset);

  const finalPosition = basePoint
    .add(normal.multiply(normalOffset))
    .add(normal.multiply(deviation));

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

    // Apply translation
    transformed.position = transformed.position
      .subtract(shape.anchor)
      .add(finalPosition);

    return transformed;
  });

  return {
    paths: transformedPaths,
    bounds: shape.bounds,
    anchor: finalPosition,
  };
}

/**
 * Apply transformations for tube filling system (simpler than old system)
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
  t: number
): Shape {
  // Calculate rotation based on curve following
  let curveAngle: number;

  if (generatorConfig.followNormal) {
    // Point toward the normal (perpendicular to curve)
    curveAngle = Math.atan2(normal.y, normal.x);
  } else {
    // Point along the tangent (default behavior)
    curveAngle = Math.atan2(tangent.y, tangent.x);
  }

  const followRotation = (curveAngle * flowParams.followCurve * 180) / Math.PI;

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
 * Apply simplified boids simulation to instances
 * @param instances - Array of instances to modify
 * @param flowParams - Flow parameters
 */
function applyBoidsSimulation(
  instances: GeneratedInstance[],
  flowParams: FlowParams
): void {
  const { boidsStrength, boidsRadius } = flowParams;

  if (boidsStrength === 0) return;

  // Convert boids radius from mm to px
  const boidsRadiusPx = mmToPx(boidsRadius);

  // Simple boids: each instance is attracted to nearby instances
  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i];
    const position = instance.shape.anchor;

    let avgX = 0;
    let avgY = 0;
    let count = 0;

    // Find nearby instances
    for (let j = 0; j < instances.length; j++) {
      if (i === j) continue;

      const other = instances[j];
      const otherPos = other.shape.anchor;
      const distance = position.getDistance(otherPos);

      if (distance < boidsRadiusPx) {
        avgX += otherPos.x;
        avgY += otherPos.y;
        count++;
      }
    }

    if (count > 0) {
      avgX /= count;
      avgY /= count;

      // Move towards average position
      const targetX = position.x + (avgX - position.x) * boidsStrength;
      const targetY = position.y + (avgY - position.y) * boidsStrength;

      const offset = new paper.Point(targetX - position.x, targetY - position.y);

      // Apply offset to all paths
      instance.shape.paths.forEach((path) => {
        path.position = path.position.add(offset);
      });

      instance.shape.anchor = new paper.Point(targetX, targetY);
    }
  }
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

  const shape = generator.generate(0.5, params, seed);

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
