import paper from 'paper';
import type { Generator, Shape, ParamDefinition } from '../types';
import { mmToPx } from '../types/formats';
import { seededRandom, getMinMaxValue, lerp } from '../utils/random';

/**
 * Grass Generator
 * Creates minimalist, organic grass blades with natural variation
 *
 * Features:
 * - Curved blade with subtle wave
 * - Random lean/sway
 * - Variable thickness (thicker at base, thinner at tip)
 * - Optional seed head/detail at top
 */
export class GrassGenerator implements Generator {
  type = 'grass';
  name = 'Grass Blade';
  description = 'Minimalist organic grass blades with natural sway';
  tags = ['nature', 'organic', 'plant', 'minimal'];

  generate(t: number, params: Record<string, any>, seed: number): Shape {
    const rng = seededRandom(seed + t * 1000);

    // Size parameters (in mm, converted to px)
    const heightMm = getMinMaxValue(params.height, rng);
    const height = mmToPx(heightMm);
    const baseWidth = mmToPx(params.baseWidth);

    // Blade curvature and sway
    const sway = getMinMaxValue(params.sway, rng);
    const curve = params.curvature * (rng() - 0.5) * 2; // -1 to 1 range

    // Build grass blade as a tapered curved path
    const blade = new paper.Path();
    blade.strokeColor = new paper.Color('black');
    blade.strokeCap = 'round';

    // Number of segments for smooth curve
    const segments = 8;

    for (let i = 0; i <= segments; i++) {
      const progress = i / segments; // 0 to 1

      // Y position (vertical)
      const y = -height * progress; // Negative = upward

      // X position (horizontal sway + curve)
      // Sway increases with height (more movement at top)
      const swayAmount = sway * height * progress * progress; // Quadratic for natural bend
      const curveAmount = curve * height * Math.sin(progress * Math.PI); // Sine wave for smooth curve
      const x = swayAmount + curveAmount;

      blade.add(new paper.Point(x, y));
    }

    blade.smooth({ type: 'continuous' });

    // Optional seed head at tip
    const paths: paper.Path[] = [blade];

    if (params.seedHead && rng() < params.seedHeadChance) {
      const tipPoint = blade.lastSegment.point;

      // Small oval/circle at tip
      const seedSize = mmToPx(params.seedHeadSize);
      const seedHead = new paper.Path.Ellipse({
        center: tipPoint,
        size: [seedSize * 0.6, seedSize],
        fillColor: new paper.Color('black'),
      });

      paths.push(seedHead);
    }

    // Optional base tuft (few short lines at base for detail)
    if (params.baseTuft && rng() < 0.5) {
      const tuftLines = Math.floor(lerp(2, 4, rng()));
      const tuftHeight = height * 0.15; // 15% of blade height

      for (let i = 0; i < tuftLines; i++) {
        const tuftAngle = (rng() - 0.5) * 60; // -30 to 30 degrees
        const tuftLength = lerp(tuftHeight * 0.5, tuftHeight, rng());

        const tuft = new paper.Path.Line({
          from: new paper.Point(baseWidth * (rng() - 0.5), 0),
          to: new paper.Point(
            Math.sin((tuftAngle * Math.PI) / 180) * tuftLength,
            -tuftLength
          ),
          strokeCap: 'round',
        });

        paths.push(tuft);
      }
    }

    // Calculate bounds
    const group = new paper.Group(paths);
    const bounds = group.bounds;
    group.remove();

    return {
      paths,
      bounds,
      anchor: new paper.Point(0, 0), // Anchor at base
    };
  }

  getDefaultParams() {
    return {
      height: { min: 8, max: 20 },  // mm
      baseWidth: 2,      // mm (spread at base)
      sway: { min: -0.3, max: 0.3 },  // Sway multiplier (negative = left, positive = right)
      curvature: 0.5,    // How much the blade curves (0 = straight, 1 = very curved)
      seedHead: true,
      seedHeadChance: 0.3,  // 30% chance
      seedHeadSize: 1.5,    // mm
      baseTuft: true,
    };
  }

  getParamDefinitions(): ParamDefinition[] {
    return [
      {
        name: 'height',
        type: 'minmax',
        min: 3,
        max: 40,
        step: 0.5,
        unit: 'mm',
        label: 'Height',
        defaultValue: { min: 8, max: 20 },
      },
      {
        name: 'baseWidth',
        type: 'slider',
        min: 0.5,
        max: 5,
        step: 0.1,
        label: 'Base Width (mm)',
        defaultValue: 2,
      },
      {
        name: 'sway',
        type: 'minmax',
        min: -1,
        max: 1,
        step: 0.05,
        unit: '',
        label: 'Sway',
        defaultValue: { min: -0.3, max: 0.3 },
      },
      {
        name: 'curvature',
        type: 'slider',
        min: 0,
        max: 2,
        step: 0.1,
        label: 'Curvature',
        defaultValue: 0.5,
      },
      {
        name: 'seedHead',
        type: 'checkbox',
        label: 'Seed Heads',
        defaultValue: true,
      },
      {
        name: 'seedHeadChance',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.05,
        label: 'Seed Head Chance',
        defaultValue: 0.3,
      },
      {
        name: 'baseTuft',
        type: 'checkbox',
        label: 'Base Tuft Detail',
        defaultValue: true,
      },
    ];
  }
}
