


# Mix Draw - Technical Specification

## Project Overview

Mix Draw is a generative art platform that blends hand painting with plotter precision. The application allows artists to create SVG files that will be plotted on top of pre-existing artwork.

### Core Concept
- Import a photo of hand-painted artwork as background
- Define or detect shapes from the original artwork
- Place generators along curves or at specific positions
- Export layered SVG files for multi-pass plotting

### Target Use Case
Create landscapes with:
- Simple silhouettes (from artwork or generators)
- Interesting elements on the horizon
- Swarms of simple shapes that appear to swirl in air currents

## Technical Constraints

- **Plotter size**: A3 maximum
- **Stroke width**: 2-5mm (thick marker or brush)
- **Output format**: SVG (one file per layer for multi-color support)
- **Brush effect**: Progressive paint depletion effect on brush strokes

## Architecture Overview

```
Project
├── BackgroundImage (original artwork photo)
├── DetectedShapes[] (traced/auto-detected shapes - optional)
├── Layers[]
│   ├── Layer
│   │   ├── FlowPaths[]
│   │   │   └── FlowPath (Bézier curve + distribution + generators)
│   │   └── StandaloneGenerators[]
│   │       └── StandaloneGenerator (manually placed)
```

## Core Components

### 1. Layer

Represents a plotting pass with a specific color/tool.

```javascript
Layer {
  id: string,
  name: string,
  color: string,              // marker/brush color
  visible: boolean,
  locked: boolean,
  order: number,              // z-index for rendering
  
  brushEffect: {
    enabled: boolean,
    fadeStart: 0-1,           // when to start fading
    fadeEnd: 0-1,             // when to end fading
  },
  
  flowPaths: FlowPath[],
  standaloneGenerators: StandaloneGenerator[],
}
```

### 2. FlowPath

A Bézier curve that orchestrates generator distribution and behavior.

```javascript
FlowPath {
  id: string,
  layerId: string,
  bezierCurve: BezierCurve,   // Paper.js Path object
  
  // HOW to distribute generators along the curve
  distributionParams: {
    mode: 'linear' | 'noise' | 'random' | 'custom',
    density: number,          // shapes per unit length
    spacing: [min, max],      // variable spacing
    seed: number,             // for reproducibility
  },
  
  // HOW generators behave along the curve
  flowParams: {
    followCurve: 0-1,         // curve adherence (0=ignore, 1=follow exactly)
    deviation: number,        // perpendicular deviation
    normalOffset: number,     // fixed perpendicular offset
    boidsStrength: 0-1,       // clustering strength
    boidsRadius: number,      // influence radius for boids
  },
  
  // WHAT to generate
  generators: [
    {
      id: string,
      type: string,           // generator type identifier
      weight: number,         // relative probability (e.g., 1, 2, 3...)
      params: object,         // generator-specific parameters
    }
  ],
  
  // Optional: dependencies on other FlowPaths
  dependencies: {
    parentFlowPath: string | null,
    inheritParams: string[],  // which params to inherit
    offsetFromParent: number,
  }
}
```

### 3. Generator Interface

All generators implement this pure interface:

```javascript
interface Generator {
  type: string;
  
  /**
   * Pure function: generates a shape for a given position
   * @param t - Normalized position along curve [0, 1]
   * @param params - Generator-specific parameters
   * @param seed - Seed for reproducible randomness
   * @returns Shape object with SVG paths
   */
  generate(t: number, params: object, seed: number): Shape;
  
  /**
   * Returns default parameters for this generator
   */
  getDefaultParams(): object;
  
  /**
   * Returns parameter definitions for UI generation
   */
  getParamDefinitions(): ParamDefinition[];
}

// Shape return type
type Shape = {
  paths: Path[],      // Paper.js Path objects
  bounds: Rectangle,  // Bounding box
  anchor: Point,      // Anchor point for transformations
};

// Parameter definition for UI
type ParamDefinition = {
  name: string,
  type: 'slider' | 'range' | 'number' | 'select' | 'checkbox',
  min?: number,
  max?: number,
  step?: number,
  options?: string[],
  label: string,
  description?: string,
};
```

### 4. StandaloneGenerator

A generator placed manually at a specific position.

