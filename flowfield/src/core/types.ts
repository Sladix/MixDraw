import type { MinMaxValue } from '@mixdraw/types';

// ============================================================================
// Canvas & Format
// ============================================================================

export type FormatType = 'a4' | 'a3' | 'square' | 'custom';

export interface FormatDimensions {
  width: number;
  height: number;
}

export const FORMATS: Record<FormatType, FormatDimensions> = {
  a4: { width: 595, height: 842 },
  a3: { width: 842, height: 1190 },
  square: { width: 800, height: 800 },
  custom: { width: 800, height: 600 },
};

// ============================================================================
// Super Params - Global deformation applied to all forces
// ============================================================================

export interface SuperParams {
  scale: number;        // 50-400: Field scale (noise/formula frequency)
  warp: number;         // 0-1: Domain warping intensity (distortion)
  twist: number;        // 0-360: Angular rotation around center (degrees)
  turbulence: number;   // 0-1: High-frequency noise overlay
}

export const DEFAULT_SUPER_PARAMS: SuperParams = {
  scale: 200,
  warp: 0,
  twist: 0,
  turbulence: 0,
};

// ============================================================================
// Formula Context - Variables available in expressions
// ============================================================================

export interface FormulaContext {
  x: number;          // Absolute X position (pixels)
  y: number;          // Absolute Y position (pixels)
  nx: number;         // Normalized X (0-1)
  ny: number;         // Normalized Y (0-1)
  scale: number;      // Global scale parameter
  dist: number;       // Distance from center (pixels)
  angle: number;      // Angle from center (radians)
  // Super params
  warp: number;
  twist: number;
  turbulence: number;
  // Noise function (injected)
  noise: (x: number, y: number) => number;
  // Constants
  PI: number;
  TAU: number;        // 2 * PI
}

// ============================================================================
// Force Types
// ============================================================================

export type ForceType = 'noise' | 'circular' | 'formula';

export interface BaseForce {
  id: string;
  type: ForceType;
  name: string;
  weight: number | MinMaxValue;
  enabled: boolean;
}

export interface NoiseForceParams {
  scale: number | MinMaxValue;
  complexity: number;
  octaves: number;
}

export interface NoiseForce extends BaseForce {
  type: 'noise';
  params: NoiseForceParams;
}

export interface CircularForceParams {
  centerX: number;  // 0-1 normalized
  centerY: number;
  mode: 'tangent' | 'radial' | 'spiral';
  frequency: number | MinMaxValue;
}

export interface CircularForce extends BaseForce {
  type: 'circular';
  params: CircularForceParams;
}

export interface FormulaForceParams {
  expression: string;
}

export interface FormulaForce extends BaseForce {
  type: 'formula';
  params: FormulaForceParams;
}

export type Force = NoiseForce | CircularForce | FormulaForce;

// ============================================================================
// Zone System
// ============================================================================

export type FalloffType = 'smooth' | 'linear' | 'sharp';
export type ZonePlacement = 'random' | 'corners' | 'grid';

export interface Zone {
  id: string;
  anchor: { x: number; y: number };  // Normalized (0-1)
  radius: number;                     // Normalized (0-1)
  falloff: FalloffType;
  forceWeights: Record<string, number>;  // Force ID -> weight
}

export interface ZoneParams {
  enabled: boolean;
  count: number;
  transitionWidth: number;  // 0-1, how far zones blend
  placement: ZonePlacement;
  showDebug: boolean;
}

export const DEFAULT_ZONE_PARAMS: ZoneParams = {
  enabled: false,
  count: 3,
  transitionWidth: 0.5,
  placement: 'random',
  showDebug: false,
};

// ============================================================================
// Line Parameters
// ============================================================================

export interface LineParams {
  // Core distances (renamed for clarity)
  dSep: number;           // Line Density - grid cell size for seeding (higher = fewer lines)
  dTest: number;          // Line Spacing - minimum distance between lines
  stepSize: number;       // Smoothness - integration step (smaller = smoother)

  // Line properties
  strokeWidth: number;    // Line stroke width
  maxSteps: number;       // Max Length - maximum steps per streamline
  minLength: number;      // Min Segments - minimum points for a valid streamline (5-50)
}

export const DEFAULT_LINE_PARAMS: LineParams = {
  dSep: 8,                // Line Density
  dTest: 4,               // Line Spacing
  stepSize: 2,            // Smoothness
  strokeWidth: 2,
  maxSteps: 800,          // Max Length - increased for longer lines
  minLength: 10,          // Min Segments (exposed in UI)
};

// ============================================================================
// Force Evaluator Interface
// ============================================================================

export interface ForceEvaluator {
  evaluate(
    point: { x: number; y: number },
    params: Record<string, any>,
    context: FormulaContext,
    bounds: { x: number; y: number; width: number; height: number }
  ): number;  // Returns angle in radians
}

// ============================================================================
// Preset
// ============================================================================

export interface FormulaPreset {
  name: string;
  expression: string;
  description: string;
}

// ============================================================================
// Color Palette System
// ============================================================================

export type PaletteMode = 'single' | 'gradient' | 'noise' | 'palette';
export type GradientDirection = 'horizontal' | 'vertical' | 'radial' | 'angular';

export interface ColorPalette {
  mode: PaletteMode;
  // For 'single' mode - just use strokeColor from store
  // For 'gradient' mode
  gradientColors: string[];  // Start to end colors
  gradientDirection: GradientDirection;
  // For 'noise' mode
  noiseScale: number;  // How quickly colors change
  noiseColors: string[];  // Colors to interpolate between
  // For 'palette' mode
  paletteColors: string[];  // Discrete colors to pick from
  paletteMode: 'random' | 'sequential' | 'position';  // How to select colors
}

export const DEFAULT_COLOR_PALETTE: ColorPalette = {
  mode: 'single',
  gradientColors: ['#1a1a1a', '#4a9eff'],
  gradientDirection: 'vertical',
  noiseScale: 100,
  noiseColors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'],
  paletteColors: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
  paletteMode: 'random',
};

// Curated palettes for quick selection
export interface PalettePreset {
  name: string;
  colors: string[];
}

export const PALETTE_PRESETS: PalettePreset[] = [
  { name: 'Sunset', colors: ['#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff'] },
  { name: 'Ocean', colors: ['#0c2461', '#1e3799', '#4a69bd', '#6a89cc', '#82ccdd'] },
  { name: 'Forest', colors: ['#1e3d14', '#2d5a27', '#4a7c39', '#6b8e4e', '#96ceb4'] },
  { name: 'Warm', colors: ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#264653'] },
  { name: 'Cool', colors: ['#a8dadc', '#457b9d', '#1d3557', '#f1faee', '#e63946'] },
  { name: 'Neon', colors: ['#ff00ff', '#00ffff', '#ff00aa', '#00ff00', '#ffff00'] },
  { name: 'Mono', colors: ['#1a1a1a', '#333333', '#666666', '#999999', '#cccccc'] },
  { name: 'Earth', colors: ['#6b4423', '#8b5a2b', '#a0522d', '#cd853f', '#deb887'] },
];
