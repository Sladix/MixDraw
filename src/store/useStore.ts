import { create } from 'zustand';
import type {
  Project,
  Layer,
  FlowPath,
  StandaloneGenerator,
  BackgroundImage,
  Selection,
  ToolType,
  GeneratorConfig,
} from '../types';
import { GeneratorRegistry } from '../core/GeneratorRegistry';
import type { FormatType } from '../types/formats';
import {
  type HistoryState,
  createHistoryState,
  pushHistory,
  undo as historyUndo,
  redo as historyRedo,
  canUndo,
  canRedo,
  cloneProject,
} from './history';

interface AppState {
  // Project state
  project: Project;
  history: HistoryState;

  // UI state
  currentTool: ToolType['type'];
  selection: Selection;
  selectedGeneratorType: string | null;
  clipboard: { type: string; data: any } | null;

  // View state
  zoom: number;
  pan: { x: number; y: number };
  paperFormat: FormatType;
  paperOrientation: 'portrait' | 'landscape';
  globalSeed: number;

  // Grid state
  gridVisible: boolean;
  gridSnapEnabled: boolean;
  gridSize: number; // Grid size in mm

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
  addGeneratorToFlowPath: (flowPathId: string, generatorType: string) => void;
  removeGeneratorFromFlowPath: (flowPathId: string, generatorId: string) => void;

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
  selectObject: (id: string, type: Selection['type'], addToSelection?: boolean) => void;
  selectMultiple: (ids: string[], type: Selection['type']) => void;
  deselectAll: () => void;
  setSelectedGeneratorType: (type: string | null) => void;

  // Actions - Bezier Editing
  enableBezierEditing: (flowPathId: string) => void;
  disableBezierEditing: () => void;
  selectBezierPoint: (pointIndex: number) => void;
  deselectBezierPoint: () => void;
  moveBezierPoint: (flowPathId: string, pointIndex: number, newX: number, newY: number) => void;
  moveBezierHandle: (flowPathId: string, pointIndex: number, handleType: 'in' | 'out', newX: number, newY: number) => void;
  deleteBezierPoint: (flowPathId: string, pointIndex: number) => void;
  insertBezierPoint: (flowPathId: string, insertAfterIndex: number, newX: number, newY: number) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setPaperFormat: (format: FormatType) => void;
  setPaperOrientation: (orientation: 'portrait' | 'landscape') => void;
  setGlobalSeed: (seed: number) => void;
  regenerateSeed: () => void;

  // Actions - Grid
  setGridVisible: (visible: boolean) => void;
  setGridSnapEnabled: (enabled: boolean) => void;
  setGridSize: (size: number) => void;

  // Actions - History
  undo: () => void;
  redo: () => void;
  pushToHistory: () => void;

  // Actions - Clipboard
  copySelected: () => void;
  pasteClipboard: (position?: { x: number; y: number }) => void;
  copyFlowPathConfig: (flowPathId: string) => void;
  pasteFlowPathConfig: (flowPathId: string) => void;
  deleteSelected: () => void;

  // Actions - Transform
  moveSelected: (dx: number, dy: number) => void;
  rotateSelected: (angle: number, pivot: { x: number; y: number }) => void;
  scaleSelected: (factor: number, pivot: { x: number; y: number }) => void;
  mirrorSelected: (axis: 'horizontal' | 'vertical') => void;
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
        strokeWidth: 0.3, // Default 0.3mm line width for plotter
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

  history: createHistoryState(),
  currentTool: 'select',
  selection: { type: 'none', id: null, ids: [], transformMode: null },
  selectedGeneratorType: null,
  clipboard: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  paperFormat: 'A4',
  paperOrientation: 'portrait',
  globalSeed: Math.floor(Math.random() * 10000),
  gridVisible: true,
  gridSnapEnabled: false,
  gridSize: 10, // 10mm default grid

  // Project actions
  setBackgroundImage: (image) =>
    set((state) => ({
      project: { ...state.project, backgroundImage: image },
    })),

  loadProject: (project) => set({
    project: {
      ...project,
      layers: project.layers.map((layer) => ({
        ...layer,
        // Add default strokeWidth for backward compatibility
        strokeWidth: layer.strokeWidth ?? 0.3,
      })),
    },
  }),