```javascript
StandaloneGenerator {
  id: string,
  layerId: string,
  position: {x: number, y: number},
  rotation: number,           // in degrees
  scale: number,
  
  generatorType: string,
  params: object,
  seed: number,
}
```

### 5. GeneratorRegistry

Central registry for all available generators.

```javascript
class GeneratorRegistry {
  static generators: Map<string, Generator>;
  
  static register(generator: Generator): void;
  static get(type: string): Generator;
  static list(): Generator[];
  static getParamDefinitions(type: string): ParamDefinition[];
}
```

## Generation Algorithm

### FlowPath Generation

```javascript
function regenerateFlowPath(flowPath: FlowPath): Shape[] {
  const curveLength = flowPath.bezierCurve.length;
  
  // 1. Generate t values based on distribution mode
  const tValues = generateTValues(
    flowPath.distributionParams,
    curveLength
  );
  
  // 2. Generate shapes at each t position
  const instances = tValues.map((t, index) => {
    // Choose generator based on weights
    const generatorConfig = weightedRandomChoice(
      flowPath.generators,
      flowPath.distributionParams.seed + index
    );
    
    // Get curve information at t
    const basePoint = flowPath.bezierCurve.getPointAt(t * curveLength);
    const tangent = flowPath.bezierCurve.getTangentAt(t * curveLength);
    const normal = flowPath.bezierCurve.getNormalAt(t * curveLength);
    
    // Generate shape (pure function!)
    const generator = GeneratorRegistry.get(generatorConfig.type);
    const shape = generator.generate(
      t,
      generatorConfig.params,
      flowPath.distributionParams.seed + index
    );
    
    // Apply flow transformations
    const transformedShape = applyFlowTransform(
      shape,
      basePoint,
      tangent,
      normal,
      flowPath.flowParams,
      t
    );
    
    return transformedShape;
  });
  
  // 3. Apply boids simulation if enabled
  if (flowPath.flowParams.boidsStrength > 0) {
    applyBoidsSimulation(instances, flowPath.flowParams);
  }
  
  return instances;
}
```

### Distribution Modes

```javascript
function generateTValues(params: DistributionParams, curveLength: number): number[] {
  const count = Math.floor(curveLength * params.density);
  
  switch (params.mode) {
    case 'linear':
      // Regular spacing
      return Array.from({length: count}, (_, i) => i / (count - 1));
      
    case 'noise':
      // Perlin noise for organic distribution
      const noise = new PerlinNoise(params.seed);
      return Array.from({length: count}, (_, i) => {
        const base = i / (count - 1);
        const offset = noise.get(i * 0.1) * 0.1;
        return clamp(base + offset, 0, 1);
      });
      
    case 'random':
      // Random distribution
      const rng = seededRandom(params.seed);
      return Array.from({length: count}, () => rng()).sort();
      
    case 'custom':
      // Custom function
      return params.customDistribution(count, params.seed);
  }
}
```

### Flow Transform

```javascript
function applyFlowTransform(
  shape: Shape,
  basePoint: Point,
  tangent: Point,
  normal: Point,
  flowParams: FlowParams,
  t: number
): Shape {
  // Calculate rotation based on curve following
  const curveAngle = Math.atan2(tangent.y, tangent.x);
  const followRotation = curveAngle * flowParams.followCurve;
  
  // Calculate position with deviation
  const rng = seededRandom(shape.seed);
  const deviation = (rng() - 0.5) * flowParams.deviation;
  const normalOffset = flowParams.normalOffset;
  
  const finalPosition = basePoint
    .add(normal.multiply(normalOffset))
    .add(normal.multiply(deviation));
  
  // Apply transformations to shape
  return {
    paths: shape.paths.map(path => {
      const transformed = path.clone();
      transformed.rotate(followRotation * 180 / Math.PI);
      transformed.position = finalPosition;
      return transformed;
    }),
    bounds: shape.bounds,
    anchor: finalPosition,
  };
}
```

## Built-in Generators

### Initial Set (MVP)

1. **Bird** - Simple bird silhouette
   - Params: size, wingSpan, detailLevel
   
2. **Leaf** - Organic leaf shape
   - Params: size, curvature, veins
   
3. **Tree** - Stylized tree
   - Params: height, width, branchDensity, foliageDensity
   
4. **Polygon** - Basic geometric shapes
   - Params: sides, size, regularity
   
