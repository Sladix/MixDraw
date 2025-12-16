import type { FormulaPreset } from '../core/types';

export const FORMULA_PRESETS: FormulaPreset[] = [
  {
    name: 'Sine Waves',
    expression: 'sin(x/scale) * cos(y/scale)',
    description: 'Classic sine wave interference pattern',
  },
  {
    name: 'Perlin Flow',
    expression: 'noise(x/scale, y/scale) * PI * 2',
    description: 'Smooth perlin-like noise field',
  },
  {
    name: 'Spiral',
    expression: 'angle + dist * 0.01',
    description: 'Spiraling outward from center',
  },
  {
    name: 'Vortex',
    expression: 'angle + PI/2 + sin(dist/50) * 0.5',
    description: 'Swirling vortex pattern',
  },
  {
    name: 'Diagonal Flow',
    expression: 'PI/4 + sin((x+y)/scale) * 0.5',
    description: '45-degree flow with wave modulation',
  },
  {
    name: 'Radial Burst',
    expression: 'angle + cos(dist/30) * PI * turbulence',
    description: 'Radiating lines with turbulent edges',
  },
  {
    name: 'Magnetic Field',
    expression: 'atan2(ny - 0.3, nx - 0.3) * 0.5 + atan2(ny - 0.7, nx - 0.7) * 0.5',
    description: 'Two-pole magnetic field simulation',
  },
  {
    name: 'Gravity Well',
    expression: 'angle + PI/2 - 1/max(dist, 10) * 500',
    description: 'Orbital paths around center',
  },
  {
    name: 'Wave Grid',
    expression: 'sin(x/50) * sin(y/50) * PI',
    description: 'Grid-aligned wave pattern',
  },
  {
    name: 'Chaos',
    expression: 'sin(x/scale * y/scale) * tan(noise(nx, ny)) * PI',
    description: 'Chaotic, unpredictable flow',
  },
  {
    name: 'Horizontal Bands',
    expression: 'sin(y/scale) * PI/4',
    description: 'Wavy horizontal stripes',
  },
  {
    name: 'Vertical Bands',
    expression: 'PI/2 + sin(x/scale) * PI/4',
    description: 'Wavy vertical stripes',
  },
  {
    name: 'Concentric Circles',
    expression: 'angle + PI/2',
    description: 'Perfect circular flow',
  },
  {
    name: 'Twist Warp',
    expression: 'angle + dist/100 * twist/360 * TAU',
    description: 'Uses twist super param for spiral intensity',
  },
  {
    name: 'Turbulent Noise',
    expression: 'noise(x/scale + turbulence*10, y/scale) * PI * (1 + turbulence)',
    description: 'Noise affected by turbulence param',
  },
  {
    name: 'Fireworks',
    expression: 'nx * PI',
    description: 'Explosive radial patterns',
  }
];
