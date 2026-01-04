# FlowField Generator

A flow field visualization tool optimized for pen plotter output. Generates long, continuous streamlines that follow vector fields defined by noise, formulas, and geometric forces.

## Algorithm Overview

### Core Concept

The generator creates streamlines by tracing paths through a vector field. At each point, the direction is determined by combining multiple "forces" (noise, circular patterns, mathematical formulas). Lines propagate outward from seed points, filling the canvas organically.

### Streamline Generation (Greedy Propagation)

```
1. Initialize seed queue with golden-ratio spiral points (better coverage than random)
2. While queue not empty:
   a. Pop highest-priority seed
   b. Trace line in BOTH directions from seed (forward + backward)
   c. If line length >= minLength, keep it and generate new seeds along its length
   d. Mark occupied cells in spatial hash
3. When queue empties, run gap-filling to find uncovered areas
4. Repeat until no more valid seeds
```

### Key Optimizations for Maximum Line Length

#### 1. Fine-Grained Spatial Hash
```
gridCellSize = dTest / 3
```
Instead of using `dTest` directly, we use a finer grid. This allows more precise collision detection and lets lines get closer to each other without false positives.

#### 2. Sparse Marking
```typescript
// Only mark every Nth point
for (let i = 0; i < points.length; i += markFrequency) {
  mark(points[i]);
}
```
Marking every single point "blocks" too much space. Sparse marking leaves gaps that allow nearby lines to pass through.

#### 3. Permissive Continuation Check
```typescript
// Only check exact cell, not neighbors
isValidForContinuation(point) {
  return !occupiedCells.has(getCellIndex(point));
}
```
When continuing an existing line, we only check if the exact cell is occupied. This is more permissive than checking neighbors, allowing lines to run parallel very close to each other.

#### 4. Lookahead (Jump Over Obstacles)
```typescript
// When blocked, keep trying for up to 8 steps
if (blocked) {
  blockedPoints.push(next);
  blockedSteps++;
  if (blockedSteps > 8) break;
} else {
  // Found open space - add all blocked points
  points.push(...blockedPoints);
}
```
Instead of stopping immediately when hitting an obstacle, the algorithm continues for several steps. If it finds open space, it includes the intermediate points. This allows lines to "jump over" small obstacles (like crossing near another line).

#### 5. Priority-Based Seed Selection
```typescript
priority = edgeDistance * 0.7 + centerDistance * 0.3
```
Seeds closer to the center of the canvas are processed first. Lines starting from the center tend to be longer because they have more room to grow in all directions.

#### 6. Gap Filling
After the initial propagation, the algorithm scans for uncovered areas and places new seeds there. This runs up to 3 times to maximize coverage.

### Force System

The vector field is computed by combining multiple forces:

| Force Type | Description |
|------------|-------------|
| **Noise** | Simplex noise with configurable scale, complexity, and octaves |
| **Circular** | Tangent, radial, or spiral patterns around a center point |
| **Formula** | Custom mathematical expressions (e.g., `sin(x/scale) * cos(y/scale)`) |

Forces are combined using vector averaging to avoid angle discontinuities:
```typescript
vx += cos(angle) * weight;
vy += sin(angle) * weight;
finalAngle = atan2(vy, vx);
```

### Super Parameters (Global Deformations)

Applied to all forces before evaluation:

- **Scale**: Controls noise/formula frequency
- **Warp**: Domain warping (distortion)
- **Twist**: Angular rotation increasing with distance from center
- **Turbulence**: High-frequency noise overlay

### Progressive Rendering

Uses an async generator to yield streamlines one at a time:
```typescript
async *generateAsync() {
  for each seed in queue {
    const streamline = trace(seed);
    yield streamline;  // Render immediately
    await requestAnimationFrame();  // Don't block UI
  }
}
```

This creates the satisfying "drawing" effect where lines appear progressively.

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `dSep` | 8 | Seed spacing (higher = fewer lines) |
| `dTest` | 4 | Minimum distance between lines |
| `stepSize` | 2 | Integration step (smaller = smoother) |
| `maxSteps` | 800 | Maximum points per line |
| `minLength` | 10 | Minimum points to keep a line |
| `strokeWidth` | 2 | Line thickness |

## Output

Exports to SVG with proper millimeter units for pen plotters:
```svg
<svg width="210mm" height="297mm">
  <path d="M..." stroke="#1a1a1a" stroke-width="2"/>
</svg>
```

## Architecture

```
src/
├── core/
│   ├── StreamlineGeneratorV2.ts  # Main algorithm
│   ├── ForceEngine.ts            # Vector field computation
│   ├── Vec2.ts                   # Lightweight 2D math (no Paper.js)
│   └── types.ts                  # TypeScript interfaces
├── components/
│   ├── Canvas.tsx                # Rendering with Paper.js
│   └── ControlPanel.tsx          # UI controls
└── store/
    └── useFlowFieldStore.ts      # Zustand state
```

Paper.js is only used for final rendering and SVG export. All geometric calculations use the lightweight `Vec2` class for better performance.

## Inspiration

- [msurguy/flow-lines](https://github.com/msurguy/flow-lines) - Progressive rendering approach
- Jobard & Lefer (1997) - "Creating Evenly-Spaced Streamlines of Arbitrary Density"
