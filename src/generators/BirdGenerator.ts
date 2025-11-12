import paper from 'paper';
import type { Generator, Shape, ParamDefinition } from '../types';
import { seededRandom, getMinMaxValue } from '../utils/random';
import { mmToPx } from '../types/formats';

export class BirdGenerator implements Generator {
  type = 'bird';
  name = 'Bird';
  description = 'Flying bird silhouettes with adjustable wings and detail levels';
  tags = ['nature', 'animal', 'organic', 'flying'];

  generate(t: number, params: Record<string, any>, seed: number): Shape {
    const rng = seededRandom(seed);

    // Get size from range (convert from mm to px)
    const sizeMm = getMinMaxValue(params.size, rng);
    const size = mmToPx(sizeMm);
    const wingSpan = params.wingSpan;
    const wingAngle = params.wingAngle;

    // Create bird body (ellipse) - stroke only for plotter
    const body = new paper.Path.Ellipse({
      center: new paper.Point(0, 0),
      size: new paper.Size(size, size * 0.6),
    });

    // Create left wing (curved path)
    const leftWing = new paper.Path();
    leftWing.add(new paper.Point(0, 0));
    leftWing.add(
      new paper.Point(-size * wingSpan * 0.7, -size * 0.2 - size * wingAngle)
    );
    leftWing.add(
      new paper.Point(-size * wingSpan, -size * 0.1 + size * wingAngle)
    );
    leftWing.add(new paper.Point(-size * wingSpan * 0.5, size * 0.3));
    leftWing.smooth({ type: 'continuous' });
    leftWing.closed = true;
    leftWing.strokeColor = new paper.Color('black');

    // Create right wing (mirror of left)
    const rightWing = leftWing.clone();
    rightWing.scale(-1, 1, new paper.Point(0, 0));

    // Add head detail if detail level is high enough
    const paths: paper.Path[] = [body, leftWing, rightWing];

    if (params.detailLevel > 0.5) {
      const head = new paper.Path.Circle({
        center: new paper.Point(size * 0.4, -size * 0.1),
        radius: size * 0.25,
      });
      head.strokeColor = new paper.Color('black');
      paths.push(head);
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
      size: { min: 3, max: 8 },
      wingSpan: 0.8,
      wingAngle: 0.3,
      detailLevel: 0.5,
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
        description: 'Taille des oiseaux en millimètres',
        defaultValue: { min: 3, max: 8 },
      },
      {
        name: 'wingSpan',
        type: 'slider',
        min: 0.3,
        max: 1.5,
        step: 0.1,
        label: 'Envergure',
        description: 'Largeur des ailes relative au corps',
        defaultValue: 0.8,
      },
      {
        name: 'wingAngle',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.1,
        label: 'Angle des ailes',
        description: 'Angle des ailes (0=plat, 1=levé)',
        defaultValue: 0.3,
      },
      {
        name: 'detailLevel',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.1,
        label: 'Niveau de détail',
        description: 'Plus de détails = tête visible',
        defaultValue: 0.5,
      },
    ];
  }
}
