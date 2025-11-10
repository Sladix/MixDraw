# Mix Draw - Claude AI Context Document

## Project Overview

**Mix Draw** is a generative art platform that blends hand-painting precision with algorithmic generation. It allows artists to create SVG files optimized for A3/A4 plotter output by combining:
- Hand-drawn Bezier curves (FlowPaths)
- Algorithmic shape generators distributed along curves
- Layer-based composition with precise control

**Tech Stack:**
- React 18 + TypeScript (strict mode)
- Paper.js (vector graphics)
- Zustand (state management)
- Vite (build tool)
- Seeded randomness for reproducibility

**Units:**
- **All user-facing parameters use millimeters (mm)** for physical accuracy
- Internally converted to pixels at 300 DPI for rendering
- Conversion: 1 mm = 11.811 pixels at 300 DPI

## Architecture Overview

### Core Concepts

1. **Generators**: Pure functions that create shapes deterministically
   - Input: `t` (position 0-1), `params` (configuration in mm), `seed` (random seed)
   - Output: `Shape` (collection of Paper.js paths with bounds and anchor)
   - Examples: BirdGenerator, LeafGenerator, PolygonGenerator
   - **Size parameters are in millimeters** and converted to pixels internally using `mmToPx()`

2. **FlowPaths**: Bezier curves with distributed generators
   - User draws curve by clicking points
   - Generators are distributed along curve using distribution algorithms
   - Each instance is transformed based on curve tangent/normal
   - **Flow parameters (deviation, normalOffset, boidsRadius) are in millimeters**

3. **Standalones**: Individual generator instances placed directly
   - Click to place at specific position
   - Full control over position, rotation, scale

4. **Layers**: Standard layer system for composition
   - Multiple layers with visibility/lock controls
   - Each layer has color, order, and contains FlowPaths + Standalones

### Directory Structure

```
src/
├── core/
│   ├── GeneratorRegistry.ts     # Singleton registry for all generators
│   ├── distribution.ts          # t-value distribution algorithms (linear, noise, random)
│   ├── flowPathEngine.ts        # FlowPath regeneration and transformation logic
│   └── export.ts                # SVG export functionality
├── generators/
│   ├── index.ts                 # Registration entry point (singleton guard)
│   ├── BirdGenerator.ts         # Bird shape generator
│   ├── LeafGenerator.ts         # Leaf shape generator
│   └── PolygonGenerator.ts      # Polygon shape generator
├── components/
│   ├── CanvasWorking.tsx        # Main Paper.js canvas (THE ONLY CANVAS FILE)
│   ├── Toolbar.tsx              # FlowPath/Standalone tool selector
│   ├── LayersPanel.tsx          # Layer list with add/delete/reorder
│   ├── LayerContentsPanel.tsx   # Contents of active layer (FlowPaths/Standalones)
│   ├── ControlPanel.tsx         # Format, seed, background, export
│   └── GeneratorLibraryPanel.tsx # Generator browser with search/tags
├── store/
│   └── useStore.ts              # Zustand store (single source of truth)
├── types/
│   ├── index.ts                 # Core type definitions
│   └── formats.ts               # A3/A4 paper format definitions
├── utils/
│   └── random.ts                # Seeded random utilities (seedrandom, lerp)
├── App.tsx                      # Main app layout (5-panel system)
└── main.tsx                     # React entry point
```

## Critical Technical Details

### Paper.js + Zustand Serialization Issue

**CRITICAL**: Paper.js Path objects lose all methods when stored in Zustand (JSON serialization).

**Problem:**
```typescript
// After Zustand storage:
flowPath.bezierCurve.length         // ❌ undefined
flowPath.bezierCurve.getPointAt()   // ❌ undefined
```

**Solution (implemented in CanvasWorking.tsx:144-177):**
```typescript
// Reconstruct Paper.js Path from stored segments
const reconstructedPath = new paper.Path();
flowPath.bezierCurve.segments.forEach((seg: any) => {
  if (seg.point) {
    reconstructedPath.add(new paper.Point(seg.point.x, seg.point.y));
  }
});
reconstructedPath.smooth({ type: 'continuous' });

// Use reconstructed path
const instances = regenerateFlowPath({
  ...flowPath,
  bezierCurve: reconstructedPath
});
```

### Canvas Layer Management

**Paper.js layers are stored in refs** (not Zustand) to maintain their methods:
- `projectRef`: Paper.js project
- `backgroundLayerRef`: Persistent background layer (never cleared)
- `contentLayerRef`: Content layer (cleared and re-rendered on changes)

**Key Pattern:**
```typescript
// ✅ Store layer in ref
contentLayerRef.current = new paper.Layer();

// ❌ Don't search by name (unreliable)
// const layer = project.layers.find(l => l.name === 'content');
```

### Generator Best Practices

1. **Always set fillColor or strokeColor** on paths
   ```typescript
   const body = new paper.Path.Ellipse({...});
   body.fillColor = new paper.Color('black'); // ✅ Required!
   ```

2. **Return Shape with valid bounds**
   ```typescript
   const group = new paper.Group(paths);
   const bounds = group.bounds;
   group.remove(); // Clean up temporary group

   return { paths, bounds, anchor: new paper.Point(0, 0) };
   ```

