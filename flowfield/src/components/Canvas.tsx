import React, { useRef, useEffect, useCallback, useState } from 'react';
import paper from 'paper';
import { useFlowFieldStore } from '../store/useFlowFieldStore';
import { ForceEngine } from '../core/ForceEngine';
import { StreamlineGenerator } from '../core/StreamlineGenerator';
import { FORMATS } from '../core/types';

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperScopeRef = useRef<paper.PaperScope | null>(null);
  const [lineCount, setLineCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Get state from store
  const format = useFlowFieldStore((s) => s.format);
  const margin = useFlowFieldStore((s) => s.margin);
  const seed = useFlowFieldStore((s) => s.seed);
  const strokeColor = useFlowFieldStore((s) => s.strokeColor);
  const lineParams = useFlowFieldStore((s) => s.lineParams);
  const colorPalette = useFlowFieldStore((s) => s.colorPalette);
  const forces = useFlowFieldStore((s) => s.forces);
  const superParams = useFlowFieldStore((s) => s.superParams);
  const zones = useFlowFieldStore((s) => s.zones);
  const zoneParams = useFlowFieldStore((s) => s.zoneParams);

  /**
   * Generate the flow field
   */
  const generate = useCallback(() => {
    if (!paperScopeRef.current) return;

    setIsGenerating(true);
    const startTime = performance.now();

    const scope = paperScopeRef.current;
    scope.activate();

    // Clear existing content
    scope.project.activeLayer.removeChildren();

    // Get dimensions
    const dims = FORMATS[format];
    const bounds = {
      x: 0,
      y: 0,
      width: dims.width,
      height: dims.height,
    };

    // Create background
    new scope.Path.Rectangle({
      rectangle: scope.view.bounds,
      fillColor: 'white',
    });

    // Create force engine with zones if enabled
    const activeZones = zoneParams.enabled ? zones : [];
    console.log(`[Zones] enabled=${zoneParams.enabled}, count=${zones.length}, activeZones=${activeZones.length}`);
    if (activeZones.length > 0) {
      console.log('[Zones] Zone data:', activeZones.map(z => ({
        id: z.id,
        anchor: z.anchor,
        radius: z.radius,
        weights: z.forceWeights,
      })));
    }

    const forceEngine = new ForceEngine({
      forces,
      superParams,
      bounds,
      seed,
      zones: activeZones,
    });

    // Create streamline generator
    const streamlineGenerator = new StreamlineGenerator(
      {
        lineParams,
        bounds,
        margin,
        scope,
        colorPalette,
      },
      seed
    );

    // Generate streamlines
    const streamlines = streamlineGenerator.generate(forceEngine, strokeColor);

    // Debug: Draw zone boundaries if showDebug is enabled
    if (zoneParams.showDebug && zones.length > 0) {
      console.log(`[Zones] Drawing ${zones.length} zone boundaries`);
      for (const zone of zones) {
        // Convert normalized coordinates to absolute
        const cx = bounds.x + zone.anchor.x * bounds.width;
        const cy = bounds.y + zone.anchor.y * bounds.height;
        const radiusPx = zone.radius * Math.max(bounds.width, bounds.height);

        // Draw zone center
        new scope.Path.Circle({
          center: new scope.Point(cx, cy),
          radius: 5,
          fillColor: new scope.Color(1, 0, 0, 0.8),
        });

        // Draw zone boundary
        new scope.Path.Circle({
          center: new scope.Point(cx, cy),
          radius: radiusPx,
          strokeColor: new scope.Color(1, 0, 0, 0.5),
          strokeWidth: 2,
          dashArray: [5, 5],
        });

        // Label with zone ID
        new scope.PointText({
          point: new scope.Point(cx, cy - radiusPx - 10),
          content: zone.id,
          fontSize: 10,
          fillColor: new scope.Color(1, 0, 0, 0.8),
          justification: 'center',
        });
      }
    }

    // Update line count
    setLineCount(streamlines.length);

    // Force view update
    scope.view.update();

    setIsGenerating(false);
    const elapsed = performance.now() - startTime;
    console.log(`Generated ${streamlines.length} lines in ${elapsed.toFixed(0)}ms`);
  }, [format, margin, seed, strokeColor, lineParams, colorPalette, forces, superParams, zones, zoneParams]);

  /**
   * Initialize Paper.js
   */
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create new Paper.js scope
    const scope = new paper.PaperScope();
    scope.setup(canvasRef.current);
    paperScopeRef.current = scope;

    // Initial resize
    const dims = FORMATS[format];
    scope.view.viewSize = new scope.Size(dims.width, dims.height);

    // Initial generation
    generate();

    return () => {
      scope.project.clear();
    };
  }, []); // Only run once on mount

  /**
   * Handle format changes
   */
  useEffect(() => {
    if (!paperScopeRef.current) return;

    const scope = paperScopeRef.current;
    const dims = FORMATS[format];

    // Resize canvas
    if (canvasRef.current) {
      canvasRef.current.width = dims.width;
      canvasRef.current.height = dims.height;
    }

    scope.view.viewSize = new scope.Size(dims.width, dims.height);
    generate();
  }, [format, generate]);

  // NOTE: Removed auto-regeneration on param change
  // This was causing issues when editing formulas (regenerates on every keystroke)
  // Users should click "Regenerate" button to apply changes

  /**
   * Export to SVG
   */
  const exportSVG = useCallback(() => {
    if (!paperScopeRef.current) return;

    const svg = paperScopeRef.current.project.exportSVG({ asString: true }) as string;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = `flowfield_${format}_${seed}.svg`;
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
  }, [format, seed]);

  /**
   * Export to PNG
   */
  const exportPNG = useCallback(() => {
    if (!canvasRef.current) return;

    const link = document.createElement('a');
    link.download = `flowfield_${format}_${seed}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }, [format, seed]);

  // Expose export methods via ref (could use context or store instead)
  useEffect(() => {
    (window as any).__flowfield_export = { exportSVG, exportPNG, regenerate: generate };
  }, [exportSVG, exportPNG, generate]);

  const dims = FORMATS[format];

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
        padding: '20px',
        overflow: 'auto',
        backgroundColor: '#1a1a1a',
        position: 'relative',
      }}
    >
      {/* Line count indicator */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          padding: '6px 12px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#fff',
          fontFamily: 'monospace',
        }}
      >
        {isGenerating ? 'Generating...' : `${lineCount} lines`}
      </div>

      <div
        style={{
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          backgroundColor: 'white',
          maxWidth: '90%',
          maxHeight: '90%',
        }}
      >
        <canvas
          ref={canvasRef}
          width={dims.width}
          height={dims.height}
          style={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 100px)',
            objectFit: 'contain',
          }}
        />
      </div>
    </div>
  );
};
