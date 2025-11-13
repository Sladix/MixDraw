import paper from 'paper';
import type { Project, Layer, FlowPath, StandaloneGenerator } from '../types';
import { getEffectiveDimensions, PAPER_FORMATS, mmToPx } from '../types/formats';

/**
 * Hit test result
 */
export interface HitResult {
  type: 'flowPath' | 'standaloneGenerator';
  id: string;
  object: FlowPath | StandaloneGenerator;
  point: paper.Point;
  layer: Layer;
}

/**
 * Hit test objects at a point
 * Returns the top-most object under the cursor
 */
export function hitTestObjects(
  point: paper.Point,
  project: Project,
  tolerance: number = 20 // pixels - generous tolerance for easier selection
): HitResult | null {
  // Test in reverse layer order (top to bottom)
  const layers = [...project.layers].reverse();

  for (const layer of layers) {
    if (!layer.visible || layer.locked) continue;

    // Test standalone generators first (rendered on top)
    for (const sg of [...layer.standaloneGenerators].reverse()) {
      const bounds = getStandaloneGeneratorBounds(sg, project);
      if (bounds && bounds.expand(tolerance).contains(point)) {
        return {
          type: 'standaloneGenerator',
          id: sg.id,
          object: sg,
          point,
          layer,
        };
      }
    }

    // Test flowPaths
    for (const fp of [...layer.flowPaths].reverse()) {
      const format = project.format || 'A4';
      const orientation = project.orientation || 'portrait';
      if (hitTestFlowPath(fp, point, tolerance, format, orientation)) {
        return {
          type: 'flowPath',
          id: fp.id,
          object: fp,
          point,
          layer,
        };
      }
    }
  }

  return null;
}

/**
 * Hit test a flowPath curve
 * NOTE: flowPath coordinates are in normalized format (0-1), need to convert to absolute
 */
export function hitTestFlowPath(
  flowPath: FlowPath,
  point: paper.Point,
  tolerance: number = 20, // Increased tolerance for easier selection
  format: string = 'A4',
  orientation: 'portrait' | 'landscape' = 'portrait'
): boolean {
  // Reconstruct path from stored bezier curve with conversion from normalized to absolute coords
  const path = new paper.Path();
  const paperFormat = PAPER_FORMATS[format];
  const dims = getEffectiveDimensions(paperFormat, orientation);

  flowPath.bezierCurve.segments.forEach((seg: any) => {
    // Convert normalized point to absolute pixels
    const absoluteX = seg.point.x * dims.widthPx;
    const absoluteY = seg.point.y * dims.heightPx;

    // Handles are relative vectors - scale them proportionally
    const handleIn = seg.handleIn
      ? new paper.Point(seg.handleIn.x * dims.widthPx, seg.handleIn.y * dims.heightPx)
      : undefined;
    const handleOut = seg.handleOut
      ? new paper.Point(seg.handleOut.x * dims.widthPx, seg.handleOut.y * dims.heightPx)
      : undefined;

    const segment = new paper.Segment(
      new paper.Point(absoluteX, absoluteY),
      handleIn,
      handleOut
    );
    path.add(segment);
  });

  // Apply smoothing to match the rendered curve
  path.smooth({ type: 'continuous' });

  // CRITICAL: Set stroke properties for hit testing to work
  path.strokeColor = new paper.Color('black');
  path.strokeWidth = flowPath.spread || 10; // Use flowPath spread as stroke width

  // Hit test the stroke
  const hit = path.hitTest(point, {
    stroke: true,
    tolerance,
  });

  path.remove();
  return hit !== null;
}

/**
 * Get bounds for a standalone generator
 */
export function getStandaloneGeneratorBounds(
  sg: StandaloneGenerator,
  project: Project
): paper.Rectangle | null {
  // Get format dimensions to convert normalized coords
  const format = project.format || 'A4';
  const orientation = project.orientation || 'portrait';
  const paperFormat = PAPER_FORMATS[format];
  const dims = getEffectiveDimensions(paperFormat, orientation);

  // Convert normalized position to pixels
  const x = sg.position.x * dims.widthPx;
  const y = sg.position.y * dims.heightPx;

  // Estimate bounds based on generator parameters
  // This is a rough approximation - actual bounds would require generating the shape
  const estimatedSize = mmToPx(20) * sg.scale; // Assume ~20mm base size

  return new paper.Rectangle(
    x - estimatedSize / 2,
    y - estimatedSize / 2,
    estimatedSize,
    estimatedSize
  );
}