5. **House** - Simple building silhouette
   - Params: width, height, roofType, windows

## Creating Custom Generators

### Quick Start Guide

#### Step 1: Create Generator File

Create a new file in `src/generators/YourGenerator.ts`:

```typescript
import paper from 'paper';
import type { Generator, Shape, ParamDefinition } from '../types';
import { seededRandom, lerp } from '../utils/random';
import { mmToPx } from '../types/formats';

export class YourGenerator implements Generator {
  type = 'yourtype';
  name = 'Your Generator Name';
  description = 'Brief description for the library';
  tags = ['category', 'tags', 'for', 'search'];

  generate(t: number, params: Record<string, any>, seed: number): Shape {
    // Implementation here (see best practices below)
  }

  getDefaultParams(): Record<string, any> {
    return {
      sizeMin: 3,
      sizeMax: 10,
      // ... other default parameters in mm
    };
  }

  getParamDefinitions(): ParamDefinition[] {
    return [
      // ... parameter UI definitions
    ];
  }
}
```

#### Step 2: Register Generator

Add your generator to `src/generators/index.ts`:

```typescript
import { YourGenerator } from './YourGenerator';

// Register in the singleton initialization
GeneratorRegistry.register(new YourGenerator());
```

#### Step 3: Test

Reload the app and your generator should appear in the Generator Library panel.

---

### Best Practices & Critical Rules

#### 🚨 CRITICAL: Always Remove Paths from Paper.js

**Problem:** Paper.js automatically adds created paths to the active layer. If you don't remove them, they'll persist as "ghost" artifacts on the canvas (often appearing in the top-left corner or random positions).

**Solution:** Always remove paths before returning from `generate()`:

```typescript
generate(t: number, params: Record<string, any>, seed: number): Shape {
  const rng = seededRandom(seed);

  // Create your paths
  const path1 = new paper.Path.Circle({ ... });
  path1.strokeColor = new paper.Color('black');

  const path2 = new paper.Path.Line({ ... });
  path2.strokeColor = new paper.Color('black');

  const paths = [path1, path2];

  // Calculate bounds (use a temporary group if needed)
  const group = new paper.Group(paths);
  const bounds = group.bounds.clone(); // Clone bounds!
  group.remove(); // Remove the group

  // ✅ CRITICAL: Remove all paths from Paper.js
  paths.forEach(path => path.remove());

  return {
    paths,        // Paths still exist as JS objects
    bounds,       // Cloned bounds
    anchor: new paper.Point(0, 0),
  };
}
```

**Why this works:** The canvas clones these paths when rendering, so the originals can be safely removed.

#### ✅ Always Set strokeColor or fillColor

Paths without colors are invisible:

```typescript
// ❌ Bad - invisible path
const path = new paper.Path.Circle({ ... });

// ✅ Good - visible path
const path = new paper.Path.Circle({ ... });
path.strokeColor = new paper.Color('black');
path.strokeWidth = 1;
```

Note: Layer colors override these during rendering, but setting them helps with debugging.

#### ✅ Use Millimeters for Size Parameters

All user-facing size parameters should be in millimeters for physical accuracy:

```typescript
generate(t: number, params: Record<string, any>, seed: number): Shape {
  const rng = seededRandom(seed);

  // Convert mm to pixels (300 DPI)
  const sizeMm = lerp(params.sizeMin, params.sizeMax, rng());
  const size = mmToPx(sizeMm); // 1 mm = 11.811 pixels at 300 DPI

  // Use 'size' in pixels for Paper.js operations
  const circle = new paper.Path.Circle({
    center: [0, 0],
    radius: size / 2,
  });

  // ...
}
```

#### ✅ Use Seeded Randomness for Reproducibility

Always use `seededRandom()` instead of `Math.random()`:

```typescript
import { seededRandom, lerp } from '../utils/random';

generate(t: number, params: Record<string, any>, seed: number): Shape {
  const rng = seededRandom(seed); // Create RNG from seed

  // Use rng() for random values [0, 1]
  const size = lerp(params.sizeMin, params.sizeMax, rng());
  const variation = (rng() - 0.5) * 0.2; // -0.1 to +0.1
  const choice = rng() > 0.5; // Random boolean

  // ...
}
```

**Why:** Same seed = same output = reproducible art.

#### ✅ Return Valid Bounds

