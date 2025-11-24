import paper from 'paper';
import { mmToPx } from '../types/formats';

/**
 * Snaps a point to the nearest grid intersection
 * The grid is centered on the canvas center
 */
export function snapToGrid(
  point: paper.Point,
  gridSizeMm: number,
  canvasWidthPx: number,
  canvasHeightPx: number
): paper.Point {
  const gridSizePx = mmToPx(gridSizeMm);

  // Calculate center point of the canvas
  const centerX = canvasWidthPx / 2;
  const centerY = canvasHeightPx / 2;

  // Calculate grid offset to align with center
  const gridStartX = centerX % gridSizePx;
  const gridStartY = centerY % gridSizePx;

  // Snap point to nearest grid line
  const snappedX = Math.round((point.x - gridStartX) / gridSizePx) * gridSizePx + gridStartX;
  const snappedY = Math.round((point.y - gridStartY) / gridSizePx) * gridSizePx + gridStartY;

  return new paper.Point(snappedX, snappedY);
}

/**
 * Snaps normalized coordinates (0-1) to grid
 */
export function snapToGridNormalized(
  normalizedPoint: { x: number; y: number },
  gridSizeMm: number,
  canvasWidthPx: number,
  canvasHeightPx: number
): { x: number; y: number } {
  // Convert to absolute
  const absoluteX = normalizedPoint.x * canvasWidthPx;
  const absoluteY = normalizedPoint.y * canvasHeightPx;

  const absolutePoint = new paper.Point(absoluteX, absoluteY);
  const snapped = snapToGrid(absolutePoint, gridSizeMm, canvasWidthPx, canvasHeightPx);

  // Convert back to normalized
  return {
    x: snapped.x / canvasWidthPx,
    y: snapped.y / canvasHeightPx,
  };
}
