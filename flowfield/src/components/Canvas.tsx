import React, { useRef, useEffect, useCallback, useState } from 'react';
import paper from 'paper';
import { useFlowFieldStore } from '../store/useFlowFieldStore';
import { ForceEngine } from '../core/ForceEngine';
import { StreamlineGeneratorV2, RawStreamline } from '../core/StreamlineGeneratorV2';
import { FORMATS } from '../core/types';
import { generateExportFilename } from '../core/hashParams';
import { analytics } from '../core/analytics';

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperScopeRef = useRef<paper.PaperScope | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [lineCount, setLineCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Get state from store
  const format = useFlowFieldStore((s) => s.format);
  const customWidth = useFlowFieldStore((s) => s.customWidth);
  const customHeight = useFlowFieldStore((s) => s.customHeight);
  const margin = useFlowFieldStore((s) => s.margin);
  const seed = useFlowFieldStore((s) => s.seed);
  const strokeColor = useFlowFieldStore((s) => s.strokeColor);
  const lineParams = useFlowFieldStore((s) => s.lineParams);
  const colorPalette = useFlowFieldStore((s) => s.colorPalette);
  const forces = useFlowFieldStore((s) => s.forces);
  const superParams = useFlowFieldStore((s) => s.superParams);
  const zones = useFlowFieldStore((s) => s.zones);
  const zoneParams = useFlowFieldStore((s) => s.zoneParams);

  // Get actual dimensions (custom or preset)
  const getDimensions = useCallback(() => {
    if (format === 'custom') {
      return { width: customWidth, height: customHeight };
    }
    return FORMATS[format];
  }, [format, customWidth, customHeight]);

  /**
   * Render a single streamline to Paper.js
   */
  const renderStreamline = useCallback((
    scope: paper.PaperScope,
    streamline: RawStreamline
  ): paper.Path => {
    const path = new scope.Path({
      strokeColor: streamline.color,
      strokeWidth: lineParams.strokeWidth,
      strokeCap: 'round',
      strokeJoin: 'round',
    });

    for (const p of streamline.points) {
      path.add(new scope.Point(p.x, p.y));
    }

    path.smooth();
    return path;
  }, [lineParams.strokeWidth]);

  /**
   * Generate the flow field (progressive or sync)
   */
  const generate = useCallback(async () => {
    if (!paperScopeRef.current) return;

    // Cancel any ongoing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsGenerating(true);
    setLineCount(0);
    const startTime = performance.now();

    const scope = paperScopeRef.current;
    scope.activate();

    // Clear existing content
    scope.project.activeLayer.removeChildren();

    // Get dimensions
    const dims = getDimensions();
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
    const forceEngine = new ForceEngine({
      forces,
      superParams,
      bounds,
      seed,
      zones: activeZones,
    });

    // Create streamline generator V2
    const streamlineGenerator = new StreamlineGeneratorV2(
      {
        lineParams,
        bounds,
        margin,
        colorPalette,
      },
      seed
    );

    let count = 0;

    if (lineParams.progressiveRender) {
      // Progressive rendering using async generator
      try {
        for await (const streamline of streamlineGenerator.generateAsync(
          forceEngine,
          strokeColor,
          3, // batchSize - render 3 lines per frame
          0  // delayMs - use requestAnimationFrame
        )) {
          if (signal.aborted) break;

          renderStreamline(scope, streamline);
          count++;
          setLineCount(count);
          scope.view.update();
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('Generation error:', e);
        }
      }
    } else {
      // Synchronous rendering (faster but blocks UI)
      const streamlines = streamlineGenerator.generate(forceEngine, strokeColor);

      for (const streamline of streamlines) {
        if (signal.aborted) break;
        renderStreamline(scope, streamline);
        count++;
      }

      setLineCount(count);
      scope.view.update();
    }

    // Debug: Draw zone boundaries if showDebug is enabled
    if (zoneParams.showDebug && zones.length > 0 && !signal.aborted) {
      for (const zone of zones) {
        const cx = bounds.x + zone.anchor.x * bounds.width;
        const cy = bounds.y + zone.anchor.y * bounds.height;
        const radiusPx = zone.radius * Math.max(bounds.width, bounds.height);

        new scope.Path.Circle({
          center: new scope.Point(cx, cy),
          radius: 5,
          fillColor: new scope.Color(1, 0, 0, 0.8),
        });

        new scope.Path.Circle({
          center: new scope.Point(cx, cy),
          radius: radiusPx,
          strokeColor: new scope.Color(1, 0, 0, 0.5),
          strokeWidth: 2,
          dashArray: [5, 5],
        });

        new scope.PointText({
          point: new scope.Point(cx, cy - radiusPx - 10),
          content: zone.id,
          fontSize: 10,
          fillColor: new scope.Color(1, 0, 0, 0.8),
          justification: 'center',
        });
      }
    }

    setIsGenerating(false);
    const elapsed = performance.now() - startTime;
    console.log(`Generated ${count} lines in ${elapsed.toFixed(0)}ms`);
  }, [getDimensions, margin, seed, strokeColor, lineParams, colorPalette, forces, superParams, zones, zoneParams, renderStreamline]);

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
    const dims = getDimensions();
    scope.view.viewSize = new scope.Size(dims.width, dims.height);

    // Initial generation
    generate();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      scope.project.clear();
    };
  }, []); // Only run once on mount

  /**
   * Handle format/dimension changes
   */
  useEffect(() => {
    if (!paperScopeRef.current) return;

    const scope = paperScopeRef.current;
    const dims = getDimensions();

    // Resize canvas
    if (canvasRef.current) {
      canvasRef.current.width = dims.width;
      canvasRef.current.height = dims.height;
    }

    scope.view.viewSize = new scope.Size(dims.width, dims.height);
    generate();
  }, [getDimensions, generate]);

  /**
   * Export to SVG
   */
  const exportSVG = useCallback(() => {
    if (!paperScopeRef.current) return;

    // Preset format sizes in mm
    const formatsMm: Record<string, { width: number; height: number }> = {
      a6: { width: 105, height: 148 },
      a5: { width: 148, height: 210 },
      a4: { width: 210, height: 297 },
      a3: { width: 297, height: 420 },
      square: { width: 210, height: 210 },
    };

    let svg = paperScopeRef.current.project.exportSVG({
      asString: true,
      bounds: 'view'
    }) as string;

    const dims = getDimensions();
    // For custom, convert pixels to mm (assuming 72 DPI for SVG)
    const dimsMm = format === 'custom'
      ? { width: Math.round(dims.width * 25.4 / 72), height: Math.round(dims.height * 25.4 / 72) }
      : formatsMm[format];

    svg = svg.replace(
      new RegExp(`width="${dims.width}" height="${dims.height}"`),
      `width="${dimsMm.width}mm" height="${dimsMm.height}mm"`
    );

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const hashParams = { lineParams, colorPalette, forces, superParams };
    const filename = generateExportFilename(format, seed, hashParams, 'svg');

    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);

    // Track export event
    const hash = filename.split('_').pop()?.replace('.svg', '') || '';
    analytics.exportSVG(format, seed, hash);
  }, [format, seed, getDimensions, lineParams, colorPalette, forces, superParams]);

  /**
   * Export to PNG
   */
  const exportPNG = useCallback(() => {
    if (!canvasRef.current) return;

    const hashParams = { lineParams, colorPalette, forces, superParams };
    const filename = generateExportFilename(format, seed, hashParams, 'png');

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();

    // Track export event
    const hash = filename.split('_').pop()?.replace('.png', '') || '';
    analytics.exportPNG(format, seed, hash);
  }, [format, seed, lineParams, colorPalette, forces, superParams]);

  // Expose export methods via ref
  useEffect(() => {
    (window as any).__flowfield_export = { exportSVG, exportPNG, regenerate: generate };
  }, [exportSVG, exportPNG, generate]);

  const dims = getDimensions();

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
        {isGenerating ? `Generating... ${lineCount}` : `${lineCount} lines`}
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
