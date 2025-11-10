import paper from 'paper';
import { PAPER_FORMATS, type FormatType, getEffectiveDimensions } from '../types/formats';

/**
 * Convert normalized coordinates (0-1) to absolute pixel coordinates
 * based on the current paper format and orientation
 */
export function normalizedToAbsolute(
  normalized: { x: number; y: number },
  paperFormat: FormatType,
  paperOrientation: 'portrait' | 'landscape' = 'portrait'
): { x: number; y: number } {
  const format = PAPER_FORMATS[paperFormat];
  const dims = getEffectiveDimensions(format, paperOrientation);
  return {
    x: normalized.x * dims.widthPx,
    y: normalized.y * dims.heightPx,
  };
}

/**
 * Convert absolute pixel coordinates to normalized coordinates (0-1)
 * based on the current paper format and orientation
 */
export function absoluteToNormalized(
  absolute: { x: number; y: number },
  paperFormat: FormatType,
  paperOrientation: 'portrait' | 'landscape' = 'portrait'
): { x: number; y: number } {
  const format = PAPER_FORMATS[paperFormat];
  const dims = getEffectiveDimensions(format, paperOrientation);
  return {
    x: absolute.x / dims.widthPx,
    y: absolute.y / dims.heightPx,
  };
}

/**
 * Convert normalized Paper.js Point to absolute coordinates
 */
export function normalizedPointToAbsolute(
  point: paper.Point,
  paperFormat: FormatType,
  paperOrientation: 'portrait' | 'landscape' = 'portrait'
): paper.Point {
  const abs = normalizedToAbsolute({ x: point.x, y: point.y }, paperFormat, paperOrientation);
  return new paper.Point(abs.x, abs.y);
}

/**
 * Convert absolute Paper.js Point to normalized coordinates
 */
export function absolutePointToNormalized(
  point: paper.Point,
  paperFormat: FormatType,
  paperOrientation: 'portrait' | 'landscape' = 'portrait'
): paper.Point {
  const norm = absoluteToNormalized({ x: point.x, y: point.y }, paperFormat, paperOrientation);
  return new paper.Point(norm.x, norm.y);
}

/**
 * Scale a value (like generator size parameters) from millimeters to pixels
 * at 300 DPI
 */
export function mmToPixels(mm: number): number {
  // 300 DPI = 300 pixels per inch
  // 1 inch = 25.4 mm
  return (mm / 25.4) * 300;
}

/**
 * Scale a value from pixels to millimeters at 300 DPI
 */
export function pixelsToMm(pixels: number): number {
  return (pixels * 25.4) / 300;
}
