/**
 * Paper formats with dimensions in millimeters (primary unit) and pixels at 300 DPI (internal).
 * All user-facing parameters use millimeters for physical accuracy.
 */
export interface PaperFormat {
  name: string;
  width: number; // mm (user-facing)
  height: number; // mm (user-facing)
  widthPx: number; // pixels at 300 DPI (internal, for rendering)
  heightPx: number; // pixels at 300 DPI (internal, for rendering)
}

export const PAPER_FORMATS: Record<string, PaperFormat> = {
  A3: {
    name: 'A3',
    width: 297,
    height: 420,
    widthPx: 3508,
    heightPx: 4961,
  },
  A4: {
    name: 'A4',
    width: 210,
    height: 297,
    widthPx: 2480,
    heightPx: 3508,
  },
};

export type FormatType = keyof typeof PAPER_FORMATS;

/**
 * Convert millimeters to pixels at 300 DPI
 * 1 inch = 25.4 mm
 * 300 DPI = 300 pixels per inch
 * Therefore: 1 mm = 300 / 25.4 ≈ 11.811 pixels
 */
export const mmToPx = (mm: number): number => {
  return (mm * 300) / 25.4;
};

/**
 * Convert pixels to millimeters at 300 DPI
 */
export const pxToMm = (px: number): number => {
  return (px * 25.4) / 300;
};

/**
 * Get effective paper dimensions based on orientation
 */
export const getEffectiveDimensions = (
  format: PaperFormat,
  orientation: 'portrait' | 'landscape'
): { width: number; height: number; widthPx: number; heightPx: number } => {
  if (orientation === 'landscape') {
    return {
      width: format.height,
      height: format.width,
      widthPx: format.heightPx,
      heightPx: format.widthPx,
    };
  }
  return {
    width: format.width,
    height: format.height,
    widthPx: format.widthPx,
    heightPx: format.heightPx,
  };
};
