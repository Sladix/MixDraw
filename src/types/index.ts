import paper from 'paper';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Represents a min/max range value
 */
export interface MinMaxValue {
  min: number;
  max: number;
}

/**
 * Type guard to check if a value is a MinMaxValue
 */
export function isMinMaxValue(value: any): value is MinMaxValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'min' in value &&
    'max' in value &&
    typeof value.min === 'number' &&
    typeof value.max === 'number'
  );
}

// ============================================================================
// Core Interfaces
// ============================================================================

export interface Project {
  version: string;
  backgroundImage: BackgroundImage | null;
  layers: Layer[];
  detectedShapes: DetectedShape[];
}

export interface BackgroundImage {
  dataUrl: string;
  width: number;
  height: number;
}

export interface DetectedShape {
  id: string;
  paths: paper.Path[];
  bounds: paper.Rectangle;
}

// ============================================================================
// Layer
// ============================================================================

export interface Layer {
  id: string;
  name: string;
  color: string;
  strokeWidth: number; // Line width in mm for plotter output
  visible: boolean;
  locked: boolean;
  order: number;
  brushEffect: BrushEffect;
  flowPaths: FlowPath[];
  standaloneGenerators: StandaloneGenerator[];
}

export interface BrushEffect {
  enabled: boolean;
  fadeStart: number; // 0-1
  fadeEnd: number; // 0-1
}

// ============================================================================
// FlowPath
// ============================================================================

export interface FlowPath {
  id: string;
  layerId: string;
  bezierCurve: paper.Path; // Will be serialized/deserialized
  distributionParams: DistributionParams;
  flowParams: FlowParams;
  modifiers?: AnyModifier[]; // t-based transformation modifiers
  generators: GeneratorConfig[];
  dependencies?: FlowPathDependencies;
  closed?: boolean; // Whether to close the path (connect last to first point)
}

export type PackingMode = 'tight' | 'normal' | 'loose' | 'allow-overlap';

export interface DistributionParams {
  mode: 'linear' | 'noise' | 'random' | 'custom';
  density: number; // total shapes per mm (divided by generator count internally)
  densityMode?: 'visual' | 'fixed-count'; // visual = adjust for size, fixed-count = exact count
  packingMode?: PackingMode; // Collision detection mode (tight = no overlap, normal = 10%, loose = 25%, allow-overlap = disabled)
  spacing: [number, number]; // [min, max]
  seed: number;
  noiseScale?: number; // Scale of noise (frequency) for perlin distribution
  noiseStrength?: number; // How much noise affects spacing
  noiseThreshold?: number; // Threshold for spawning shapes (0-1), creates clusters
}

export type FillMode = 'grid' | 'noise' | 'random' | 'packed';

export interface FlowParams {
  followCurve: number; // 0-1

  // NEW SYSTEM: Tube filling
  spread: number; // Width of tube in mm (e.g., 10mm = 5mm each side of path)
  fillMode: FillMode; // How to fill the tube area

  // OLD SYSTEM: Keep for backward compatibility
  deviation: number; // in mm (deprecated, kept for existing projects)
  normalOffset: number; // in mm (deprecated, kept for existing projects)

  // Boids simulation
  boidsStrength: number; // 0-1
  boidsRadius: number; // in mm

  // Deprecated gradient system (kept for backward compatibility)
  deviationGradient?: {
    enabled: boolean;
    startMultiplier: number;
    endMultiplier: number;
    startT: number;
    endT: number;
    reverse: boolean;
  };
}

// ============================================================================
// Modifier System
// ============================================================================

export type CurveType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'sine';

export interface BaseModifier {
  id: string;
  type: 'size' | 'rotation' | 'spacing' | 'spread';
  enabled: boolean;
  tStart: number; // 0-1, when modifier starts affecting
  tEnd: number; // 0-1, when modifier stops affecting
  valueStart: number; // Starting value
  valueEnd: number; // Ending value
  curve: CurveType; // Interpolation curve
}

export interface SizeModifier extends BaseModifier {
  type: 'size';
  valueStart: number; // Multiplier (e.g., 0.5 = 50% size)
  valueEnd: number; // Multiplier (e.g., 2.0 = 200% size)
}

export interface RotationModifier extends BaseModifier {
  type: 'rotation';
  valueStart: number; // Degrees
  valueEnd: number; // Degrees
}

export interface SpacingModifier extends BaseModifier {
  type: 'spacing';
  valueStart: number; // Density multiplier
  valueEnd: number; // Density multiplier
}

export interface SpreadModifier extends BaseModifier {
  type: 'spread';
  valueStart: number; // Spread width in mm
  valueEnd: number; // Spread width in mm
}

export type AnyModifier = SizeModifier | RotationModifier | SpacingModifier | SpreadModifier;

// ============================================================================
// Generator Config
// ============================================================================

export interface GeneratorConfig {
  id: string;
  type: string;
  weight: number;
  params: Record<string, any>;
  followNormal?: boolean; // Whether to point toward curve normal (default: false, points along tangent)
}

export interface FlowPathDependencies {
  parentFlowPath: string | null;
  inheritParams: string[];
  offsetFromParent: number;
}

// ============================================================================
// Generator System
// ============================================================================

export interface Generator {
  type: string;
  name: string; // Display name
  description: string; // Brief description
  tags: string[]; // Category tags for filtering

  /**
   * Pure function: generates a shape for a given position
   * @param t - Normalized position along curve [0, 1]
   * @param params - Generator-specific parameters
   * @param seed - Seed for reproducible randomness
   * @returns Shape object with SVG paths
   */
  generate(t: number, params: Record<string, any>, seed: number): Shape;

  /**
   * Returns default parameters for this generator
   */
  getDefaultParams(): Record<string, any>;

  /**
   * Returns parameter definitions for UI generation
   */
  getParamDefinitions(): ParamDefinition[];
}

export interface Shape {
  paths: paper.Path[];
  bounds: paper.Rectangle;
  anchor: paper.Point;
}

export interface ParamDefinition {
  name: string;
  type: 'slider' | 'range' | 'number' | 'select' | 'checkbox' | 'minmax';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  label: string;
  description?: string;
  defaultValue?: any;
  unit?: string;
}

// ============================================================================
// Standalone Generator
// ============================================================================

export interface StandaloneGenerator {
  id: string;
  layerId: string;
  position: { x: number; y: number };
  rotation: number; // degrees
  scale: number;
  generatorType: string;
  params: Record<string, any>;
  seed: number;
}

// ============================================================================
// Generated Instances (runtime only, not saved)
// ============================================================================

export interface GeneratedInstance {
  id: string;
  shape: Shape;
  position: paper.Point;
  rotation: number;
  scale: number;
  sourceId: string; // FlowPath or StandaloneGenerator ID
  generatorType: string;
}

// ============================================================================
// UI State
// ============================================================================

export interface ToolType {
  type: 'select' | 'flowpath' | 'standalone' | 'editPoints' | 'delete' | 'pan';
}

export interface Selection {
  type: 'layer' | 'flowPath' | 'standaloneGenerator' | 'none';
  id: string | null;
}

// ============================================================================
// Serialization Types
// ============================================================================

export interface SerializedProject {
  version: string;
  backgroundImage: BackgroundImage | null;
  layers: SerializedLayer[];
}

export interface SerializedLayer extends Omit<Layer, 'flowPaths'> {
  flowPaths: SerializedFlowPath[];
}

export interface SerializedFlowPath extends Omit<FlowPath, 'bezierCurve'> {
  bezierCurve: string; // JSON string of path data
}
