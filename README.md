


# Mix Draw - Technical Specification

## Project Overview

Mix Draw is a generative art platform that blends hand painting with plotter precision. The application allows artists to create SVG files that will be plotted on top of pre-existing artwork.

### Core Concept
- Import a photo of hand-painted artwork as background
- Define or detect shapes from the original artwork
- Place generators along curves or at specific positions
- Export layered SVG files for multi-pass plotting

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

## Future Enhancements

- Shape detection from background image (OpenCV.js or ML model)
- Zone painting to restrict generator distribution
- Custom distribution functions
- Animation preview (simulate plotting process)
- Batch export with variations (different seeds)
- Generator marketplace/sharing
- 3D perspective transforms for depth effects