The `bounds` property is used for collision detection and layout:

```typescript
// For single path
const path = new paper.Path.Circle({ ... });
const bounds = path.bounds.clone();

// For multiple paths
const paths = [path1, path2, path3];
const group = new paper.Group(paths);
const bounds = group.bounds.clone(); // Clone before removing!
group.remove();
```

#### ✅ Anchor Point at Origin

Always set anchor to `new paper.Point(0, 0)` unless you have specific reasons:

```typescript
return {
  paths,
  bounds,
  anchor: new paper.Point(0, 0), // Origin anchor
};
```

The canvas will transform shapes relative to this anchor.

---

### Complete Example: PolygonGenerator

```typescript
import paper from 'paper';
import type { Generator, Shape, ParamDefinition } from '../types';
import { seededRandom, lerp } from '../utils/random';
import { mmToPx } from '../types/formats';

export class PolygonGenerator implements Generator {
  type = 'polygon';
  name = 'Polygon';
  description = 'Geometric shapes with 3-12 sides and adjustable regularity';
  tags = ['geometric', 'shape', 'abstract', 'mathematical'];

  generate(t: number, params: Record<string, any>, seed: number): Shape {
    const rng = seededRandom(seed);

    // Convert size from mm to pixels
    const sizeMm = lerp(params.sizeMin, params.sizeMax, rng());
    const size = mmToPx(sizeMm);
    const sides = Math.floor(params.sides);
    const regularity = params.regularity;

    // Create polygon
    const polygon = new paper.Path();
    const angleStep = (Math.PI * 2) / sides;

    for (let i = 0; i < sides; i++) {
      const angle = i * angleStep - Math.PI / 2; // Start at top

      // Add irregularity
      const radiusVariation = regularity < 1 ? (rng() - 0.5) * (1 - regularity) : 0;
      const radius = (size / 2) * (1 + radiusVariation);

      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      polygon.add(new paper.Point(x, y));
    }

    polygon.closed = true;

    // Smooth if regularity is high
    if (regularity > 0.7) {
      polygon.smooth({ type: 'continuous' });
    }

    polygon.strokeColor = new paper.Color('black');
    polygon.strokeWidth = 1;

    const paths: paper.Path[] = [polygon];

    // Add center point if enabled
    if (params.centerDot) {
      const center = new paper.Path.Circle({
        center: new paper.Point(0, 0),
        radius: size * 0.1,
      });
      center.strokeColor = new paper.Color('black');
      center.strokeWidth = 1;
      paths.push(center);
    }

    // Calculate bounds and remove paths from Paper.js
    const bounds = polygon.bounds.clone();
    paths.forEach(path => path.remove());

    return {
      paths,
      bounds,
      anchor: new paper.Point(0, 0),
    };
  }

  getDefaultParams(): Record<string, any> {
    return {
      sizeMin: 3,        // mm
      sizeMax: 10,       // mm
      sides: 5,
      regularity: 0.8,   // 0-1
      centerDot: false,
    };
  }

  getParamDefinitions(): ParamDefinition[] {
    return [
      {
        name: 'sizeMin',
        type: 'number',
        min: 1,
        max: 50,
        step: 0.5,
        label: 'Taille min (mm)',
        description: 'Taille minimale des polygones en millimètres',
        defaultValue: 3,
      },
      {
        name: 'sizeMax',
        type: 'number',
        min: 1,
        max: 50,
        step: 0.5,
        label: 'Taille max (mm)',
        description: 'Taille maximale des polygones en millimètres',
        defaultValue: 10,
      },
      {
        name: 'sides',
        type: 'number',
        min: 3,
        max: 12,
        step: 1,
        label: 'Côtés',
        description: 'Nombre de côtés du polygone',
        defaultValue: 5,
      },
      {
        name: 'regularity',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.1,
        label: 'Régularité',
        description: 'Régularité du polygone (0=irrégulier, 1=régulier)',
        defaultValue: 0.8,
      },
      {
        name: 'centerDot',
        type: 'checkbox',
        label: 'Point central',
        description: 'Ajouter un point au centre',
        defaultValue: false,
      },
    ];
  }
}
```

---

### Parameter Definition Types

