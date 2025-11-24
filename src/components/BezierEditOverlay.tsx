import { useEffect, useRef } from 'react';
import paper from 'paper';
import { useStore } from '../store/useStore';
import { normalizedToAbsolute } from '../utils/coordinates';
import { PAPER_FORMATS, getEffectiveDimensions } from '../types/formats';
import type { FlowPath } from '../types';

interface BezierEditOverlayProps {
  paperProject: paper.Project | null;
  scaleFactor: number;
  canvasCenter: { x: number; y: number };
}

/**
 * BezierEditOverlay renders bezier curve editing controls
 * - Shows all curve points as circles when FlowPath is selected
 * - Shows handles for the selected point
 * - Highlights selected point
 */
export function BezierEditOverlay({
  paperProject,
  scaleFactor,
  canvasCenter,
}: BezierEditOverlayProps) {
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
      overlayLayerRef.current.name = 'bezier-edit-overlay';
    }

    const overlayLayer = overlayLayerRef.current;
    paperProject.activate();
    overlayLayer.activate();
    overlayLayer.removeChildren();

    // Only render if a FlowPath is selected and bezier editing is enabled
    if (
      selection.type !== 'flowPath' ||
      !selection.id ||
      !selection.editingBezier
    ) {
      paperProject.view.update();
      return;
    }

    // Find the selected FlowPath
    let selectedFlowPath: FlowPath | null = null;
    for (const layer of project.layers) {
      const fp = layer.flowPaths.find((f) => f.id === selection.id);
      if (fp) {
        selectedFlowPath = fp;
        break;
      }
    }

    if (!selectedFlowPath || !selectedFlowPath.bezierCurve.segments) {
      paperProject.view.update();
      return;
    }

    // Get virtual canvas dimensions
    const format = PAPER_FORMATS[paperFormat];
    const dims = getEffectiveDimensions(format, paperOrientation);
    const virtualWidth = dims.widthPx;
    const virtualHeight = dims.heightPx;

    // Create a group that will be scaled and centered to match content layer
    const overlayGroup = new paper.Group();

    // Add invisible rectangle for proper scaling/centering
    const canvasBoundsRect = new paper.Path.Rectangle({
      point: [0, 0],
      size: [virtualWidth, virtualHeight],
      strokeColor: null,
      fillColor: null,
    });
    overlayGroup.addChild(canvasBoundsRect);

    const pointRadius = 30;
    const handleRadius = 20;
    const selectedPointIndex = selection.selectedPointIndex ?? null;

    // Draw all curve points
    selectedFlowPath.bezierCurve.segments.forEach((seg: any, index: number) => {
      if (!seg.point) return;

      // Convert normalized point to absolute coordinates
      const absolutePoint = normalizedToAbsolute(
        { x: seg.point.x, y: seg.point.y },
        paperFormat,
        paperOrientation
      );

      const isSelected = index === selectedPointIndex;

      // Draw point circle
      const pointCircle = new paper.Path.Circle({
        center: new paper.Point(absolutePoint.x, absolutePoint.y),
        radius: pointRadius,
        fillColor: isSelected ? new paper.Color('#ff6b6b') : new paper.Color('#4a9eff'),
        strokeColor: new paper.Color('#ffffff'),
        strokeWidth: 10,
      });
      pointCircle.data = { type: 'point', index };
      overlayGroup.addChild(pointCircle);

      // If this point is selected, draw its handles
      if (isSelected) {
        const point = new paper.Point(absolutePoint.x, absolutePoint.y);

        // Draw handleIn (if exists)
        if (seg.handleIn) {
          const handleInAbsolute = new paper.Point(
            seg.handleIn.x * dims.widthPx,
            seg.handleIn.y * dims.heightPx
          );
          const handleInPos = point.add(handleInAbsolute);

          // Line from point to handle
          const handleInLine = new paper.Path.Line({
            from: point,
            to: handleInPos,
            strokeColor: new paper.Color('#ff6b6b'),
            strokeWidth: 2,
          });
          overlayGroup.addChild(handleInLine);

          // Handle endpoint circle
          const handleInCircle = new paper.Path.Circle({
            center: handleInPos,
            radius: handleRadius,
            fillColor: new paper.Color('#ff6b6b'),
            strokeColor: new paper.Color('#ffffff'),
            strokeWidth: 5,
          });
          handleInCircle.data = { type: 'handle', handleType: 'in', pointIndex: index };
          overlayGroup.addChild(handleInCircle);
        }

        // Draw handleOut (if exists)
        if (seg.handleOut) {
          const handleOutAbsolute = new paper.Point(
            seg.handleOut.x * dims.widthPx,
            seg.handleOut.y * dims.heightPx
          );
          const handleOutPos = point.add(handleOutAbsolute);

          // Line from point to handle
          const handleOutLine = new paper.Path.Line({
            from: point,
            to: handleOutPos,
            strokeColor: new paper.Color('#4ade80'),
            strokeWidth: 2,
          });
          overlayGroup.addChild(handleOutLine);

          // Handle endpoint circle
          const handleOutCircle = new paper.Path.Circle({
            center: handleOutPos,
            radius: handleRadius,
            fillColor: new paper.Color('#4ade80'),
            strokeColor: new paper.Color('#ffffff'),
            strokeWidth: 5,
          });
          handleOutCircle.data = { type: 'handle', handleType: 'out', pointIndex: index };
          overlayGroup.addChild(handleOutCircle);
        }
      }
    });

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
    paperFormat,
    paperOrientation,
  ]);

  // This component doesn't render any React elements - only Paper.js drawings
  return null;
}
