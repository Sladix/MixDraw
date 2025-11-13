import { useEffect, useRef } from 'react';
import paper from 'paper';
import { useStore } from '../store/useStore';
import { getSelectionBounds } from '../utils/hitTest';
import { normalizedToAbsolute } from '../utils/coordinates';
import { PAPER_FORMATS, getEffectiveDimensions } from '../types/formats';

interface SelectionOverlayProps {
  paperProject: paper.Project | null;
  scaleFactor: number;
  canvasCenter: { x: number; y: number };
  dragOffset?: { x: number; y: number };
}

/**
 * SelectionOverlay renders visual selection feedback on a Paper.js layer
 * - Selection bounds rectangle
 * - Transform handles (corner resize, rotation)
 * - Highlight selected objects
 */
export function SelectionOverlay({
  paperProject,
  scaleFactor,
  canvasCenter,
  dragOffset = { x: 0, y: 0 },
}: SelectionOverlayProps) {
  const overlayLayerRef = useRef<paper.Layer | null>(null);

  const selection = useStore((state) => state.selection);
  const project = useStore((state) => state.project);
  const paperFormat = useStore((state) => state.paperFormat);
  const paperOrientation = useStore((state) => state.paperOrientation);

  useEffect(() => {
    if (!paperProject || !paperProject.view) return;

    // Create or reuse overlay layer
    if (!overlayLayerRef.current) {
      overlayLayerRef.current = new paper.Layer();
      overlayLayerRef.current.name = 'selection-overlay';
    }

    const overlayLayer = overlayLayerRef.current;
    paperProject.activate();
    overlayLayer.activate();
    overlayLayer.removeChildren();

    // Only render if something is selected
    if (selection.type === 'none' || !selection.ids || selection.ids.length === 0) {
      paperProject.view.update();
      return;
    }

    // Get selection bounds
    const bounds = getSelectionBounds(selection.ids, selection.type as 'flowPath' | 'standaloneGenerator', project);

    if (!bounds) {
      paperProject.view.update();
      return;
    }

    // Apply drag offset to bounds if dragging
    const displayBounds = bounds.clone();
    if (dragOffset.x !== 0 || dragOffset.y !== 0) {
      displayBounds.x += dragOffset.x / scaleFactor;
      displayBounds.y += dragOffset.y / scaleFactor;
    }

    // Create a group that will be scaled and centered to match content layer
    const overlayGroup = new paper.Group();

    // Get virtual canvas dimensions to match content layer coordinate space
    const format = PAPER_FORMATS[paperFormat];
    const dims = getEffectiveDimensions(format, paperOrientation);
    const virtualWidth = dims.widthPx;
    const virtualHeight = dims.heightPx;

    // Add invisible rectangle that defines the full virtual canvas bounds
    // This ensures proper scaling and centering to match content layer
    const canvasBoundsRect = new paper.Path.Rectangle({
      point: [0, 0],
      size: [virtualWidth, virtualHeight],
      strokeColor: null,
      fillColor: null,
    });
    overlayGroup.addChild(canvasBoundsRect);

    // Draw selection rectangle
    const selectionRect = new paper.Path.Rectangle({
      rectangle: displayBounds,
      strokeColor: new paper.Color('#4a9eff'),
      strokeWidth: 2, // Will be scaled down
      dashArray: [10, 5],
    });
    overlayGroup.addChild(selectionRect);

    // Draw corner handles (for resize/scale)
    const handleSize = 8;
    const handlePositions = [
      displayBounds.topLeft,
      displayBounds.topRight,
      displayBounds.bottomLeft,
      displayBounds.bottomRight,
      displayBounds.topCenter,
      displayBounds.bottomCenter,
      displayBounds.leftCenter,
      displayBounds.rightCenter,
    ];

    handlePositions.forEach((pos) => {
      const handle = new paper.Path.Rectangle({
        center: pos,
        size: [handleSize, handleSize],
        fillColor: new paper.Color('#4a9eff'),
        strokeColor: new paper.Color('#ffffff'),
        strokeWidth: 1,
      });
      overlayGroup.addChild(handle);
    });

    // Draw rotation handle (above top center)
    const rotationHandlePos = displayBounds.topCenter.add(new paper.Point(0, -20));
    const rotationHandle = new paper.Path.Circle({
      center: rotationHandlePos,
      radius: 5,
      fillColor: new paper.Color('#ff6b6b'),
      strokeColor: new paper.Color('#ffffff'),
      strokeWidth: 1,
    });
    overlayGroup.addChild(rotationHandle);

    // Draw line connecting rotation handle to top center
    const rotationLine = new paper.Path.Line({
      from: displayBounds.topCenter,
      to: rotationHandlePos,
      strokeColor: new paper.Color('#ff6b6b'),
      strokeWidth: 1,
      dashArray: [4, 2],
    });
    overlayGroup.addChild(rotationLine);

    // Add group to layer
    overlayLayer.addChild(overlayGroup);

    // Scale and center the overlay group to match content layer
    overlayGroup.scale(scaleFactor);
    overlayGroup.position = new paper.Point(canvasCenter.x, canvasCenter.y);

    paperProject.view.update();

    // Cleanup on unmount
    return () => {
      if (overlayLayerRef.current) {
        overlayLayerRef.current.removeChildren();
      }
    };
  }, [
    paperProject,
    selection,
    project,
    scaleFactor,
    canvasCenter,
    dragOffset,
    paperFormat,
    paperOrientation,
  ]);

  // This component doesn't render any React elements - only Paper.js drawings
  return null;
}