3. **Use seeded random for reproducibility**
   ```typescript
   const rng = seededRandom(seed);
   const size = lerp(params.sizeMin, params.sizeMax, rng());
   ```

### Console Logging Strategy

**Comprehensive logging is enabled** for debugging. Key log patterns:

- 🔄 = Effect/function entry
- 🎨 = Canvas rendering
- 📍 = FlowPath processing
- 🔨 = Generator instance creation
- 🐦/🍃/📐 = Specific generator (bird/leaf/polygon)
- ✅ = Success/completion
- ❌ = Error
- ⚠️ = Warning/skip

**To disable logs for production**, search for `console.log` in:
- CanvasWorking.tsx
- flowPathEngine.ts
- BirdGenerator.ts (and other generators)

## State Management (Zustand)

### Store Structure
```typescript
{
  project: {
    name: string;
    layers: Layer[];
    backgroundImage: { dataUrl: string } | null;
  },
  paperFormat: 'A3' | 'A4',
  zoom: number,
  globalSeed: number,
  currentTool: 'flowpath' | 'standalone',
  selectedGeneratorType: string | null,
  activeLayerId: string | null
}
```

### Key Actions
- `addLayer()`, `deleteLayer()`, `reorderLayers()`
- `addFlowPath()`, `updateFlowPath()`, `removeFlowPath()`
- `addStandaloneGenerator()`, `updateStandaloneGenerator()`, `removeStandaloneGenerator()`
- `setPaperFormat()`, `setGlobalSeed()`, `regenerateSeed()`

## Component Communication

### Canvas → Store
- User draws FlowPath → stores segments in Zustand
- User places Standalone → stores position/params in Zustand

### Store → Canvas
- Zustand changes trigger render effect
- Canvas reconstructs Paper.js paths from stored data
- Canvas calls `regenerateFlowPath()` or `generateStandaloneInstance()`

### Generator Library → Canvas
- User selects generator → updates `selectedGeneratorType`
- Auto-switches tool to appropriate mode

## Common Workflows

### Adding a New Generator

1. Create `src/generators/NewGenerator.ts`:
```typescript
export class NewGenerator implements Generator {
  type = 'newgen';
  name = 'New Generator';
  description = 'Description here';
  tags = ['category', 'tags'];

  generate(t: number, params: Record<string, any>, seed: number): Shape {
    // Use seededRandom, set fillColor, return valid Shape
  }

  getDefaultParams() { /* ... */ }
  getParamDefinitions() { /* ... */ }
}
```

2. Register in `src/generators/index.ts`:
```typescript
import { NewGenerator } from './NewGenerator';
GeneratorRegistry.register(new NewGenerator());
```

### Debugging Render Issues

1. Open browser console (F12)
2. Look for "🔄 Render effect triggered"
3. Check if "🎨 Rendering content..." appears
4. Verify layer counts: "🔍 Layer X: Y flowPaths, Z standalones"
5. Check if generators are called: "🐦 BirdGenerator.generate()"
6. Verify paths added: "✅ Added path to layerGroup"

### Export SVG

Export is implemented in `src/core/export.ts` with two modes:
- `exportToSVG()`: Full project export
- `exportLayerToSVG()`: Single layer export

## Known Constraints & Design Decisions

1. **No Delete/Edit tools in toolbar** - use LayerContentsPanel for management
2. **No Pan tool** - removed to simplify UI
3. **Single Paper.js canvas** - CanvasWorking.tsx is the only canvas component
4. **Generators are stateless** - pure functions, no internal state
5. **Zustand is single source of truth** - Paper.js objects are ephemeral
6. **Color override** - Layer color always overrides generator colors in render

## Future Enhancement Ideas

- More generators (trees, clouds, geometric patterns)
- Advanced distribution modes (cluster, grid, physics)
- Path editing tools (add/remove/move points)
- Parameter animation over curve (size/rotation changes)
- Boids simulation improvements
- Custom color per FlowPath/Standalone
- Import/Export project files (.json)

## Development Commands

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint check
```

## Quick Orientation for New Sessions

**If you need to:**
- **Add feature** → Check if it's generator, distribution, or UI
- **Fix rendering** → Check CanvasWorking.tsx render effect
- **Debug invisibility** → Check console logs, verify fillColor
- **Understand flow** → Follow: User action → Zustand → Canvas render → flowPathEngine → Generator
- **Modify UI layout** → App.tsx has 5-panel flex layout

**Key files to always review:**
1. `src/components/CanvasWorking.tsx` - Canvas rendering logic
2. `src/core/flowPathEngine.ts` - Instance generation
3. `src/store/useStore.ts` - State management
4. `src/types/index.ts` - Type definitions

## Recent Fixes (Context for Continuation)

1. ✅ Removed 7 deprecated canvas components (cleanup)
2. ✅ Fixed missing fillColor in BirdGenerator (paths were invisible)
3. ✅ Added comprehensive console logging throughout pipeline
4. ✅ Fixed content layer storage (now uses ref instead of search)
5. ✅ Removed redundant `paper.setup()` call

**Current Status:** Generators should now be visible on canvas. If issues persist, check browser console for detailed execution trace.
