import { useEffect, useRef } from 'react';
import paper from 'paper';
import { useStore } from '../store/useStore';
import { PAPER_FORMATS, getEffectiveDimensions, mmToPx } from '../types/formats';

interface GridOverlayProps {
  paperProject: paper.Project | null;
  scaleFactor: number;
  canvasCenter: { x: number; y: number };
}

/**
 * GridOverlay renders a dot grid aligned to the center of the canvas
 * to facilitate symmetrical compositions
 */
export function GridOverlay({
  paperProject,
  scaleFactor,
  canvasCenter,
}: GridOverlayProps) {
  const overlayLayerRef = useRef<paper.Layer | null>(null);

  const gridVisible = useStore((state) => state.gridVisible);
  const gridSize = useStore((state) => state.gridSize);
  const paperFormat = useStore((state) => state.paperFormat);
  const paperOrientation = useStore((state) => state.paperOrientation);

  useEffect(() => {
    if (!paperProject || !paperProject.view) return;

    // Create or reuse overlay layer
    if (!overlayLayerRef.current) {
      overlayLayerRef.current = new paper.Layer();
      overlayLayerRef.current.name = 'grid-overlay';
    }

    const overlayLayer = overlayLayerRef.current;
    paperProject.activate();
    overlayLayer.activate();
    overlayLayer.removeChildren();

    // Only render if grid is visible
    if (!gridVisible) {
      paperProject.view.update();
      return;
    }

    // Get virtual canvas dimensions
    const format = PAPER_FORMATS[paperFormat];
    const dims = getEffectiveDimensions(format, paperOrientation);
    const virtualWidth = dims.widthPx;
    const virtualHeight = dims.heightPx;

    // Create a group that will be scaled and centered to match content layer
    const gridGroup = new paper.Group();

    // Add invisible rectangle for proper scaling/centering
    const canvasBoundsRect = new paper.Path.Rectangle({
      point: [0, 0],
      size: [virtualWidth, virtualHeight],
      strokeColor: null,
      fillColor: null,
    });
    gridGroup.addChild(canvasBoundsRect);

    // Convert grid size from mm to pixels
    const gridSizePx = mmToPx(gridSize);

    // Calculate center point of the canvas
    const centerX = virtualWidth / 2;
    const centerY = virtualHeight / 2;

    // Calculate grid bounds - extend from center in both directions
    // to ensure we cover the entire canvas
    const gridStartX = centerX % gridSizePx; // Offset to align to center
    const gridStartY = centerY % gridSizePx;

    // Draw grid dots
    const dotRadius = Math.max(1, 2 / scaleFactor); // Scale-aware dot size (min 1px)

    for (let x = gridStartX; x <= virtualWidth; x += gridSizePx) {
      for (let y = gridStartY; y <= virtualHeight; y += gridSizePx) {
        // Highlight center lines
        const isCenterX = Math.abs(x - centerX) < 0.1;
        const isCenterY = Math.abs(y - centerY) < 0.1;
        const isCenter = isCenterX || isCenterY;

        const dot = new paper.Path.Circle({
          center: new paper.Point(x, y),
          radius: isCenter ? dotRadius * 1.5 : dotRadius,
          fillColor: isCenter
            ? new paper.Color(0.3, 0.8, 0.5, 0.6) // Highlighted center lines
            : new paper.Color(0, 0, 0, 0.15), // Normal grid dots
        });
        gridGroup.addChild(dot);
      }
    }

    // Add group to layer
    overlayLayer.addChild(gridGroup);

    // Scale and center the grid group to match content layer
    gridGroup.scale(scaleFactor);
    gridGroup.position = new paper.Point(canvasCenter.x, canvasCenter.y);

    // Ensure grid is behind everything else
    overlayLayer.sendToBack();

    paperProject.view.update();

    // Cleanup on unmount
    return () => {
      if (overlayLayerRef.current) {
        overlayLayerRef.current.removeChildren();
      }
    };
  }, [
    paperProject,
    gridVisible,
    gridSize,
    scaleFactor,
    canvasCenter,
    paperFormat,
    paperOrientation,
  ]);

  // This component doesn't render any React elements - only Paper.js drawings
  return null;
}
