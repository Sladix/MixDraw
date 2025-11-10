import paper from 'paper';

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
  generators: GeneratorConfig[];
  dependencies?: FlowPathDependencies;
  closed?: boolean; // Whether to close the path (connect last to first point)
}

export interface DistributionParams {
  mode: 'linear' | 'noise' | 'random' | 'custom';
  density: number; // total shapes per mm (divided by generator count internally)
  spacing: [number, number]; // [min, max]
  seed: number;
  noiseScale?: number; // Scale of noise (frequency) for perlin distribution
  noiseStrength?: number; // How much noise affects spacing
  noiseThreshold?: number; // Threshold for spawning shapes (0-1), creates clusters
}

export interface FlowParams {
  followCurve: number; // 0-1
  deviation: number; // in mm
  normalOffset: number; // in mm
  boidsStrength: number; // 0-1
  boidsRadius: number; // in mm
  deviationGradient?: {
    enabled: boolean;
    startMultiplier: number; // Deviation multiplier at start (e.g., 0.1 for tight, 3.0 for wide)
    endMultiplier: number; // Deviation multiplier at end
    startT: number; // Where gradient starts (0-1)
    endT: number; // Where gradient ends (0-1)
    reverse: boolean; // Reverse the gradient direction
  };
}

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
  type: 'slider' | 'range' | 'number' | 'select' | 'checkbox';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  label: string;
  description?: string;
  defaultValue?: any;
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
