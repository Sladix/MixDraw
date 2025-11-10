import paper from 'paper';
import type { Layer, Project } from '../types';
import type { FormatType } from '../types/formats';
import { regenerateFlowPath, generateStandaloneInstance } from './flowPathEngine';
import { normalizedToAbsolute } from '../utils/coordinates';
import { PAPER_FORMATS, getEffectiveDimensions } from '../types/formats';

/**
 * Export a single layer to SVG string
 * @param layer - Layer to export
 * @param paperFormat - Paper format for coordinate conversion
 * @param paperOrientation - Paper orientation (portrait or landscape)
 * @returns SVG string
 */
export function exportLayerToSVG(
  layer: Layer,
  paperFormat: FormatType = 'A4',
  paperOrientation: 'portrait' | 'landscape' = 'portrait'
): string {
  const format = PAPER_FORMATS[paperFormat];
  const dims = getEffectiveDimensions(format, paperOrientation);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = dims.widthPx;
  tempCanvas.height = dims.heightPx;

  const tempProject = new paper.Project(tempCanvas);

  const group = new paper.Group();

  // Add all FlowPath instances (only generator outputs, not the flowpath curve itself)
  layer.flowPaths.forEach((flowPath) => {
    try {
      // Reconstruct the path from serialized normalized data
      const reconstructedPath = new paper.Path();
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
          }
        });
        // Apply closed property
        if (flowPath.closed) {
          reconstructedPath.closed = true;
        }
        // Only smooth if there are no handles
        const hasHandles = flowPath.bezierCurve.segments.some(
          (seg: any) => seg.handleIn || seg.handleOut
        );
        if (!hasHandles) {
          reconstructedPath.smooth({ type: 'continuous' });
        }
      }

      // Create temporary flowPath with reconstructed curve
      const tempFlowPath = {
        ...flowPath,
        bezierCurve: reconstructedPath,
      };

      const instances = regenerateFlowPath(tempFlowPath);
      instances.forEach((instance) => {
        instance.shape.paths.forEach((path) => {
          const clonedPath = path.clone();
          clonedPath.strokeColor = new paper.Color(layer.color);
          clonedPath.fillColor = null; // No fills for plotter
          group.addChild(clonedPath);
        });
      });

      // Clean up temporary path
      reconstructedPath.remove();
    } catch (error) {
      console.error('Error exporting FlowPath:', error);
    }
  });

  // Add all standalone generators
  layer.standaloneGenerators.forEach((gen) => {
    try {
      // Convert normalized position to absolute coordinates
      const absolutePosition = normalizedToAbsolute(gen.position, paperFormat, paperOrientation);

      const instance = generateStandaloneInstance(
        gen.generatorType,
        gen.params,
        new paper.Point(absolutePosition.x, absolutePosition.y),
        gen.rotation,
        gen.scale,
        gen.seed
      );
      instance.shape.paths.forEach((path) => {
        const clonedPath = path.clone();
        clonedPath.strokeColor = new paper.Color(layer.color);
        clonedPath.fillColor = null; // No fills for plotter
        group.addChild(clonedPath);
      });
    } catch (error) {
      console.error('Error exporting StandaloneGenerator:', error);
    }
  });

  // Apply brush effect if enabled
  if (layer.brushEffect.enabled) {
    applyBrushFadeEffect(group, layer.brushEffect.fadeStart, layer.brushEffect.fadeEnd);
  }

  // Export to SVG with proper formatting
  let svg = group.exportSVG({ asString: true }) as string;

  // Wrap in proper SVG root element with dimensions in mm for Inkscape compatibility
  // viewBox remains in pixels (internal coordinates)
  if (!svg.startsWith('<svg')) {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}mm" height="${dims.height}mm" viewBox="0 0 ${tempCanvas.width} ${tempCanvas.height}">\n${svg}\n</svg>`;
  } else {
    // Replace existing width/height attributes with mm values
    svg = svg.replace(/width="[^"]*"/, `width="${dims.width}mm"`);
    svg = svg.replace(/height="[^"]*"/, `height="${dims.height}mm"`);
  }

  // Cleanup
  tempProject.remove();
  tempCanvas.remove();

  return svg;
}

/**
 * Apply brush fade effect to paths
 * @param group - Group containing paths
 * @param fadeStart - Start of fade (0-1)
 * @param fadeEnd - End of fade (0-1)
 */
function applyBrushFadeEffect(
  group: paper.Group,
  fadeStart: number,
  fadeEnd: number
): void {
  const children = group.children;
  const totalChildren = children.length;

  children.forEach((child, index) => {
    if (child instanceof paper.Path) {
      const progress = index / totalChildren;

      if (progress >= fadeStart && progress <= fadeEnd) {
        const fadeProgress = (progress - fadeStart) / (fadeEnd - fadeStart);
        child.opacity = 1 - fadeProgress;
      } else if (progress > fadeEnd) {
        child.opacity = 0;
      }
    }
  });
}

/**
 * Export all layers to individual SVG files
 * @param project - Project to export
 * @param projectName - Base name for exported files
 * @param paperFormat - Paper format for coordinate conversion
 * @param paperOrientation - Paper orientation (portrait or landscape)
 */
export function exportAllLayers(
  project: Project,
  projectName: string,
  paperFormat: FormatType = 'A4',
  paperOrientation: 'portrait' | 'landscape' = 'portrait'
): void {
  project.layers.forEach((layer, index) => {
    const svg = exportLayerToSVG(layer, paperFormat, paperOrientation);
    downloadSVG(svg, `${projectName}-layer-${index + 1}-${layer.name}.svg`);
  });
}

/**
 * Download SVG string as file
 * @param svgString - SVG content
 * @param filename - Filename
 */
export function downloadSVG(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Save project to JSON file
 * @param project - Project to save
 * @param filename - Filename
 */
export function saveProject(project: Project, filename: string): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Load project from JSON file
 * @param file - File to load
 * @returns Promise with project data
 */
export function loadProject(file: File): Promise<Project> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const project = JSON.parse(e.target?.result as string);
        resolve(project);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
