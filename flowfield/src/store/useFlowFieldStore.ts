import { create } from 'zustand';
import type {
  Force,
  SuperParams,
  Zone,
  ZoneParams,
  LineParams,
  FormatType,
  NoiseForce,
  CircularForce,
  FormulaForce,
  ColorPalette,
} from '../core/types';
import {
  DEFAULT_SUPER_PARAMS,
  DEFAULT_ZONE_PARAMS,
  DEFAULT_LINE_PARAMS,
  DEFAULT_COLOR_PALETTE,
} from '../core/types';
import { generateZones } from '../core/ZoneSystem';

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function createRng(seed: number): () => number {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ============================================================================
// Default Forces
// ============================================================================

function createDefaultNoiseForce(): NoiseForce {
  return {
    id: generateId(),
    type: 'noise',
    name: 'Noise',
    weight: 1.0,
    enabled: true,
    params: {
      scale: 200,
      complexity: 1.5,
      octaves: 1,
    },
  };
}

function createDefaultCircularForce(): CircularForce {
  return {
    id: generateId(),
    type: 'circular',
    name: 'Circular',
    weight: 0,
    enabled: true,
    params: {
      centerX: 0.5,
      centerY: 0.5,
      mode: 'tangent',
      frequency: 2,
    },
  };
}

function createDefaultFormulaForce(): FormulaForce {
  return {
    id: generateId(),
    type: 'formula',
    name: 'Formula',
    weight: 0,
    enabled: true,
    params: {
      expression: 'sin(x/scale) * cos(y/scale)',
    },
  };
}

// ============================================================================
// Store Interface
// ============================================================================

interface FlowFieldState {
  // Canvas
  format: FormatType;
  customWidth: number;
  customHeight: number;
  margin: number;
  seed: number;
  strokeColor: string;

  // Lines
  lineParams: LineParams;

  // Color Palette
  colorPalette: ColorPalette;

  // Forces
  forces: Force[];

  // Zones
  zoneParams: ZoneParams;
  zones: Zone[];

  // Super Params
  superParams: SuperParams;

  // Actions - Canvas
  setFormat: (format: FormatType) => void;
  setCustomDimensions: (width: number, height: number) => void;
  setMargin: (margin: number) => void;
  setSeed: (seed: number) => void;
  randomizeSeed: () => void;
  setStrokeColor: (color: string) => void;

  // Actions - Color Palette
  setColorPalette: <K extends keyof ColorPalette>(key: K, value: ColorPalette[K]) => void;
  applyPalettePreset: (colors: string[]) => void;

  // Actions - Lines
  setLineParam: <K extends keyof LineParams>(key: K, value: LineParams[K]) => void;

  // Actions - Forces
  addForce: (type: Force['type']) => void;
  updateForce: (id: string, updates: Partial<Force>) => void;
  updateForceParams: (id: string, params: Record<string, any>) => void;
  removeForce: (id: string) => void;
  reorderForces: (fromIndex: number, toIndex: number) => void;
  toggleForce: (id: string) => void;

  // Actions - Super Params
  setSuperParam: <K extends keyof SuperParams>(key: K, value: SuperParams[K]) => void;
  resetSuperParams: () => void;

  // Actions - Zones
  setZoneParam: <K extends keyof ZoneParams>(key: K, value: ZoneParams[K]) => void;
  regenerateZones: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useFlowFieldStore = create<FlowFieldState>((set) => ({
  // Initial State - Canvas
  format: 'a4',
  customWidth: 800,
  customHeight: 600,
  margin: 40,
  seed: Math.floor(Math.random() * 10000),
  strokeColor: '#1a1a1a',

  // Initial State - Lines
  lineParams: { ...DEFAULT_LINE_PARAMS },

  // Initial State - Color Palette
  colorPalette: { ...DEFAULT_COLOR_PALETTE },

  // Initial State - Forces (start with noise enabled)
  forces: [createDefaultNoiseForce()],

  // Initial State - Zones
  zoneParams: { ...DEFAULT_ZONE_PARAMS },
  zones: [],

  // Initial State - Super Params
  superParams: { ...DEFAULT_SUPER_PARAMS },

  // ============================================================================
  // Actions - Canvas
  // ============================================================================

  setFormat: (format) => set({ format }),

  setCustomDimensions: (width, height) => set({ customWidth: width, customHeight: height }),

  setMargin: (margin) => set({ margin }),

  setSeed: (seed) => set({ seed }),

  randomizeSeed: () => set({ seed: Math.floor(Math.random() * 10000) }),

  setStrokeColor: (strokeColor) => set({ strokeColor }),

  // ============================================================================
  // Actions - Color Palette
  // ============================================================================

  setColorPalette: (key, value) =>
    set((state) => ({
      colorPalette: { ...state.colorPalette, [key]: value },
    })),

  applyPalettePreset: (colors) =>
    set((state) => ({
      colorPalette: {
        ...state.colorPalette,
        gradientColors: colors.slice(0, 2).length >= 2 ? colors.slice(0, 2) : [...colors.slice(0, 1), colors[0]],
        noiseColors: colors,
        paletteColors: colors,
      },
    })),

  // ============================================================================
  // Actions - Lines
  // ============================================================================

  setLineParam: (key, value) =>
    set((state) => ({
      lineParams: { ...state.lineParams, [key]: value },
    })),

  // ============================================================================
  // Actions - Forces
  // ============================================================================

  addForce: (type) =>
    set((state) => {
      let newForce: Force;

      switch (type) {
        case 'noise':
          newForce = createDefaultNoiseForce();
          break;
        case 'circular':
          newForce = createDefaultCircularForce();
          break;
        case 'formula':
          newForce = createDefaultFormulaForce();
          break;
        default:
          return state;
      }

      return { forces: [...state.forces, newForce] };
    }),

  updateForce: (id, updates) =>
    set((state) => ({
      forces: state.forces.map((f) =>
        f.id === id ? { ...f, ...updates } as Force : f
      ),
    })),

  updateForceParams: (id, params) =>
    set((state) => ({
      forces: state.forces.map((f) =>
        f.id === id ? { ...f, params: { ...f.params, ...params } } as Force : f
      ),
    })),

  removeForce: (id) =>
    set((state) => ({
      forces: state.forces.filter((f) => f.id !== id),
    })),

  reorderForces: (fromIndex, toIndex) =>
    set((state) => {
      const newForces = [...state.forces];
      const [removed] = newForces.splice(fromIndex, 1);
      newForces.splice(toIndex, 0, removed);
      return { forces: newForces };
    }),

  toggleForce: (id) =>
    set((state) => ({
      forces: state.forces.map((f) =>
        f.id === id ? { ...f, enabled: !f.enabled } : f
      ),
    })),

  // ============================================================================
  // Actions - Super Params
  // ============================================================================

  setSuperParam: (key, value) =>
    set((state) => ({
      superParams: { ...state.superParams, [key]: value },
    })),

  resetSuperParams: () =>
    set({ superParams: { ...DEFAULT_SUPER_PARAMS } }),

  // ============================================================================
  // Actions - Zones
  // ============================================================================

  setZoneParam: (key, value) =>
    set((state) => {
      const newParams = { ...state.zoneParams, [key]: value };

      // Auto-regenerate zones when params change
      if (newParams.enabled && (key === 'count' || key === 'placement' || key === 'transitionWidth')) {
        const rng = createRng(state.seed);
        const zones = generateZones(newParams, state.forces, rng);
        return { zoneParams: newParams, zones };
      }

      return { zoneParams: newParams };
    }),

  regenerateZones: () =>
    set((state) => {
      if (!state.zoneParams.enabled) {
        return { zones: [] };
      }

      const rng = createRng(state.seed);
      const zones = generateZones(state.zoneParams, state.forces, rng);
      return { zones };
    }),
}));
