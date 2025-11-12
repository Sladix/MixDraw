import paper from 'paper';
import type { Generator, Shape, ParamDefinition } from '../types';
import { mmToPx } from '../types/formats';
import { seededRandom, getMinMaxValue, lerp } from '../utils/random';
import { LeafGenerator } from './LeafGenerator';

/**
 * Tree Generator
 * Creates minimalist, organic trees with branching structure
 *
 * Features:
 * - Recursive branching with natural variation
 * - Trunk tapers from base to top
 * - Branches get thinner and shorter at each level
 * - Simple canopy option (circular blob or individual leaves)
 */
export class TreeGenerator implements Generator {
  type = 'tree';
  name = 'Tree';
  description = 'Minimalist organic trees with natural branching';
  tags = ['nature', 'organic', 'plant', 'minimal'];

  generate(t: number, params: Record<string, any>, seed: number): Shape {
    const rng = seededRandom(seed + t * 1000);

    // Size parameters
    const heightMm = getMinMaxValue(params.height, rng);
    const trunkHeight = mmToPx(heightMm);
    const trunkWidth = mmToPx(params.trunkWidth);

    const paths: paper.Path[] = [];

    // Branch recursion parameters
    const branchAngleSpread = params.branchAngle;
    const branchLengthRatio = params.branchLengthRatio;
    const branchWidthRatio = params.branchWidthRatio;
    const maxDepth = Math.floor(params.branchDepth);

    // Initialize leaf generator if using leaves
    const leafGenerator = params.canopyStyle === 'leaves' ? new LeafGenerator() : null;

    /**
     * Recursive branch drawing
     */
    const drawBranch = (
      startPoint: paper.Point,
      angle: number,
      length: number,
      width: number,
      depth: number
    ) => {
      if (depth > maxDepth || length < mmToPx(1)) return;

      // Calculate end point
      const endX = startPoint.x + Math.sin((angle * Math.PI) / 180) * length;
      const endY = startPoint.y - Math.cos((angle * Math.PI) / 180) * length; // Negative = upward
      const endPoint = new paper.Point(endX, endY);

      // Draw branch as tapered path (thicker at base, thinner at tip)
      if (params.taperedBranches && depth === 0) {
        // Trunk - use tapered shape
        const leftBase = startPoint.add(new paper.Point(-width / 2, 0));
        const rightBase = startPoint.add(new paper.Point(width / 2, 0));
        const leftTop = endPoint.add(new paper.Point(-width * 0.6 / 2, 0));
        const rightTop = endPoint.add(new paper.Point(width * 0.6 / 2, 0));

        const trunk = new paper.Path([leftBase, leftTop, rightTop, rightBase]);
        trunk.closed = true;
        trunk.fillColor = new paper.Color('black');
        paths.push(trunk);
      } else {
        // Branches - simple lines with global stroke width
        const branch = new paper.Path.Line({
          from: startPoint,
          to: endPoint,
          strokeColor: new paper.Color('black'),
          strokeCap: 'round',
        });
        paths.push(branch);
      }

      // Recursively draw child branches
      if (depth < maxDepth) {
        const numBranches = depth === 0 ? params.mainBranches : 2; // Main trunk splits more
        const angleVariation = rng() * 20 - 10; // -10 to +10 degrees random variation

        for (let i = 0; i < numBranches; i++) {
          const branchAngle =
            angle +
            angleVariation +
            ((i - (numBranches - 1) / 2) * branchAngleSpread) / (depth + 1);

          const newLength = length * branchLengthRatio * lerp(0.8, 1.0, rng());
          const newWidth = width * branchWidthRatio;

          // Start branches at 70-90% up the parent branch
          const branchStartT = lerp(0.7, 0.9, rng());
          const branchStart = new paper.Point(
            startPoint.x + (endPoint.x - startPoint.x) * branchStartT,
            startPoint.y + (endPoint.y - startPoint.y) * branchStartT
          );

          drawBranch(branchStart, branchAngle, newLength, newWidth, depth + 1);
        }
      }

      // Add canopy at branch tips
      if (depth === maxDepth && params.canopy) {
        if (params.canopyStyle === 'blob') {
          // Simple circular blob
          const blobSize = mmToPx(lerp(params.canopySize * 0.8, params.canopySize * 1.2, rng()));
          const blob = new paper.Path.Circle({
            center: endPoint,
            radius: blobSize / 2,
          });

          if (params.canopyFilled) {
            blob.fillColor = new paper.Color('black');
          } else {
            blob.strokeColor = new paper.Color('black');
          }

          paths.push(blob);
        } else if (params.canopyStyle === 'leaves' && leafGenerator) {
          // Use actual leaf generator for realistic leaves
          const numLeaves = Math.floor(lerp(2, 5, rng()));
          for (let i = 0; i < numLeaves; i++) {
            const leafAngle = rng() * 360;
            const leafDistance = mmToPx(lerp(1, params.canopySize * 0.4, rng()));
            const leafX = endPoint.x + Math.cos((leafAngle * Math.PI) / 180) * leafDistance;
            const leafY = endPoint.y + Math.sin((leafAngle * Math.PI) / 180) * leafDistance;
            const leafPos = new paper.Point(leafX, leafY);

            // Generate leaf using LeafGenerator
            const leafSeed = seed + i * 100 + Math.floor(endPoint.x + endPoint.y);
            const leafParams = {
              sizeMin: params.leafSize * 0.8,
              sizeMax: params.leafSize * 1.2,
              curvature: 0.3,
              veins: 0,
            };
            const leafShape = leafGenerator.generate(t, leafParams, leafSeed);

            // Position and rotate each leaf path
            leafShape.paths.forEach((path) => {
              const clonedPath = path.clone();
              clonedPath.rotate(rng() * 360);
              clonedPath.translate(leafPos);

              paths.push(clonedPath);
              path.remove();
            });
          }
        }
      }
    };

    // Start drawing from base (0, 0)
    const basePoint = new paper.Point(0, 0);
    drawBranch(basePoint, 0, trunkHeight, trunkWidth, 0);

    // Optional ground line
    if (params.groundLine) {
      const groundWidth = mmToPx(params.trunkWidth * 2);
      const ground = new paper.Path.Line({
        from: new paper.Point(-groundWidth / 2, 0),
        to: new paper.Point(groundWidth / 2, 0),
        strokeColor: new paper.Color('black'),
      });
      paths.push(ground);
    }

    // Calculate bounds
    const group = new paper.Group(paths);
    const bounds = group.bounds;
    group.remove();

    return {
      paths,
      bounds,
      anchor: new paper.Point(0, 0), // Anchor at base/ground level
    };
  }

