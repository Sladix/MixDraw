import { create } from 'zustand';
import type {
  Project,
  Layer,
  FlowPath,
  StandaloneGenerator,
  BackgroundImage,
  Selection,
  ToolType,
} from '../types';
import type { FormatType } from '../types/formats';

interface AppState {
  // Project state
  project: Project;

  // UI state
  currentTool: ToolType['type'];
  selection: Selection;
  selectedGeneratorType: string | null;

  // View state
  zoom: number;
  pan: { x: number; y: number };
  paperFormat: FormatType;
  paperOrientation: 'portrait' | 'landscape';
  globalSeed: number;

  // Actions - Project
  setBackgroundImage: (image: BackgroundImage) => void;
  loadProject: (project: Project) => void;

  // Actions - Layers
  addLayer: () => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, updates: Partial<Layer>) => void;
  reorderLayers: (startIndex: number, endIndex: number) => void;

  // Actions - FlowPaths
  addFlowPath: (layerId: string, flowPath: Omit<FlowPath, 'id' | 'layerId'>) => void;
  updateFlowPath: (flowPathId: string, updates: Partial<FlowPath>) => void;
  removeFlowPath: (flowPathId: string) => void;

  // Actions - Standalone Generators
  addStandaloneGenerator: (
    layerId: string,
    generator: Omit<StandaloneGenerator, 'id' | 'layerId'>
  ) => void;
  updateStandaloneGenerator: (
    generatorId: string,
    updates: Partial<StandaloneGenerator>
  ) => void;
  removeStandaloneGenerator: (generatorId: string) => void;

  // Actions - UI
  setTool: (tool: ToolType['type']) => void;
  setSelection: (selection: Selection) => void;
  setSelectedGeneratorType: (type: string | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setPaperFormat: (format: FormatType) => void;
  setPaperOrientation: (orientation: 'portrait' | 'landscape') => void;
  setGlobalSeed: (seed: number) => void;
  regenerateSeed: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  project: {
    version: '1.0',
    backgroundImage: null,
    layers: [
      {
        id: 'layer-1',
        name: 'Layer 1',
        color: '#000000',
        visible: true,
        locked: false,
        order: 0,
        brushEffect: {
          enabled: false,
          fadeStart: 0.7,
          fadeEnd: 1.0,
        },
        flowPaths: [],
        standaloneGenerators: [],
      },
    ],
    detectedShapes: [],
  },

  currentTool: 'select',
  selection: { type: 'none', id: null },
  selectedGeneratorType: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  paperFormat: 'A3',
  paperOrientation: 'portrait',
  globalSeed: Math.floor(Math.random() * 10000),

  // Project actions
  setBackgroundImage: (image) =>
    set((state) => ({
      project: { ...state.project, backgroundImage: image },
    })),

  loadProject: (project) => set({ project }),

  // Layer actions
  addLayer: () =>
    set((state) => {
      const newLayer: Layer = {
        id: `layer-${generateId()}`,
        name: `Layer ${state.project.layers.length + 1}`,
        color: '#000000',
        visible: true,
        locked: false,
        order: state.project.layers.length,
        brushEffect: {
          enabled: false,
          fadeStart: 0.7,
          fadeEnd: 1.0,
        },
        flowPaths: [],
        standaloneGenerators: [],
      };
      return {
        project: {
          ...state.project,
          layers: [...state.project.layers, newLayer],
        },
      };
    }),

  removeLayer: (layerId) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers
          .filter((l) => l.id !== layerId)
          .map((l, idx) => ({ ...l, order: idx })),
      },
    })),

  updateLayer: (layerId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) =>
          l.id === layerId ? { ...l, ...updates } : l
        ),
      },
    })),

  reorderLayers: (startIndex, endIndex) =>
    set((state) => {
      const layers = [...state.project.layers];
      const [removed] = layers.splice(startIndex, 1);
      layers.splice(endIndex, 0, removed);
      return {
        project: {
          ...state.project,
          layers: layers.map((l, idx) => ({ ...l, order: idx })),
        },
      };
    }),

  // FlowPath actions
  addFlowPath: (layerId, flowPath) =>
    set((state) => {
      const newFlowPath: FlowPath = {
        id: `flowpath-${generateId()}`,
        layerId,
        ...flowPath,
      };
      return {
        project: {
          ...state.project,
          layers: state.project.layers.map((l) =>
            l.id === layerId
              ? { ...l, flowPaths: [...l.flowPaths, newFlowPath] }
              : l
          ),
        },
      };
    }),

  updateFlowPath: (flowPathId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) => ({
          ...l,
          flowPaths: l.flowPaths.map((fp) =>
            fp.id === flowPathId ? { ...fp, ...updates } : fp
          ),
        })),
      },
    })),

  removeFlowPath: (flowPathId) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) => ({
          ...l,
          flowPaths: l.flowPaths.filter((fp) => fp.id !== flowPathId),
        })),
      },
    })),

  // Standalone Generator actions
  addStandaloneGenerator: (layerId, generator) =>
    set((state) => {
      const newGenerator: StandaloneGenerator = {
        id: `standalone-${generateId()}`,
        layerId,
        ...generator,
      };
      return {
        project: {
          ...state.project,
          layers: state.project.layers.map((l) =>
            l.id === layerId
              ? {
                  ...l,
                  standaloneGenerators: [
                    ...l.standaloneGenerators,
                    newGenerator,
                  ],
                }
              : l
          ),
        },
      };
    }),

  updateStandaloneGenerator: (generatorId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) => ({
          ...l,
          standaloneGenerators: l.standaloneGenerators.map((g) =>
            g.id === generatorId ? { ...g, ...updates } : g
          ),
        })),
      },
    })),

  removeStandaloneGenerator: (generatorId) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) => ({
          ...l,
          standaloneGenerators: l.standaloneGenerators.filter(
            (g) => g.id !== generatorId
          ),
        })),
      },
    })),

  // UI actions
  setTool: (tool) => set({ currentTool: tool }),
  setSelection: (selection) => set({ selection }),
  setSelectedGeneratorType: (type) => set({ selectedGeneratorType: type }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  setPaperFormat: (format) => set({ paperFormat: format }),
  setPaperOrientation: (orientation) => set({ paperOrientation: orientation }),
  setGlobalSeed: (seed) => set({ globalSeed: seed }),
  regenerateSeed: () => set({ globalSeed: Math.floor(Math.random() * 10000) }),
}));
