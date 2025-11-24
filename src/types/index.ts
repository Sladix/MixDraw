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
    typeof value.max === 'number' &&
    !('timelineId' in value) // Exclude AnimatableMinMaxValue
  );
}

/**
 * AnimatableParameter - unified parameter type that supports:
 * - Static value (number)
 * - Random range (MinMaxValue)
 * - Timeline-driven range (AnimatableMinMaxValue)
 */
export type AnimatableParameter = number | MinMaxValue | AnimatableMinMaxValue;

/**
 * MinMaxValue with optional timeline animation
 * The timeline can modulate the min/max bounds based on position t
 */
export interface AnimatableMinMaxValue extends MinMaxValue {
  timelineId?: string; // Reference to timeline in FlowPath.timelines[]
}

/**
 * Type guard to check if a value is an AnimatableMinMaxValue
 */
export function isAnimatableMinMaxValue(value: any): value is AnimatableMinMaxValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'min' in value &&
    'max' in value &&
    typeof value.min === 'number' &&
    typeof value.max === 'number' &&
    'timelineId' in value &&
    typeof value.timelineId === 'string'
  );
}

/**
 * Type guard to check if a value is any kind of MinMaxValue (including animatable)
 */
export function isAnyMinMaxValue(value: any): value is MinMaxValue | AnimatableMinMaxValue {
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
  timelines?: Timeline[]; // Keyframe-based parameter animation
}

export type PackingMode = 'tight' | 'normal' | 'loose' | 'allow-overlap';

export interface DistributionParams {
  mode: 'linear' | 'noise' | 'random' | 'custom';
  density: number | MinMaxValue; // total shapes per mm (divided by generator count internally) - can be static or range
  densityMode?: 'visual' | 'fixed-count'; // visual = adjust for size, fixed-count = exact count
  packingMode?: PackingMode; // Collision detection mode (tight = no overlap, normal = 10%, loose = 25%, allow-overlap = disabled)
  minSpacing?: number; // Minimum spacing between shapes in mm (negative = tighter, positive = more space)
  spacing: [number, number]; // [min, max]
  seed: number;
  noiseScale?: number; // Scale of noise (frequency) for perlin distribution
  noiseStrength?: number; // How much noise affects spacing
  noiseThreshold?: number; // Threshold for spawning shapes (0-1), creates clusters
}

export type FillMode = 'grid' | 'noise' | 'random' | 'packed';

export interface FlowParams {
  followCurve: number | MinMaxValue; // 0-1 - rotation alignment (can be static or range)
  spread: number | MinMaxValue; // Width of tube in mm (e.g., 10mm = 5mm each side of path) - can be static or range
  fillMode: FillMode; // How to fill the tube area
}

// ============================================================================
// Timeline & Keyframe System
// ============================================================================

export type InterpolationType = 'linear' | 'ease' | 'sin';

export interface Keyframe {
  id: string;
  t: number; // Position along path (0-1)
  value: number; // Parameter value at this position
  interpolation: InterpolationType; // How to interpolate to next keyframe
}

export interface Timeline {
  id: string;
  paramName: string; // e.g., 'density', 'spread', 'followCurve', 'rotation', 'size'
  keyframes: Keyframe[];
  enabled: boolean;
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
  timelines?: Timeline[]; // Keyframe-based parameter animation
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
  timelines?: Timeline[];
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
  id: string | null; // Keep for backward compatibility with single selection
  ids: string[]; // Multi-select support
  bounds?: paper.Rectangle; // Computed selection bounds
  transformMode?: 'move' | 'rotate' | 'scale' | null; // Active transform
  // Bezier curve editing state (for flowPath type only)
  editingBezier?: boolean; // Whether bezier editing mode is active
  selectedPointIndex?: number | null; // Index of selected curve point (-1 for none)
  selectedHandleType?: 'in' | 'out' | null; // Which handle is being dragged
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