```typescript
type ParamDefinition = {
  name: string;              // Must match param key
  label: string;             // Display label
  description?: string;      // Tooltip/help text
  defaultValue: any;         // Default value

  // For numbers
  type: 'number';
  min?: number;
  max?: number;
  step?: number;

  // For sliders (same as number but different UI)
  type: 'slider';
  min: number;
  max: number;
  step: number;

  // For checkboxes
  type: 'checkbox';

  // For dropdowns
  type: 'select';
  options: string[];
};
```

---

### Debugging Checklist

If your generator isn't working:

1. **Not visible?**
   - Check if `strokeColor` or `fillColor` is set
   - Check browser console for errors
   - Verify paths are added to the `paths` array

2. **Ghost artifacts appearing?**
   - Make sure you call `path.remove()` on all paths before returning
   - Make sure you call `group.remove()` if you create temporary groups

3. **Shapes not scaling with canvas?**
   - Verify you're using `mmToPx()` for size conversion
   - Check that bounds are calculated correctly

4. **Random but not reproducible?**
   - Use `seededRandom(seed)` instead of `Math.random()`
   - Make sure same seed produces same RNG sequence

5. **Parameters not showing in UI?**
   - Check `getParamDefinitions()` return value
   - Verify parameter names match between `getDefaultParams()` and `getParamDefinitions()`

6. **Generator not appearing in library?**
   - Make sure it's registered in `src/generators/index.ts`
   - Check that `type` is unique
   - Reload the browser (hard refresh: Ctrl+Shift+R)

---

### Advanced Patterns

#### Using the t Parameter

The `t` parameter (0-1) represents position along the curve:

```typescript
generate(t: number, params: Record<string, any>, seed: number): Shape {
  // Vary size based on position
  const sizeVariation = Math.sin(t * Math.PI); // 0 at start/end, 1 at middle
  const size = mmToPx(params.size) * (0.5 + sizeVariation * 0.5);

  // Different shape at beginning vs end
  if (t < 0.2) {
    // Small shapes at start
  } else if (t > 0.8) {
    // Large shapes at end
  }

  // ...
}
```

#### Creating Complex Shapes

```typescript
// Use loops for repetition
for (let i = 0; i < count; i++) {
  const angle = (i / count) * Math.PI * 2;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  path.add(new paper.Point(x, y));
}

// Use Paper.js boolean operations
const circle1 = new paper.Path.Circle({ ... });
const circle2 = new paper.Path.Circle({ ... });
const union = circle1.unite(circle2);
circle1.remove();
circle2.remove();

// Clone and transform
const shape = createBaseShape();
const mirrored = shape.clone();
mirrored.scale(-1, 1); // Mirror horizontally
```

---

### Testing Your Generator

1. **Test in FlowPath mode:**
   - Create a curve
   - Add your generator
   - Try different densities and parameters
   - Change global seed - output should be different but reproducible

2. **Test in Standalone mode:**
   - Place individual instances
   - Try rotation and scale
   - Verify appearance at different sizes

3. **Test export:**
   - Export to SVG
   - Open in Inkscape/Illustrator
   - Check for missing elements or artifacts

## User Interface

### Main Canvas
- Background image display
- Real-time preview of all layers
- Zoom/pan controls
- Grid overlay (optional)

### Toolbar
- **Select tool** - Select and move objects
- **FlowPath tool** - Draw Bézier curves
- **Standalone placement** - Click to place generators
- **Edit points** - Modify Bézier curve control points
- **Delete** - Remove selected objects

### Panels

#### Layers Panel
- List of all layers
- Add/remove/reorder layers
- Toggle visibility
- Set color per layer
- Lock/unlock layers

#### Properties Panel (contextual)

**When FlowPath selected:**
- Distribution mode (linear/noise/random)
- Density slider
- Flow parameters (followCurve, deviation, etc.)
- List of generators with weights
- Add/remove generators
- Edit generator parameters

**When StandaloneGenerator selected:**
- Position (x, y)
- Rotation
- Scale
- Generator type selector
- Generator parameters

**When Layer selected:**
- Layer name
- Color picker
- Brush effect settings

#### Generator Library Panel
- List of available generators
- Preview thumbnails
- Drag to canvas for standalone placement
- Drag to FlowPath to add to generators list

### Interactions

1. **Create FlowPath**
   - Select FlowPath tool
   - Click to place points
   - Drag handles to create curves
   - Double-click to finish

