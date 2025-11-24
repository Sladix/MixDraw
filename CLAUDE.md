# Instructions
Keep this file small.

# Mix Draw - Claude Context

## What It Is
Generative art tool for plotter SVG output (A3/A4). Hand-drawn curves + algorithmic generators = plotter-ready art.

**Solo project** - No backward compatibility. Break things freely.

## Tech Stack
React 18 + TypeScript + Paper.js + Zustand + localStorage

**Units**: All params in millimeters, converted to pixels at 300 DPI (1mm = 11.811px)

## Core Architecture

### Key Concepts
1. **Generators**: Pure functions creating shapes from `(t, params, seed) => Shape`
   - Examples: Bird, Leaf, Polygon, Grass, Tree, Glyph
   - All sizes in mm, converted with `mmToPx()`
   - NO strokeWidth params - controlled at layer level

2. **FlowPaths**: Bezier curves with 2D tube filling
   - Generators fill tube area (not just centerline)
   - Modes: grid, noise, random, packed
   - Spread = tube width in mm
   - Modifiers vary density/spread along curve

3. **Layers**: Color + strokeWidth (mm) per layer
   - strokeWidth consistent for plotter (same pen per layer)
   - Layer settings override generator output during render

4. **localStorage**: Browser-based project persistence

### Advanced Systems

#### MinMax Parameter System
All numeric parameters support three modes:
- **Static**: Single value (e.g., `density: 0.5`)
- **Range**: Random per-instance (e.g., `density: { min: 0.3, max: 0.8 }`)
- **Timeline-modulated Range**: Animated bounds along curve

**Key Components:**
- `MinMaxControl.tsx`: UI toggle (🔗 single / ○ range), timeline button (⏱)
- `evaluateAnimatableParameter()` in `utils/animatable.ts`: Resolves value at position t
- Type guards: `isMinMaxValue()`, `isAnimatableMinMaxValue()`
- Timeline naming: FlowPath params use `'density'`, generator params use `'gen.{id}.{param}'`

**Evaluation Flow:**
```typescript
// At each point t along curve:
1. Check for timeline by param name
2. If timeline exists: Use timeline.evaluate(t) ± 10% variation
3. If MinMaxValue: Random between min/max
4. If static: Pass through
```

#### Bezier Editing System
Visual manipulation of FlowPath curves:
- **Coordinate system**: Normalized (0-1) stored in Zustand, converted to absolute pixels for render
- **Edit mode**: Click curve → Shows draggable points (blue) and handles (red/green)
- **Arc-length parameterization**: `bezier.ts` provides `calculatePointTValue()` for uniform distribution
- **Grid snap**: Optional snap-to-grid with `grid.ts` utilities
- **Selection state**: Tracks `editingBezier`, `selectedPointIndex`, `selectedHandleType`

**Why normalized coordinates?** Format independence - same curve works on A3/A4.

#### Packed Fill Mode
Collision-aware distribution for maximum density:
- **Algorithm**: Poisson disk sampling + per-instance bounds checking
- **Packing modes**:
  - `tight`: No overlap
  - `normal`: 10% overlap (default)
  - `loose`: 25% overlap
  - `allow-overlap`: No collision detection
- **MinSpacing**: -2mm to +5mm (negative = tighter, positive = more space)
- **Density modes**:
  - `visual`: Adjusts for shape size (default)
  - `fixed-count`: Exact count regardless of size

