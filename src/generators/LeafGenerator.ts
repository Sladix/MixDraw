import paper from 'paper';
import type { Generator, Shape, ParamDefinition } from '../types';
import { seededRandom, lerp } from '../utils/random';
import { mmToPx } from '../types/formats';

export class LeafGenerator implements Generator {
  type = 'leaf';
  name = 'Leaf';
  description = 'Organic leaf shapes with customizable curvature and veins';
  tags = ['nature', 'plant', 'organic', 'botanical'];

  generate(t: number, params: Record<string, any>, seed: number): Shape {
    const rng = seededRandom(seed);

    // Size is already evaluated to a plain number by flowPathEngine
    const size = mmToPx(params.size);
    const curvature = params.curvature;
    const veins = params.veins;

    // Create leaf outline
    const leaf = new paper.Path();
    const tipY = -size;
    const baseY = 0;
    const maxWidth = size * 0.4;

    // Build leaf shape
    leaf.add(new paper.Point(0, tipY)); // Tip

    // Right side
    for (let i = 1; i <= 10; i++) {
      const progress = i / 10;
      const y = lerp(tipY, baseY, progress);
      const width = Math.sin(progress * Math.PI) * maxWidth;
      const curve = Math.sin(progress * Math.PI) * curvature * size * 0.1;
      leaf.add(new paper.Point(width + curve, y));
    }

    // Base point
    leaf.add(new paper.Point(0, baseY));

    // Left side
    for (let i = 10; i >= 1; i--) {
      const progress = i / 10;
      const y = lerp(tipY, baseY, progress);
      const width = Math.sin(progress * Math.PI) * maxWidth;
      const curve = Math.sin(progress * Math.PI) * curvature * size * 0.1;
      leaf.add(new paper.Point(-width + curve, y));
    }

    leaf.closed = true;
    leaf.smooth({ type: 'continuous' });
    leaf.strokeColor = new paper.Color('black');

    const paths: paper.Path[] = [leaf];

    // Add veins if enabled
    if (veins > 0) {
      const veinCount = Math.floor(veins * 5);
      for (let i = 1; i <= veinCount; i++) {
        const progress = i / (veinCount + 1);
        const y = lerp(tipY * 0.9, baseY * 0.1, progress);
        const width = Math.sin(progress * Math.PI) * maxWidth * 0.8;

        const vein = new paper.Path();
        vein.add(new paper.Point(0, y));
        vein.add(new paper.Point(width * rng(), y + size * 0.05));
        vein.strokeColor = new paper.Color('black');
        paths.push(vein);

        const vein2 = vein.clone();
        vein2.scale(-1, 1, new paper.Point(0, y));
        paths.push(vein2);
      }
    }

    // Calculate bounds and remove all paths from Paper.js
    // (they will be cloned when rendered, originals should not persist)
    const group = new paper.Group(paths);
    const bounds = group.bounds.clone();
    group.remove();
    paths.forEach(path => path.remove());

    return {
      paths,
      bounds,
      anchor: new paper.Point(0, 0),
    };
  }

  getDefaultParams(): Record<string, any> {
    return {
      size: { min: 5, max: 12 },
      curvature: 0.3,
      veins: 0.5,
    };
  }

  getParamDefinitions(): ParamDefinition[] {
    return [
      {
        name: 'size',
        type: 'minmax',
        min: 1,
        max: 50,
        step: 0.5,
        unit: 'mm',
        label: 'Taille',
        description: 'Taille des feuilles en millimètres',
        defaultValue: { min: 5, max: 12 },
      },
      {
        name: 'curvature',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.1,
        label: 'Courbure',
        description: 'Courbure de la feuille',
        defaultValue: 0.3,
      },
      {
        name: 'veins',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.1,
        label: 'Nervures',
        description: 'Nombre de nervures (0=aucune, 1=max)',
        defaultValue: 0.5,
      },
    ];
  }
}
