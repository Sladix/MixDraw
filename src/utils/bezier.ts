import paper from 'paper';

/**
 * Calculate the normalized t-value (0-1) for a point on a bezier curve
 * This is based on the arc length along the curve
 */
export function calculatePointTValue(path: paper.Path, pointIndex: number): number {
  if (!path || pointIndex < 0 || pointIndex >= path.segments.length) {
    return 0;
  }

  // If only one point, return 0
  if (path.segments.length === 1) {
    return 0;
  }

  // Calculate total path length
  const totalLength = path.length;

  if (totalLength === 0) {
    // If path has no length, distribute points evenly
    return pointIndex / (path.segments.length - 1);
  }

  // Calculate length up to the target point
  let lengthToPoint = 0;

  for (let i = 0; i < pointIndex; i++) {
    const curve = path.curves[i];
    if (curve) {
      lengthToPoint += curve.length;
    }
  }

  // Return normalized position (0-1)
  return lengthToPoint / totalLength;
}

/**
 * Get the segment at a given t-value on a path
 */
export function getSegmentAtT(path: paper.Path, t: number): number {
  if (!path || path.segments.length === 0) return 0;

  const totalLength = path.length;
  const targetLength = t * totalLength;

  let accumulatedLength = 0;

  for (let i = 0; i < path.curves.length; i++) {
    const curve = path.curves[i];
    const curveLength = curve.length;

    if (accumulatedLength + curveLength >= targetLength) {
      return i;
    }

    accumulatedLength += curveLength;
  }

  return path.segments.length - 1;
}