### Critical Files
```
src/
├── core/
│   ├── flowPathEngine.ts     # Instance generation + tube filling
│   ├── tubeFilling.ts        # 2D distribution (grid/noise/random/packed)
│   ├── modifierEngine.ts     # Density/spread variation along curve
│   ├── storage.ts            # localStorage project management
│   └── export.ts             # SVG export
├── generators/
│   ├── [Name]Generator.ts    # Bird, Leaf, Polygon, Grass, Tree, Glyph
│   └── index.ts              # Registration (singleton guard)
├── components/
│   ├── CanvasWorking.tsx     # THE ONLY CANVAS - applies layer strokeWidth
│   ├── ControlPanel.tsx      # Format, seed, save/load, export
│   ├── LayersPanel.tsx       # Layer list with strokeWidth control
│   ├── BezierEditOverlay.tsx # Interactive bezier curve point editing
│   ├── GridOverlay.tsx       # Compositional grid system with snap
│   ├── ParameterControl.tsx  # Unified parameter UI component
│   └── TimelinePanel.tsx     # Timeline editor with presets
├── contexts/
│   └── TimelineContext.tsx   # Timeline state management
├── utils/
│   ├── animatable.ts         # MinMax/timeline parameter evaluation
│   ├── bezier.ts             # Arc-length parameterization
│   └── grid.ts               # Grid snapping utilities
└── store/useStore.ts         # Zustand - single source of truth
```

## Critical Technical Issues

### Paper.js Serialization
Paper.js paths lose methods in Zustand. **Always reconstruct**:
```typescript
const reconstructedPath = new paper.Path();
flowPath.bezierCurve.segments.forEach((seg: any) => {
  reconstructedPath.add(new paper.Point(seg.point.x, seg.point.y));
});
reconstructedPath.smooth({ type: 'continuous' });
```

### Canvas Layers
Store Paper.js layers in **refs**, not by name search:
```typescript
contentLayerRef.current = new paper.Layer(); // ✅
// NOT: project.layers.find(l => l.name === 'content') // ❌
```

## Generator Pattern

```typescript
export class NewGenerator implements Generator {
  type = 'newgen';
  name = 'New Generator';
  tags = ['category'];

  generate(t: number, params: Record<string, any>, seed: number): Shape {
    const rng = seededRandom(seed);
    const sizeMm = lerp(params.sizeMin, params.sizeMax, rng());
    const size = mmToPx(sizeMm); // Always convert mm to px

    const path = new paper.Path.Circle({ center: [0, 0], radius: size });
    path.strokeColor = new paper.Color('black'); // Required!
    path.strokeWidth = 1; // Placeholder - layer overrides

    const group = new paper.Group([path]);
    const bounds = group.bounds;
    group.remove(); // Clean up

    return { paths: [path], bounds, anchor: new paper.Point(0, 0) };
  }

  getDefaultParams() { return { sizeMin: 5, sizeMax: 12 }; }
  getParamDefinitions() { return [/* ParamDefinition[] */]; }
}

// Register in generators/index.ts:
GeneratorRegistry.register(new NewGenerator());
```

## Recent Features (2025)
- **MinMax parameters**: Static/range/timeline modes for all numeric params
- **Glyph generator**: Grid-based typographic character synthesis
- **Bezier editing**: Visual point/handle manipulation with grid snap
- **Packed fill mode**: Collision detection with packing tolerance
- **Timeline enhancements**: Presets, random generation, inline previews
- **Copy/paste config**: Duplicate FlowPath settings
- 2D tube filling (generators fill area, not just line)
- Layer-level strokeWidth (0.3mm default)

## Quick Debug
1. F12 console → Look for "🔄 Render effect triggered"
2. Check "🎨 Rendering content..."
3. Verify "✅ Added path to layerGroup"
4. If invisible: Check `strokeColor` or `fillColor` set on paths

## Key Design Decisions
- **Generators are stateless** - no strokeWidth in params
- **Zustand = source of truth** - Paper.js objects are ephemeral
- **Layer settings override** - color/strokeWidth applied during render
- **Single canvas component** - CanvasWorking.tsx only
- **MinMax flexibility** - All numeric params support static/range/timeline modes
- **Normalized coordinates** - Bezier curves stored as 0-1 for format independence
- **Timeline namespacing** - Generator params use `'gen.{id}.{param}'` format
- **Arc-length parameterization** - Uniform distribution along curves
- **Collision-aware packing** - Packed mode respects shape bounds
  - Long-term: Integrate into flex/grid layout

## Flow
User action → Zustand update → Canvas render effect → flowPathEngine → tubeFilling → Generator → Render with layer settings
