import paper from 'paper';
import type { Generator, Shape, ParamDefinition } from '../types';
import { seededRandom, lerp } from '../utils/random';
import { mmToPx } from '../types/formats';

export class PolygonGenerator implements Generator {
  type = 'polygon';
  name = 'Polygon';
  description = 'Geometric shapes with 3-12 sides and adjustable regularity';
  tags = ['geometric', 'shape', 'abstract', 'mathematical'];

  generate(t: number, params: Record<string, any>, seed: number): Shape {
    const rng = seededRandom(seed);

    // Get parameters (convert size from mm to px)
    const sizeMm = lerp(params.sizeMin, params.sizeMax, rng());
    const size = mmToPx(sizeMm);
    const sides = Math.floor(params.sides);
    const regularity = params.regularity;

    // Create polygon
    const polygon = new paper.Path();
    const angleStep = (Math.PI * 2) / sides;

    for (let i = 0; i < sides; i++) {
      const angle = i * angleStep - Math.PI / 2; // Start at top

      // Add irregularity
      const radiusVariation = regularity < 1 ? (rng() - 0.5) * (1 - regularity) : 0;
      const radius = (size / 2) * (1 + radiusVariation);

      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      polygon.add(new paper.Point(x, y));
    }

    polygon.closed = true;

    // Smooth if regularity is high
    if (regularity > 0.7) {
      polygon.smooth({ type: 'continuous' });
    }

    polygon.strokeColor = new paper.Color('black');
    polygon.strokeWidth = 1;

    const paths: paper.Path[] = [polygon];

    // Add center point if detail is enabled
    if (params.centerDot) {
      const center = new paper.Path.Circle({
        center: new paper.Point(0, 0),
        radius: size * 0.1,
      });
      center.strokeColor = new paper.Color('black');
      center.strokeWidth = 1;
      paths.push(center);
    }

    // Calculate bounds and then remove paths from Paper.js
    // (they will be cloned when rendered, originals should not persist)
    const bounds = polygon.bounds.clone();
    paths.forEach(path => path.remove());

    return {
      paths,
      bounds,
      anchor: new paper.Point(0, 0),
    };
  }

  getDefaultParams(): Record<string, any> {
    return {
      sizeMin: 3,
      sizeMax: 10,
      sides: 5,
      regularity: 0.8,
      centerDot: false,
    };
  }

  getParamDefinitions(): ParamDefinition[] {
    return [
      {
        name: 'sizeMin',
        type: 'number',
        min: 1,
        max: 50,
        step: 0.5,
        label: 'Taille min (mm)',
        description: 'Taille minimale des polygones en millimètres',
        defaultValue: 3,
      },
      {
        name: 'sizeMax',
        type: 'number',
        min: 1,
        max: 50,
        step: 0.5,
        label: 'Taille max (mm)',
        description: 'Taille maximale des polygones en millimètres',
        defaultValue: 10,
      },
      {
        name: 'sides',
        type: 'number',
        min: 3,
        max: 12,
        step: 1,
        label: 'Côtés',
        description: 'Nombre de côtés du polygone',
        defaultValue: 5,
      },
      {
        name: 'regularity',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.1,
        label: 'Régularité',
        description: 'Régularité du polygone (0=irrégulier, 1=régulier)',
        defaultValue: 0.8,
      },
      {
        name: 'centerDot',
        type: 'checkbox',
        label: 'Point central',
        description: 'Ajouter un point au centre',
        defaultValue: false,
      },
    ];
  }
}
