import { useEffect, useRef, useState, useCallback } from 'react';
import paper from 'paper';
import { useStore } from '../store/useStore';
import { regenerateFlowPath, generateStandaloneInstance } from '../core/flowPathEngine';
import { GeneratorRegistry } from '../core/GeneratorRegistry';
import { PAPER_FORMATS, getEffectiveDimensions } from '../types/formats';
import { absoluteToNormalized, normalizedToAbsolute } from '../utils/coordinates';
import { hitTestObjects } from '../utils/hitTest';
import { SelectionOverlay } from './SelectionOverlay';

export function CanvasWorking() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<paper.Project | null>(null);
  const backgroundLayerRef = useRef<paper.Layer | null>(null);
  const contentLayerRef = useRef<paper.Layer | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [tempPath, setTempPath] = useState<paper.Path | null>(null);
  const [pathPoints, setPathPoints] = useState<paper.Point[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Selection and drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const project = useStore((state) => state.project);
  const zoom = useStore((state) => state.zoom);
  const currentTool = useStore((state) => state.currentTool);
  const paperFormat = useStore((state) => state.paperFormat);
  const paperOrientation = useStore((state) => state.paperOrientation);
  const addFlowPath = useStore((state) => state.addFlowPath);
  const addStandaloneGenerator = useStore((state) => state.addStandaloneGenerator);
  const selectedGeneratorType = useStore((state) => state.selectedGeneratorType);
  const globalSeed = useStore((state) => state.globalSeed);
  const selectObject = useStore((state) => state.selectObject);
  const deselectAll = useStore((state) => state.deselectAll);
  const selection = useStore((state) => state.selection);
  const moveSelected = useStore((state) => state.moveSelected);
  const pushToHistory = useStore((state) => state.pushToHistory);

  // Helper: Calculate scale factor for content rendering
  const getScaleFactor = useCallback(() => {
    const format = PAPER_FORMATS[paperFormat];
    const dims = getEffectiveDimensions(format, paperOrientation);
    return Math.min(canvasSize.width / dims.widthPx, canvasSize.height / dims.heightPx);
  }, [canvasSize, paperFormat, paperOrientation]);

  // Helper: Convert screen coordinates to virtual canvas coordinates
  const screenToVirtual = useCallback((screenX: number, screenY: number) => {
    const format = PAPER_FORMATS[paperFormat];
    const dims = getEffectiveDimensions(format, paperOrientation);
    const scale = getScaleFactor();

    const groupCenterX = canvasSize.width / 2;
    const groupCenterY = canvasSize.height / 2;

    const relativeX = screenX - groupCenterX;
    const relativeY = screenY - groupCenterY;

    const unscaledX = relativeX / scale;
    const unscaledY = relativeY / scale;

    const virtualX = unscaledX + dims.widthPx / 2;
    const virtualY = unscaledY + dims.heightPx / 2;

    return new paper.Point(virtualX, virtualY);
  }, [canvasSize, paperFormat, paperOrientation, getScaleFactor]);

  // Calculate canvas size
  const calculateCanvasSize = useCallback(() => {
    if (!containerRef.current) return { width: 800, height: 600 };

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const format = PAPER_FORMATS[paperFormat];
    const dims = getEffectiveDimensions(format, paperOrientation);
    const aspectRatio = dims.widthPx / dims.heightPx;

    let width, height;
    if (containerWidth / containerHeight > aspectRatio) {
      height = containerHeight - 40;
      width = height * aspectRatio;
    } else {
      width = containerWidth - 40;
      height = width / aspectRatio;
    }

    return { width, height };
  }, [paperFormat, paperOrientation]);

  // Setup Paper.js
  useEffect(() => {
    if (!canvasRef.current || isInitialized) return;

    const { width, height } = calculateCanvasSize();
    canvasRef.current.width = width;
    canvasRef.current.height = height;
    setCanvasSize({ width, height });

    // Create Paper.js project
    projectRef.current = new paper.Project(canvasRef.current);

    // Create layers
    backgroundLayerRef.current = new paper.Layer();
    backgroundLayerRef.current.name = 'background';
    contentLayerRef.current = new paper.Layer();
    contentLayerRef.current.name = 'content';
    contentLayerRef.current.activate();

    setIsInitialized(true);
  }, [calculateCanvasSize, isInitialized, paperFormat]);

  // Handle resize
  useEffect(() => {
    if (!isInitialized || !canvasRef.current || !projectRef.current) return;

    const handleResize = () => {
      const { width, height } = calculateCanvasSize();
      if (canvasRef.current && projectRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        projectRef.current.view.viewSize = new paper.Size(width, height);
        setCanvasSize({ width, height });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isInitialized, calculateCanvasSize, paperFormat, paperOrientation]);

  // Handle orientation change
  useEffect(() => {
    if (!canvasRef.current || !projectRef.current || !isInitialized) return;

    const { width, height } = calculateCanvasSize();
    canvasRef.current.width = width;
    canvasRef.current.height = height;
    projectRef.current.view.viewSize = new paper.Size(width, height);
    setCanvasSize({ width, height });
  }, [paperOrientation, isInitialized, calculateCanvasSize]);

  // Render background
  useEffect(() => {
    if (!projectRef.current || !isInitialized || !backgroundLayerRef.current) return;

    // Safety check: ensure project and view are still valid
    const paperProject = projectRef.current;
    if (!paperProject.view || !paperProject.view.element) return;

    const bgLayer = backgroundLayerRef.current;
    bgLayer.removeChildren();

    if (project.backgroundImage) {
      bgLayer.activate();
      const raster = new paper.Raster({
        source: project.backgroundImage.dataUrl,
        position: paperProject.view.center,
      });
      raster.opacity = 0.5;
      raster.fitBounds(paperProject.view.bounds);
    }

    // Reactivate content layer
    if (contentLayerRef.current) {
      contentLayerRef.current.activate();
    }
  }, [project.backgroundImage, isInitialized, paperOrientation, canvasSize]);

  // Render content
  useEffect(() => {
    if (!projectRef.current || !isInitialized) return;

    const paperProject = projectRef.current;
    if (!paperProject.view || !paperProject.view.element) return;

    const contentLayer = contentLayerRef.current;
    if (!contentLayer) return;

    paperProject.activate();
    contentLayer.activate();
    contentLayer.removeChildren();

    const format = PAPER_FORMATS[paperFormat];
    const dims = getEffectiveDimensions(format, paperOrientation);
    const virtualWidth = dims.widthPx;
    const virtualHeight = dims.heightPx;
    const scale = getScaleFactor();

    // Create a parent group that will contain all content and be scaled
    const scaledContentGroup = new paper.Group();

    // Add invisible rectangle that defines the full virtual canvas bounds
    // This ensures proper scaling and centering based on canvas dimensions, not just visible content
    const canvasBoundsRect = new paper.Path.Rectangle({
      point: [0, 0],
      size: [virtualWidth, virtualHeight],
      strokeColor: null,
      fillColor: null,
    });
    scaledContentGroup.addChild(canvasBoundsRect);

    let totalShapes = 0;

    // Draw all layers
    const visibleLayers = project.layers.filter((layer) => layer.visible);

    visibleLayers
      .sort((a, b) => a.order - b.order)
      .forEach((layer) => {
        try {
          paperProject.activate();
          const layerGroup = new paper.Group();

          // Draw FlowPaths
          layer.flowPaths.forEach((flowPath) => {
            try {
              // Reconstruct Paper.js Path from stored data
              // Convert from normalized (0-1) coordinates to absolute pixel coordinates
              const reconstructedPath = new paper.Path();
              const format = PAPER_FORMATS[paperFormat];

              // Check if bezierCurve has segments (it should)
              if (flowPath.bezierCurve.segments && Array.isArray(flowPath.bezierCurve.segments)) {
                flowPath.bezierCurve.segments.forEach((seg: any) => {
                  if (seg.point) {
                    // Convert normalized point coordinates to absolute
                    const absolutePoint = normalizedToAbsolute(
                      { x: seg.point.x, y: seg.point.y },
                      paperFormat,
                      paperOrientation
                    );
                    const point = new paper.Point(absolutePoint.x, absolutePoint.y);

                    // Handles are RELATIVE vectors - scale them back proportionally
                    let handleIn = undefined;
                    let handleOut = undefined;

                    if (seg.handleIn) {
                      handleIn = new paper.Point(
                        seg.handleIn.x * dims.widthPx,
                        seg.handleIn.y * dims.heightPx
                      );
                    }

                    if (seg.handleOut) {
                      handleOut = new paper.Point(
                        seg.handleOut.x * dims.widthPx,
                        seg.handleOut.y * dims.heightPx
                      );
                    }

                    reconstructedPath.add(new paper.Segment(point, handleIn, handleOut));
                  } else if (Array.isArray(seg) && seg.length >= 2) {
                    // Fallback for old format
                    const absolutePoint = normalizedToAbsolute(
                      { x: seg[0], y: seg[1] },
                      paperFormat,
                      paperOrientation
                    );
                    reconstructedPath.add(new paper.Point(absolutePoint.x, absolutePoint.y));
                  }
                });

                // Apply closed property
                if (flowPath.closed) {
                  reconstructedPath.closed = true;
                }

                // Only smooth if there are no handles (old data or simple paths)
                // If handles exist, the path is already smoothed
                const hasHandles = flowPath.bezierCurve.segments.some(
                  (seg: any) => seg.handleIn || seg.handleOut
                );
                if (!hasHandles) {
                  reconstructedPath.smooth({ type: 'continuous' });
                }

              } else {
                return;
              }

              // Draw the curve
              const curveCopy = reconstructedPath.clone();
              curveCopy.strokeColor = new paper.Color(layer.color);
              curveCopy.strokeWidth = 2;
              curveCopy.opacity = 0.3;
              curveCopy.dashArray = [10, 4];
              layerGroup.addChild(curveCopy);

              // Generate shapes
              if (flowPath.generators.length > 0) {
                const tempFlowPath = {
                  ...flowPath,
                  bezierCurve: reconstructedPath,
                  distributionParams: {
                    ...flowPath.distributionParams,
                    seed: flowPath.distributionParams.seed + globalSeed,
                  },
                };

                const instances = regenerateFlowPath(tempFlowPath);
                totalShapes += instances.length;

                instances.forEach((instance) => {
                  instance.shape.paths.forEach((path) => {
                    // Clone the path and apply layer styles
                    const clonedPath = path.clone();
                    clonedPath.strokeColor = new paper.Color(layer.color);
                    clonedPath.strokeWidth = layer.strokeWidth;
                    clonedPath.fillColor = null; // Remove any fills

                    layerGroup.addChild(clonedPath);
                  });
                });
              }
            } catch (error) {
              console.error('  ❌ Error rendering FlowPath:', error);
            }
          });

          // Draw standalones
          layer.standaloneGenerators.forEach((gen) => {
            try {
              const absolutePosition = normalizedToAbsolute(gen.position, paperFormat, paperOrientation);
              const instance = generateStandaloneInstance(
                gen.generatorType,
                gen.params,
                new paper.Point(absolutePosition.x, absolutePosition.y),
                gen.rotation,
                gen.scale,
                gen.seed + globalSeed
              );

              instance.shape.paths.forEach((path) => {
                const clonedPath = path.clone();
                clonedPath.strokeColor = new paper.Color(layer.color);
                clonedPath.strokeWidth = layer.strokeWidth;
                clonedPath.fillColor = null;
                layerGroup.addChild(clonedPath);
              });
              totalShapes++;
            } catch (error) {
              console.error('❌ Error rendering Standalone:', error);
            }
          });

          scaledContentGroup.addChild(layerGroup);
        } catch (error) {
          console.error(`  ❌ Error rendering layer "${layer.name}":`, error);
        }
      });

    // Draw temp path (needs to be in scaledContentGroup to match other content)
    if (tempPath) {
      const tempPathClone = tempPath.clone();
      tempPathClone.strokeColor = new paper.Color('#4a9eff');
      tempPathClone.strokeWidth = 3;
      scaledContentGroup.addChild(tempPathClone);
    }

    // Scale and center the entire content group
    scaledContentGroup.scale(scale);
    scaledContentGroup.position = new paper.Point(canvasSize.width / 2, canvasSize.height / 2);
    contentLayer.addChild(scaledContentGroup);

    paperProject.view.zoom = zoom;
    paperProject.view.update();
  }, [project, zoom, tempPath, isInitialized, globalSeed, canvasSize, paperFormat, paperOrientation, getScaleFactor]);

  // Render SelectionOverlay component as a React component
  // (It will manage its own Paper.js layer internally)
  const selectionOverlay = isInitialized && projectRef.current ? (
    <SelectionOverlay
      paperProject={projectRef.current}
      scaleFactor={getScaleFactor()}
      canvasCenter={{ x: canvasSize.width / 2, y: canvasSize.height / 2 }}
      dragOffset={dragOffset}
    />
  ) : null;

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!projectRef.current || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    const point = screenToVirtual(x, y);

    const firstLayer = project.layers.find((l) => !l.locked);
    if (!firstLayer) return;

    if (currentTool === 'flowpath') {
      handleFlowPathClick(point, firstLayer.id);
    } else if (currentTool === 'standalone') {
      handleStandalonePlacement(point, firstLayer.id);
    } else if (currentTool === 'select') {
      handleSelectClick(point, e.shiftKey, { x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStart || currentTool !== 'select') return;
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - dragStart.x;
    const dy = y - dragStart.y;

    setDragOffset({ x: dx, y: dy });
  };

  const handleMouseUp = () => {
    if (isDragging && currentTool === 'select') {
      // Apply the drag offset as a move operation
      if (dragOffset.x !== 0 || dragOffset.y !== 0) {
        // Convert pixel offset to normalized coordinates
        const format = PAPER_FORMATS[paperFormat];
        const dims = getEffectiveDimensions(format, paperOrientation);
        const scale = getScaleFactor();

        const normalizedDx = (dragOffset.x / scale) / dims.widthPx;
        const normalizedDy = (dragOffset.y / scale) / dims.heightPx;

        moveSelected(normalizedDx, normalizedDy);
      }

      setIsDragging(false);
      setDragStart(null);
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const handleSelectClick = (point: paper.Point, shiftKey: boolean, screenPos: { x: number; y: number }) => {
    // Hit test to find object at click point
    const hitResult = hitTestObjects(point, project);

    if (hitResult) {
      // Select the object
      selectObject(hitResult.id, hitResult.type, shiftKey);

      // Start drag operation if clicking on selected object
      if (selection.ids.includes(hitResult.id)) {
        pushToHistory(); // Push before starting drag
        setIsDragging(true);
        setDragStart(screenPos);
        setDragOffset({ x: 0, y: 0 });
      }
    } else {
      // Click on empty space - deselect
      if (!shiftKey) {
        deselectAll();
      }
    }
  };

  const handleFlowPathClick = (point: paper.Point, _layerId: string) => {
    const newPoints = [...pathPoints, point];
    setPathPoints(newPoints);

    const path = new paper.Path();
    newPoints.forEach((p) => path.add(p));
    path.strokeColor = new paper.Color('#4a9eff');
    path.strokeWidth = 3;

    if (newPoints.length > 1) {
      path.smooth({ type: 'continuous' });
    }

    if (tempPath) {
      tempPath.remove();
    }

    setTempPath(path);
  };

  const handleStandalonePlacement = (point: paper.Point, layerId: string) => {
    const generatorType = selectedGeneratorType || 'bird';

    if (!GeneratorRegistry.has(generatorType)) {
      console.error(`❌ Generator "${generatorType}" not found`);
      return;
    }

    // Convert to normalized coordinates (0-1) before storing
    const normalizedPosition = absoluteToNormalized(
      { x: point.x, y: point.y },
      paperFormat,
      paperOrientation
    );

    addStandaloneGenerator(layerId, {
      position: normalizedPosition,
      rotation: 0,
      scale: 1,
      generatorType,
      params: GeneratorRegistry.getDefaultParams(generatorType),
      seed: globalSeed + Math.floor(Math.random() * 1000),
    });

  };

  const finishFlowPath = () => {
    if (currentTool === 'flowpath' && pathPoints.length > 1 && tempPath) {
      const firstLayer = project.layers.find((l) => !l.locked);
      if (!firstLayer) return;

      // Store the path data as normalized coordinates (0-1)
      const format = PAPER_FORMATS[paperFormat];
      const dims = getEffectiveDimensions(format, paperOrientation);
      const pathData = {
        segments: tempPath.segments.map((seg) => {
          const normalizedPoint = absoluteToNormalized(
            { x: seg.point.x, y: seg.point.y },
            paperFormat,
            paperOrientation
          );

          // Handles are relative vectors - scale them proportionally
          const normalizedHandleIn = seg.handleIn
            ? { x: seg.handleIn.x / dims.widthPx, y: seg.handleIn.y / dims.heightPx }
            : null;
          const normalizedHandleOut = seg.handleOut
            ? { x: seg.handleOut.x / dims.widthPx, y: seg.handleOut.y / dims.heightPx }
            : null;

          return {
            point: normalizedPoint,
            handleIn: normalizedHandleIn,
            handleOut: normalizedHandleOut,
          };
        }),
      };

      addFlowPath(firstLayer.id, {
        bezierCurve: pathData as any, // Store as plain object
        distributionParams: {
          mode: 'linear',
          density: 0.5, // shapes per mm (was 0.05 shapes per pixel)
          spacing: [0.8, 1.2],
          seed: globalSeed,
        },
        flowParams: {
          followCurve: 0.8,
          deviation: 5,
          normalOffset: 0,
          boidsStrength: 0,
          boidsRadius: 10,
          deviationGradient: {
            enabled: false,
            startMultiplier: 0,
            endMultiplier: 2.0,
            startT: 0,
            endT: 1,
            reverse: false,
          },
        },
        generators: [
          {
            id: 'gen-1',
            type: selectedGeneratorType || 'bird',
            weight: 1,
            params: GeneratorRegistry.getDefaultParams(selectedGeneratorType || 'bird'),
            followNormal: false, // Default to tangent direction
          },
        ],
        closed: false, // Default to open path
      });

      console.log('✅ FlowPath created');

      setPathPoints([]);
      if (tempPath) {
        tempPath.remove();
      }
      setTempPath(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === 'Escape' && currentTool === 'flowpath') {
      setPathPoints([]);
      if (tempPath) {
        tempPath.remove();
      }
      setTempPath(null);
      console.log('❌ FlowPath cancelled');
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e0e0e0',
      }}
    >
      {/* Render SelectionOverlay React component */}
      {selectionOverlay}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{
          display: 'block',
          backgroundColor: '#ffffff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          cursor:
            currentTool === 'flowpath'
              ? 'crosshair'
              : currentTool === 'standalone'
              ? 'copy'
              : isDragging
              ? 'grabbing'
              : currentTool === 'select'
              ? 'grab'
              : 'default',
        }}
      />
      {currentTool === 'flowpath' && pathPoints.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <span>Points: {pathPoints.length}</span>
          <button
            onClick={finishFlowPath}
            disabled={pathPoints.length < 2}
            style={{
              padding: '4px 12px',
              backgroundColor: pathPoints.length >= 2 ? '#4a9eff' : '#444',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: pathPoints.length >= 2 ? 'pointer' : 'not-allowed',
              fontSize: '11px',
              fontWeight: 'bold',
            }}
          >
            Finish Path
          </button>
          <span style={{ fontSize: '10px', color: '#aaa' }}>ESC to cancel</span>
        </div>
      )}
      {currentTool === 'standalone' && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          Click to place {selectedGeneratorType || 'bird'} | Seed: {globalSeed}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          padding: '6px 10px',
          borderRadius: '4px',
          fontSize: '11px',
        }}
      >
        {paperFormat} ({PAPER_FORMATS[paperFormat].width} × {PAPER_FORMATS[paperFormat].height} mm)
      </div>
    </div>
  );
}
