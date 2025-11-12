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
   - Examples: Bird, Leaf, Polygon, Grass, Tree
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
│   ├── [Name]Generator.ts    # Bird, Leaf, Polygon, Grass, Tree
│   └── index.ts              # Registration (singleton guard)
├── components/
│   ├── CanvasWorking.tsx     # THE ONLY CANVAS - applies layer strokeWidth
│   ├── ControlPanel.tsx      # Format, seed, save/load, export
│   └── LayersPanel.tsx       # Layer list with strokeWidth control
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
- 2D tube filling (generators fill area, not just line)
- Density/spread modifiers with custom curves
- Layer-level strokeWidth (0.3mm default)
- localStorage save/load with project browser modal
- Grass + Tree generators

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

## Flow
User action → Zustand update → Canvas render effect → flowPathEngine → tubeFilling → Generator → Render with layer settings
