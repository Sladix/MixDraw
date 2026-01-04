/**
 * Generate a short hash from the main parameters for filename uniqueness
 */

import type { LineParams, ColorPalette, Force, SuperParams } from './types';

interface HashableParams {
  lineParams: LineParams;
  colorPalette: ColorPalette;
  forces: Force[];
  superParams: SuperParams;
}

/**
 * Simple hash function (djb2)
 */
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Convert a number to base36 (0-9, a-z)
 */
function toBase36(num: number): string {
  return num.toString(36);
}

/**
 * Extract the essential parameters that affect the visual output
 */
function extractEssentials(params: HashableParams): Record<string, any> {
  const { lineParams, colorPalette, forces, superParams } = params;

  return {
    // Line params that affect output
    l: {
      dSep: lineParams.dSep,
      dTest: lineParams.dTest,
      step: lineParams.stepSize,
      sw: lineParams.strokeWidth,
      max: lineParams.maxSteps,
      min: lineParams.minLength,
      opt: lineParams.maximizeLength,
    },
    // Color mode and main settings
    c: {
      mode: colorPalette.mode,
      dir: colorPalette.gradientDirection,
      gc: colorPalette.gradientColors,
      nc: colorPalette.noiseColors,
      ns: colorPalette.noiseScale,
      pc: colorPalette.paletteColors,
      pm: colorPalette.paletteMode,
    },
    // Active forces with their params
    f: forces
      .filter((f) => f.enabled)
      .map((f) => ({
        t: f.type,
        w: f.weight,
        p: f.params,
      })),
    // Super params
    s: {
      scale: superParams.scale,
      warp: superParams.warp,
      twist: superParams.twist,
      turb: superParams.turbulence,
    },
  };
}

/**
 * Generate a short (6 character) hash from the parameters
 */
export function generateParamsHash(params: HashableParams): string {
  const essentials = extractEssentials(params);
  const jsonStr = JSON.stringify(essentials);
  const hash = djb2Hash(jsonStr);
  const base36 = toBase36(hash);
  // Return last 6 characters for a shorter hash
  return base36.slice(-6).padStart(6, '0');
}

/**
 * Generate the export filename with seed and params hash
 */
export function generateExportFilename(
  format: string,
  seed: number,
  params: HashableParams,
  extension: 'svg' | 'png'
): string {
  const hash = generateParamsHash(params);
  return `flowfield_${format}_${seed}_${hash}.${extension}`;
}