/**
 * Get selection bounds (union of all selected objects)
 */
export function getSelectionBounds(
  selectedIds: string[],
  selectionType: 'flowPath' | 'standaloneGenerator',
  project: Project
): paper.Rectangle | null {
  if (selectedIds.length === 0) return null;

  let bounds: paper.Rectangle | null = null;

  for (const layer of project.layers) {
    if (selectionType === 'standaloneGenerator') {
      for (const sg of layer.standaloneGenerators) {
        if (selectedIds.includes(sg.id)) {
          const sgBounds = getStandaloneGeneratorBounds(sg, project);
          if (sgBounds) {
            bounds = bounds ? bounds.unite(sgBounds) : sgBounds;
          }
        }
      }
    } else if (selectionType === 'flowPath') {
      for (const fp of layer.flowPaths) {
        if (selectedIds.includes(fp.id)) {
          const format = project.format || 'A4';
          const orientation = project.orientation || 'portrait';
          const fpBounds = getFlowPathBounds(fp, format, orientation);
          if (fpBounds) {
            bounds = bounds ? bounds.unite(fpBounds) : fpBounds;
          }
        }
      }
    }
  }

  return bounds;
}

/**
 * Get bounds for a flowPath
 * NOTE: flowPath coordinates are in normalized format (0-1), need to convert to absolute
 */
export function getFlowPathBounds(
  flowPath: FlowPath,
  format: string = 'A4',
  orientation: 'portrait' | 'landscape' = 'portrait'
): paper.Rectangle | null {
  // Reconstruct path to get bounds with normalized to absolute conversion
  const path = new paper.Path();
  const paperFormat = PAPER_FORMATS[format];
  const dims = getEffectiveDimensions(paperFormat, orientation);

  flowPath.bezierCurve.segments.forEach((seg: any) => {
    // Convert normalized point to absolute pixels
    const absoluteX = seg.point.x * dims.widthPx;
    const absoluteY = seg.point.y * dims.heightPx;

    // Include handles for accurate bounds
    const handleIn = seg.handleIn
      ? new paper.Point(seg.handleIn.x * dims.widthPx, seg.handleIn.y * dims.heightPx)
      : undefined;
    const handleOut = seg.handleOut
      ? new paper.Point(seg.handleOut.x * dims.widthPx, seg.handleOut.y * dims.heightPx)
      : undefined;

    const segment = new paper.Segment(
      new paper.Point(absoluteX, absoluteY),
      handleIn,
      handleOut
    );
    path.add(segment);
  });

  // Apply smoothing to match the rendered curve
  path.smooth({ type: 'continuous' });

  const bounds = path.bounds.clone();
  path.remove();

  return bounds;
}

/**
 * Test if point is inside a rectangle with tolerance
 */
export function pointInRect(
  point: paper.Point,
  rect: paper.Rectangle,
  tolerance: number = 0
): boolean {
  return rect.expand(tolerance).contains(point);
}

/**
 * Get objects in a rectangular selection area (marquee)
 */
export function getObjectsInRect(
  rect: paper.Rectangle,
  project: Project,
  partialSelection: boolean = false
): { flowPaths: FlowPath[]; standaloneGenerators: StandaloneGenerator[] } {
  const flowPaths: FlowPath[] = [];
  const standaloneGenerators: StandaloneGenerator[] = [];

  for (const layer of project.layers) {
    if (!layer.visible || layer.locked) continue;

    // Test standalone generators
    for (const sg of layer.standaloneGenerators) {
      const bounds = getStandaloneGeneratorBounds(sg, project);
      if (bounds) {
        if (partialSelection ? rect.intersects(bounds) : rect.contains(bounds)) {
          standaloneGenerators.push(sg);
        }
      }
    }

    // Test flowPaths
    for (const fp of layer.flowPaths) {
      const bounds = getFlowPathBounds(fp);
      if (bounds) {
        if (partialSelection ? rect.intersects(bounds) : rect.contains(bounds)) {
          flowPaths.push(fp);
        }
      }
    }
  }

  return { flowPaths, standaloneGenerators };
}