  getDefaultParams() {
    return {
      height: { min: 15, max: 30 },  // mm
      trunkWidth: 1.5,        // mm
      branchAngle: 35,        // degrees spread between branches
      branchLengthRatio: 0.65,  // Each level is 65% of parent length
      branchWidthRatio: 0.7,   // Each level is 70% of parent width
      branchDepth: 3,         // Number of branching levels
      mainBranches: 3,        // Number of main branches from trunk
      taperedBranches: true,  // Trunk tapers from base to top
      canopy: true,           // Add canopy at branch tips
      canopyStyle: 'blob',    // 'blob' or 'leaves'
      canopySize: 4,          // mm (blob size)
      leafSize: 3,            // mm (individual leaf size when using leaf style)
      canopyFilled: false,    // Filled or outlined
      groundLine: false,      // Show ground line
    };
  }

  getParamDefinitions(): ParamDefinition[] {
    return [
      {
        name: 'height',
        type: 'minmax',
        min: 5,
        max: 60,
        step: 1,
        unit: 'mm',
        label: 'Height',
        defaultValue: { min: 15, max: 30 },
      },
      {
        name: 'trunkWidth',
        type: 'slider',
        min: 0.5,
        max: 5,
        step: 0.1,
        label: 'Trunk Width (mm)',
        defaultValue: 1.5,
      },
      {
        name: 'branchAngle',
        type: 'slider',
        min: 10,
        max: 60,
        step: 5,
        label: 'Branch Angle (degrees)',
        defaultValue: 35,
      },
      {
        name: 'branchLengthRatio',
        type: 'slider',
        min: 0.4,
        max: 0.9,
        step: 0.05,
        label: 'Branch Length Ratio',
        defaultValue: 0.65,
      },
      {
        name: 'branchWidthRatio',
        type: 'slider',
        min: 0.5,
        max: 0.9,
        step: 0.05,
        label: 'Branch Width Ratio',
        defaultValue: 0.7,
      },
      {
        name: 'branchDepth',
        type: 'slider',
        min: 1,
        max: 5,
        step: 1,
        label: 'Branch Depth (levels)',
        defaultValue: 3,
      },
      {
        name: 'mainBranches',
        type: 'slider',
        min: 2,
        max: 5,
        step: 1,
        label: 'Main Branches',
        defaultValue: 3,
      },
      {
        name: 'taperedBranches',
        type: 'checkbox',
        label: 'Tapered Trunk',
        defaultValue: true,
      },
      {
        name: 'canopy',
        type: 'checkbox',
        label: 'Show Canopy',
        defaultValue: true,
      },
      {
        name: 'canopyStyle',
        type: 'select',
        options: ['blob', 'leaves'],
        label: 'Canopy Style',
        defaultValue: 'blob',
      },
      {
        name: 'canopySize',
        type: 'slider',
        min: 2,
        max: 10,
        step: 0.5,
        label: 'Canopy Size (mm)',
        defaultValue: 4,
      },
      {
        name: 'leafSize',
        type: 'slider',
        min: 1,
        max: 8,
        step: 0.5,
        label: 'Leaf Size (mm)',
        defaultValue: 3,
      },
      {
        name: 'canopyFilled',
        type: 'checkbox',
        label: 'Filled Canopy',
        defaultValue: false,
      },
      {
        name: 'groundLine',
        type: 'checkbox',
        label: 'Ground Line',
        defaultValue: false,
      },
    ];
  }
}