  // Layer actions
  addLayer: () =>
    set((state) => {
      const newLayer: Layer = {
        id: `layer-${generateId()}`,
        name: `Layer ${state.project.layers.length + 1}`,
        color: '#000000',
        strokeWidth: 0.3, // Default 0.3mm line width for plotter
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
        // Ensure defaults for new modifier system fields
        modifiers: flowPath.modifiers || [],
        distributionParams: {
          ...flowPath.distributionParams,
          densityMode: flowPath.distributionParams.densityMode || 'visual',
          packingMode: flowPath.distributionParams.packingMode || 'normal', // Default to normal packing (10% tolerance)
        },
        flowParams: {
          ...flowPath.flowParams,
          // NEW tube filling defaults
          spread: flowPath.flowParams.spread ?? 10, // Default 10mm tube width
          fillMode: flowPath.flowParams.fillMode || 'grid', // Default to grid mode
        },
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

  addGeneratorToFlowPath: (flowPathId, generatorType) =>
    set((state) => {
      const newGenerator: GeneratorConfig = {
        id: `gen-${generateId()}`,
        type: generatorType,
        weight: 1,
        params: GeneratorRegistry.getDefaultParams(generatorType),
        followNormal: false,
      };

      return {
        project: {
          ...state.project,
          layers: state.project.layers.map((l) => ({
            ...l,
            flowPaths: l.flowPaths.map((fp) =>
              fp.id === flowPathId
                ? { ...fp, generators: [...fp.generators, newGenerator] }
                : fp
            ),
          })),
        },
      };
    }),

  removeGeneratorFromFlowPath: (flowPathId, generatorId) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) => ({
          ...l,
          flowPaths: l.flowPaths.map((fp) =>
            fp.id === flowPathId
              ? { ...fp, generators: fp.generators.filter((g) => g.id !== generatorId) }
              : fp
          ),
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

  selectObject: (id, type, addToSelection = false) =>
    set((state) => {
      if (addToSelection && state.selection.type === type) {
        // Add to existing selection
        const ids = state.selection.ids.includes(id)
          ? state.selection.ids.filter((existingId) => existingId !== id) // Toggle off
          : [...state.selection.ids, id]; // Add

        return {
          selection: {
            ...state.selection,
            id: ids[ids.length - 1] || null,
            ids,
          },
        };
      } else {
        // New single selection
        return {
          selection: {
            type,
            id,
            ids: [id],
            transformMode: null,
          },
        };
      }
    }),

  selectMultiple: (ids, type) =>
    set({
      selection: {
        type,
        id: ids[0] || null,
        ids,
        transformMode: null,
      },
    }),

  deselectAll: () =>
    set({
      selection: {
        type: 'none',
        id: null,
        ids: [],
        transformMode: null,
      },
    }),

  setSelectedGeneratorType: (type) => set({ selectedGeneratorType: type }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  setPaperFormat: (format) => set({ paperFormat: format }),
  setPaperOrientation: (orientation) => set({ paperOrientation: orientation }),
  setGlobalSeed: (seed) => set({ globalSeed: seed }),
  regenerateSeed: () => set({ globalSeed: Math.floor(Math.random() * 10000) }),

  // Grid actions
  setGridVisible: (visible) => set({ gridVisible: visible }),
  setGridSnapEnabled: (enabled) => set({ gridSnapEnabled: enabled }),
  setGridSize: (size) => set({ gridSize: Math.max(1, Math.min(50, size)) }), // Clamp between 1-50mm

  // History actions
  pushToHistory: () =>
    set((state) => ({
      history: pushHistory(state.history, cloneProject(state.project)),
    })),

  undo: () =>
    set((state) => {
      const result = historyUndo(state.history, state.project);
      if (result.project) {
        return {
          history: result.history,
          project: result.project,
        };
      }
      return {};
    }),

  redo: () =>
    set((state) => {
      const result = historyRedo(state.history, state.project);
      if (result.project) {
        return {
          history: result.history,
          project: result.project,
        };
      }
      return {};
    }),

  // Clipboard actions
  copySelected: () =>
    set((state) => {
      const { selection, project } = state;
      if (selection.ids.length === 0) return {};

      // Find selected objects
      const selectedObjects: any[] = [];
      for (const layer of project.layers) {
        if (selection.type === 'flowPath') {
          selectedObjects.push(...layer.flowPaths.filter((fp) => selection.ids.includes(fp.id)));
        } else if (selection.type === 'standaloneGenerator') {
          selectedObjects.push(
            ...layer.standaloneGenerators.filter((sg) => selection.ids.includes(sg.id))
          );
        }
      }

      return {
        clipboard: {
          type: selection.type,
          data: selectedObjects,
        },
      };
    }),

  pasteClipboard: (position) =>
    set((state) => {
      if (!state.clipboard) return {};

      const { type, data } = state.clipboard;
      const activeLayer = state.project.layers.find((l) => !l.locked) || state.project.layers[0];

      if (!activeLayer) return {};

      // Push to history before pasting
      const newHistory = pushHistory(state.history, cloneProject(state.project));

      if (type === 'flowPath') {
        const newFlowPaths = data.map((fp: FlowPath) => ({
          ...fp,
          id: `flowpath-${generateId()}`,
          layerId: activeLayer.id,
        }));

        return {
          history: newHistory,
          project: {
            ...state.project,
            layers: state.project.layers.map((l) =>
              l.id === activeLayer.id
                ? { ...l, flowPaths: [...l.flowPaths, ...newFlowPaths] }
                : l
            ),
          },
        };
      } else if (type === 'standaloneGenerator') {
        const newGenerators = data.map((sg: StandaloneGenerator, index: number) => ({
          ...sg,
          id: `standalone-${generateId()}`,
          layerId: activeLayer.id,
          // Offset position if provided
          position: position
            ? {
                x: position.x + index * 0.01,
                y: position.y + index * 0.01,
              }
            : {
                x: sg.position.x + 0.05,
                y: sg.position.y + 0.05,
              },
        }));

        return {
          history: newHistory,
          project: {
            ...state.project,
            layers: state.project.layers.map((l) =>
              l.id === activeLayer.id
                ? {
                    ...l,
                    standaloneGenerators: [...l.standaloneGenerators, ...newGenerators],
                  }
                : l
            ),
          },
        };
      }

      return {};
    }),

  copyFlowPathConfig: (flowPathId) =>
    set((state) => {
      // Find the flowPath
      let flowPath: FlowPath | null = null;
      for (const layer of state.project.layers) {
        const fp = layer.flowPaths.find((f) => f.id === flowPathId);
        if (fp) {
          flowPath = fp;
          break;
        }
      }

      if (!flowPath) return {};

      // Copy only configuration (exclude id, layerId, bezierCurve, closed)
      const config = {
        distributionParams: { ...flowPath.distributionParams },
        flowParams: { ...flowPath.flowParams },
        generators: flowPath.generators.map((g) => ({
          ...g,
          id: `gen-${generateId()}`, // Generate new IDs for generators
        })),
        modifiers: flowPath.modifiers ? [...flowPath.modifiers.map((m) => ({
          ...m,
          id: `mod-${generateId()}`, // Generate new IDs for modifiers
        }))] : [],
        timelines: flowPath.timelines ? [...flowPath.timelines.map((tl) => ({
          ...tl,
          id: `timeline-${generateId()}`, // Generate new IDs for timelines
          keyframes: tl.keyframes.map((kf) => ({
            ...kf,
            id: `keyframe-${generateId()}`, // Generate new IDs for keyframes
          })),
        }))] : [],
      };

      return {
        clipboard: {
          type: 'flowPathConfig',
          data: config,
        },
      };
    }),

  pasteFlowPathConfig: (flowPathId) =>
    set((state) => {
      if (!state.clipboard || state.clipboard.type !== 'flowPathConfig') return {};

      const config = state.clipboard.data;

      // Push to history before pasting
      const newHistory = pushHistory(state.history, cloneProject(state.project));

      // Apply configuration to target flowPath
      return {
        history: newHistory,
        project: {
          ...state.project,
          layers: state.project.layers.map((l) => ({
            ...l,
            flowPaths: l.flowPaths.map((fp) =>
              fp.id === flowPathId
                ? {
                    ...fp,
                    distributionParams: { ...config.distributionParams },
                    flowParams: { ...config.flowParams },
                    generators: config.generators.map((g: any) => ({
                      ...g,
                      id: `gen-${generateId()}`, // New IDs for this paste
                    })),
                    modifiers: config.modifiers ? config.modifiers.map((m: any) => ({
                      ...m,
                      id: `mod-${generateId()}`, // New IDs for this paste
                    })) : [],
                    timelines: config.timelines ? config.timelines.map((tl: any) => ({
                      ...tl,
                      id: `timeline-${generateId()}`, // New IDs for this paste
                      keyframes: tl.keyframes.map((kf: any) => ({
                        ...kf,
                        id: `keyframe-${generateId()}`, // New IDs for this paste
                      })),
                    })) : [],
                  }
                : fp
            ),
          })),
        },
      };
    }),

  deleteSelected: () =>
    set((state) => {
      const { selection } = state;
      if (selection.ids.length === 0) return {};

      // Push to history before deleting
      const newHistory = pushHistory(state.history, cloneProject(state.project));

      let newLayers = state.project.layers;

      if (selection.type === 'flowPath') {
        newLayers = newLayers.map((l) => ({
          ...l,
          flowPaths: l.flowPaths.filter((fp) => !selection.ids.includes(fp.id)),
        }));
      } else if (selection.type === 'standaloneGenerator') {
        newLayers = newLayers.map((l) => ({
          ...l,
          standaloneGenerators: l.standaloneGenerators.filter(
            (sg) => !selection.ids.includes(sg.id)
          ),
        }));
      }

      return {
        history: newHistory,
        project: {
          ...state.project,
          layers: newLayers,
        },
        selection: {
          type: 'none',
          id: null,
          ids: [],
          transformMode: null,
        },
      };
    }),

  // Transform actions
  moveSelected: (dx, dy) =>
    set((state) => {
      const { selection } = state;
      if (selection.ids.length === 0) return {};

      if (selection.type === 'standaloneGenerator') {
        return {
          project: {
            ...state.project,
            layers: state.project.layers.map((l) => ({
              ...l,
              standaloneGenerators: l.standaloneGenerators.map((sg) =>
                selection.ids.includes(sg.id)
                  ? {
                      ...sg,
                      position: {
                        x: sg.position.x + dx,
                        y: sg.position.y + dy,
                      },
                    }
                  : sg
              ),
            })),
          },
        };
      } else if (selection.type === 'flowPath') {
        return {
          project: {
            ...state.project,
            layers: state.project.layers.map((l) => ({
              ...l,
              flowPaths: l.flowPaths.map((fp) =>
                selection.ids.includes(fp.id)
                  ? {
                      ...fp,
                      bezierCurve: {
                        ...fp.bezierCurve,
                        segments: fp.bezierCurve.segments.map((seg: any) => ({
                          ...seg,
                          point: {
                            x: seg.point.x + dx,
                            y: seg.point.y + dy,
                          },
                        })),
                      },
                    }
                  : fp
              ),
            })),
          },
        };
      }

      return {};
    }),

  rotateSelected: (angle, pivot) =>
    set((state) => {
      const { selection } = state;
      if (selection.ids.length === 0 || selection.type !== 'standaloneGenerator') return {};

      return {
        project: {
          ...state.project,
          layers: state.project.layers.map((l) => ({
            ...l,
            standaloneGenerators: l.standaloneGenerators.map((sg) =>
              selection.ids.includes(sg.id)
                ? {
                    ...sg,
                    rotation: sg.rotation + angle,
                  }
                : sg
            ),
          })),
        },
      };
    }),

  scaleSelected: (factor, pivot) =>
    set((state) => {
      const { selection } = state;
      if (selection.ids.length === 0 || selection.type !== 'standaloneGenerator') return {};

      return {
        project: {
          ...state.project,
          layers: state.project.layers.map((l) => ({
            ...l,
            standaloneGenerators: l.standaloneGenerators.map((sg) =>
              selection.ids.includes(sg.id)
                ? {
                    ...sg,
                    scale: sg.scale * factor,
                  }
                : sg
            ),
          })),
        },
      };
    }),

  mirrorSelected: (axis) =>
    set((state) => {
      const { selection } = state;
      if (selection.ids.length === 0 || selection.type !== 'standaloneGenerator') return {};

      // Push to history before mirroring
      const newHistory = pushHistory(state.history, cloneProject(state.project));

      return {
        history: newHistory,
        project: {
          ...state.project,
          layers: state.project.layers.map((l) => ({
            ...l,
            standaloneGenerators: l.standaloneGenerators.map((sg) =>
              selection.ids.includes(sg.id)
                ? {
                    ...sg,
                    scale: axis === 'horizontal' ? -sg.scale : sg.scale,
                    rotation: axis === 'vertical' ? 180 - sg.rotation : sg.rotation,
                  }
                : sg
            ),
          })),
        },
      };
    }),

  // Bezier editing actions
  enableBezierEditing: (flowPathId) =>
    set((state) => ({
      selection: {
        ...state.selection,
        type: 'flowPath',
        id: flowPathId,
        ids: [flowPathId],
        editingBezier: true,
        selectedPointIndex: null,
        selectedHandleType: null,
      },
    })),

  disableBezierEditing: () =>
    set((state) => ({
      selection: {
        ...state.selection,
        editingBezier: false,
        selectedPointIndex: null,
        selectedHandleType: null,
      },
    })),

  selectBezierPoint: (pointIndex) =>
    set((state) => ({
      selection: {
        ...state.selection,
        selectedPointIndex: pointIndex,
        selectedHandleType: null,
      },
    })),

  deselectBezierPoint: () =>
    set((state) => ({
      selection: {
        ...state.selection,
        selectedPointIndex: null,
        selectedHandleType: null,
      },
    })),

  moveBezierPoint: (flowPathId, pointIndex, newX, newY) =>
    set((state) => {
      return {
        project: {
          ...state.project,
          layers: state.project.layers.map((l) => ({
            ...l,
            flowPaths: l.flowPaths.map((fp) => {
              if (fp.id !== flowPathId) return fp;

              const newSegments = (fp.bezierCurve.segments as any[]).map((seg: any, idx: number) => {
                if (idx !== pointIndex) return seg;
                return {
                  ...seg,
                  point: { x: newX, y: newY },
                };
              });

              return {
                ...fp,
                bezierCurve: {
                  ...(fp.bezierCurve as any),
                  segments: newSegments,
                } as any,
              };
            }),
          })),
        },
      };
    }),

  moveBezierHandle: (flowPathId, pointIndex, handleType, newX, newY) =>
    set((state) => {
      return {
        project: {
          ...state.project,
          layers: state.project.layers.map((l) => ({
            ...l,
            flowPaths: l.flowPaths.map((fp) => {
              if (fp.id !== flowPathId) return fp;

              const newSegments = (fp.bezierCurve.segments as any[]).map((seg: any, idx: number) => {
                if (idx !== pointIndex) return seg;

                const handleKey = handleType === 'in' ? 'handleIn' : 'handleOut';
                return {
                  ...seg,
                  [handleKey]: { x: newX, y: newY },
                };
              });

              return {
                ...fp,
                bezierCurve: {
                  ...(fp.bezierCurve as any),
                  segments: newSegments,
                } as any,
              };
            }),
          })),
        },
      };
    }),

  deleteBezierPoint: (flowPathId, pointIndex) =>
    set((state) => {
      // Push to history before deleting
      const newHistory = pushHistory(state.history, cloneProject(state.project));

      return {
        history: newHistory,
        project: {
          ...state.project,
          layers: state.project.layers.map((l) => ({
            ...l,
            flowPaths: l.flowPaths.map((fp) => {
              if (fp.id !== flowPathId) return fp;

              // Don't allow deleting if only 2 points remain
              const segments = fp.bezierCurve.segments as any[];
              if (segments.length <= 2) return fp;

              const newSegments = segments.filter(
                (_: any, idx: number) => idx !== pointIndex
              );

              return {
                ...fp,
                bezierCurve: {
                  ...(fp.bezierCurve as any),
                  segments: newSegments,
                } as any,
              };
            }),
          })),
        },
        selection: {
          ...state.selection,
          selectedPointIndex: null,
        },
      };
    }),

  insertBezierPoint: (flowPathId, insertAfterIndex, newX, newY) =>
    set((state) => {
      // Push to history before inserting
      const newHistory = pushHistory(state.history, cloneProject(state.project));

      return {
        history: newHistory,
        project: {
          ...state.project,
          layers: state.project.layers.map((l) => ({
            ...l,
            flowPaths: l.flowPaths.map((fp) => {
              if (fp.id !== flowPathId) return fp;

              const newSegments = [...(fp.bezierCurve.segments as any[])];
              newSegments.splice(insertAfterIndex + 1, 0, {
                point: { x: newX, y: newY },
                handleIn: null,
                handleOut: null,
              });

              return {
                ...fp,
                bezierCurve: {
                  ...(fp.bezierCurve as any),
                  segments: newSegments,
                } as any,
              };
            }),
          })),
        },
      };
    }),
}));