2. **Add Generator to FlowPath**
   - Select FlowPath
   - Click "Add Generator" in properties
   - Choose generator type
   - Configure parameters and weight

3. **Place Standalone Generator**
   - Select placement tool
   - Choose generator from library
   - Click on canvas to place
   - Adjust in properties panel

4. **Edit FlowPath Curve**
   - Select FlowPath
   - Drag control points
   - Curve updates in real-time
   - Generators regenerate automatically

5. **Regenerate**
   - Manual: Button to regenerate selected FlowPath
   - Auto: Toggle for real-time regeneration on parameter change

## Export

### SVG Export per Layer

```javascript
function exportLayer(layer: Layer): string {
  const svg = new paper.CompoundPath();
  
  // Add all FlowPath instances
  layer.flowPaths.forEach(flowPath => {
    const instances = regenerateFlowPath(flowPath);
    instances.forEach(shape => {
      shape.paths.forEach(path => svg.addChild(path));
    });
  });
  
  // Add all standalone generators
  layer.standaloneGenerators.forEach(gen => {
    const shape = gen.generate();
    shape.paths.forEach(path => svg.addChild(path));
  });
  
  // Apply brush effect if enabled
  if (layer.brushEffect.enabled) {
    applyBrushFadeEffect(svg, layer.brushEffect);
  }
  
  // Export to SVG string
  return svg.exportSVG({ asString: true });
}
```

### File Format

Export creates:
- `project-name-layer-1.svg`
- `project-name-layer-2.svg`
- `project-name-layer-3.svg`
- `project-name-project.json` (project save file)

## Project Save Format

```json
{
  "version": "1.0",
  "backgroundImage": {
    "dataUrl": "data:image/png;base64,...",
    "width": 2480,
    "height": 3508
  },
  "layers": [
    {
      "id": "layer-1",
      "name": "Oiseaux",
      "color": "#000000",
      "visible": true,
      "locked": false,
      "order": 0,
      "brushEffect": {
        "enabled": true,
        "fadeStart": 0.7,
        "fadeEnd": 1.0
      },
      "flowPaths": [...],
      "standaloneGenerators": [...]
    }
  ]
}
```

## Implementation Priority (MVP)

### Phase 1: Core Infrastructure
1. ✅ Paper.js canvas setup with background image
2. ✅ Layer system (add/remove/reorder/visibility)
3. ✅ Basic project structure (save/load JSON)

### Phase 2: FlowPath System
4. ✅ Bézier curve drawing tool
5. ✅ FlowPath data structure
6. ✅ Distribution algorithm (linear mode first)
7. ✅ Basic flow transform (position + rotation)

### Phase 3: Generators
8. ✅ Generator interface and registry
9. ✅ Implement 2-3 simple generators (bird, leaf, polygon)
10. ✅ Generator parameter system

### Phase 4: UI
11. ✅ Properties panel (contextual)
12. ✅ Layers panel
13. ✅ Generator library panel
14. ✅ Selection and manipulation tools

### Phase 5: Advanced Features
15. ✅ Noise and random distribution modes
16. ✅ Boids simulation
17. ✅ Standalone generator placement
18. ✅ SVG export per layer

### Phase 6: Polish
19. ✅ Brush fade effect
20. ✅ FlowPath dependencies
21. ✅ More generators (tree, house, etc.)
22. ✅ Undo/redo system

## Technical Stack

- **Canvas/SVG**: Paper.js
- **UI Framework**: React (recommended) or vanilla JS
- **State Management**: Context API or simple store
- **Noise**: Perlin noise library (simplex-noise or similar)
- **Random**: Seedrandom library for reproducible randomness
- **File Handling**: File API for image import/export

## Development Notes

- All generation must be **deterministic** (same seed = same result)
- Performance: cache generated instances, only regenerate on parameter change
- Paper.js handles most geometric calculations (curve sampling, normals, etc.)
- Keep generators pure and stateless
- UI should reflect changes in real-time when feasible
- Support undo/redo from the start (event sourcing pattern recommended)

## Future Enhancements

- Shape detection from background image (OpenCV.js or ML model)
- Zone painting to restrict generator distribution
- Custom distribution functions
- Animation preview (simulate plotting process)
- Batch export with variations (different seeds)
- Generator marketplace/sharing
- 3D perspective transforms for depth effects