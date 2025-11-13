import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useTimeline } from '../contexts/TimelineContext';
import type { Timeline, Keyframe, InterpolationType } from '../types';
import { nanoid } from 'nanoid';
import { evaluateTimeline } from '../utils/interpolation';
import { GeneratorRegistry } from '../core/GeneratorRegistry';

interface TimelinePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DragState {
  keyframeId: string;
  startT: number;
  startValue: number;
  startMouseX: number;
  startMouseY: number;
}

export function TimelinePanel({ isOpen, onClose }: TimelinePanelProps) {
  const project = useStore((state) => state.project);
  const selection = useStore((state) => state.selection);
  const updateFlowPath = useStore((state) => state.updateFlowPath);
  const { selectedParam } = useTimeline();

  const [scrubberPosition, setScrubberPosition] = useState(0.5); // 0-1
  const [hoveredKeyframe, setHoveredKeyframe] = useState<string | null>(null);
  const [selectedKeyframe, setSelectedKeyframe] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<{ x: number; y: number; keyframeId: string } | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(0.1); // 10% by default

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Get selected flowPath
  let selectedFlowPath = null;
  if (selection.type === 'flowPath' && selection.id) {
    for (const layer of project.layers) {
      const fp = layer.flowPaths.find((f) => f.id === selection.id);
      if (fp) {
        selectedFlowPath = fp;
        break;
      }
    }
  }

  // Get or create timeline for selected param
  const timelines = selectedFlowPath?.timelines || [];
  const activeTimeline = selectedParam
    ? timelines.find((tl) => tl.paramName === selectedParam)
    : null;

  // Available parameters to keyframe with value ranges
  const availableParams = selectedFlowPath ? [
    {
      name: 'density',
      label: 'Density',
      defaultValue: selectedFlowPath.distributionParams.density,
      minValue: 0,
      maxValue: 5,
    },
    {
      name: 'spread',
      label: 'Spread',
      defaultValue: selectedFlowPath.flowParams.spread,
      minValue: 0,
      maxValue: 200,
    },
    {
      name: 'followCurve',
      label: 'Follow Curve',
      defaultValue: selectedFlowPath.flowParams.followCurve,
      minValue: 0,
      maxValue: 1,
    },
  ] : [];

  // Parse generator parameter names (format: "gen.{genId}.{paramName}")
  let paramDef = availableParams.find((p) => p.name === selectedParam);

  // If not a flowpath parameter, check if it's a generator parameter
  if (!paramDef && selectedParam && selectedParam.startsWith('gen.')) {
    const parts = selectedParam.split('.');
    if (parts.length === 3) {
      const [, genId, paramName] = parts;

      // Find the generator and its parameter definition
      const generator = selectedFlowPath?.generators.find(g => g.id === genId);
      if (generator) {
        const gen = GeneratorRegistry.get(generator.type);
        const genParamDefs = gen?.getParamDefinitions() || [];
        const genParamDef = genParamDefs.find(pd => pd.name === paramName);

        if (genParamDef && genParamDef.type === 'minmax') {
          // Create a paramDef for this generator parameter
          const currentValue = generator.params[paramName];
          const defaultValue = typeof currentValue === 'number' ? currentValue : (currentValue?.min + currentValue?.max) / 2 || 0;

          paramDef = {
            name: selectedParam,
            label: `${gen?.name || 'Generator'} - ${genParamDef.label}`,
            defaultValue,
            minValue: genParamDef.min || 0,
            maxValue: genParamDef.max || 100,
          };
        }
      }
    }
  }

  // Snap value to grid (can be disabled with shift key)
  const snapValue = useCallback((value: number, gridSize: number, shiftKey: boolean = false): number => {
    if (!snapToGrid || shiftKey) return value;
    return Math.round(value / gridSize) * gridSize;
  }, [snapToGrid]);

  // Create or update timeline
  const updateTimeline = useCallback((timeline: Timeline) => {
    if (!selectedFlowPath) return;

    const existingIndex = timelines.findIndex((tl) => tl.id === timeline.id);
    const newTimelines =
      existingIndex >= 0
        ? timelines.map((tl, i) => (i === existingIndex ? timeline : tl))
        : [...timelines, timeline];

    updateFlowPath(selectedFlowPath.id, {
      timelines: newTimelines,
    });
  }, [selectedFlowPath, timelines, updateFlowPath]);

  // Add keyframe at scrubber position
  const addKeyframe = useCallback(() => {
    if (!selectedParam || !paramDef) return;

    // Calculate value based on existing timeline or default
    let value = paramDef.defaultValue;
    if (activeTimeline && activeTimeline.keyframes.length > 0) {
      value = evaluateTimeline(scrubberPosition, activeTimeline.keyframes, paramDef.defaultValue);
    }

    const newKeyframe: Keyframe = {
      id: nanoid(),
      t: scrubberPosition,
      value,
      interpolation: 'linear',
    };

    if (activeTimeline) {
      // Add to existing timeline
      const sortedKeyframes = [...activeTimeline.keyframes, newKeyframe].sort((a, b) => a.t - b.t);
      updateTimeline({
        ...activeTimeline,
        keyframes: sortedKeyframes,
      });
    } else {
      // Create new timeline
      const newTimeline: Timeline = {
        id: nanoid(),
        paramName: selectedParam,
        keyframes: [newKeyframe],
        enabled: true,
      };
      updateTimeline(newTimeline);
    }

    setSelectedKeyframe(newKeyframe.id);
  }, [selectedParam, paramDef, scrubberPosition, activeTimeline, updateTimeline]);

  // Remove keyframe
  const removeKeyframe = useCallback((keyframeId: string) => {
    if (!activeTimeline) return;

    updateTimeline({
      ...activeTimeline,
      keyframes: activeTimeline.keyframes.filter((kf) => kf.id !== keyframeId),
    });

    if (selectedKeyframe === keyframeId) {
      setSelectedKeyframe(null);
    }
  }, [activeTimeline, selectedKeyframe, updateTimeline]);

  // Update keyframe
  const updateKeyframe = useCallback((keyframeId: string, updates: Partial<Keyframe>) => {
    if (!activeTimeline) return;

    const updatedKeyframes = activeTimeline.keyframes.map((kf) =>
      kf.id === keyframeId ? { ...kf, ...updates } : kf
    );

    updateTimeline({
      ...activeTimeline,
      keyframes: updatedKeyframes.sort((a, b) => a.t - b.t),
    });
  }, [activeTimeline, updateTimeline]);

  // Toggle timeline enabled
  const toggleTimelineEnabled = useCallback(() => {
    if (!activeTimeline) return;

    updateTimeline({
      ...activeTimeline,
      enabled: !activeTimeline.enabled,
    });
  }, [activeTimeline, updateTimeline]);

  // Convert canvas coordinates to timeline values
  const canvasToTimeline = useCallback((canvasX: number, canvasY: number, shiftKey: boolean = false): { t: number; value: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas || !paramDef) return null;

    const rect = canvas.getBoundingClientRect();
    let t = Math.max(0, Math.min(1, canvasX / rect.width));

    // Apply snapping to t (disabled when holding Shift)
    t = snapValue(t, gridSize, shiftKey);

    // Use fixed parameter range for consistent scaling
    const minValue = paramDef.minValue;
    const maxValue = paramDef.maxValue;
    const valueRange = maxValue - minValue;

    const normalizedY = 1 - (canvasY / rect.height);
    const value = minValue + normalizedY * valueRange;

    return { t, value };
  }, [paramDef, snapValue, gridSize]);

  // Find keyframe at canvas position
  const findKeyframeAt = useCallback((canvasX: number, canvasY: number, threshold: number = 12): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !activeTimeline || !paramDef) return null;

    const rect = canvas.getBoundingClientRect();
    const minValue = paramDef.minValue;
    const maxValue = paramDef.maxValue;
    const valueRange = maxValue - minValue;

    for (const kf of activeTimeline.keyframes) {
      const x = kf.t * rect.width;
      const y = rect.height - ((kf.value - minValue) / valueRange) * rect.height;

      const distance = Math.sqrt((canvasX - x) ** 2 + (canvasY - y) ** 2);
      if (distance <= threshold) {
        return kf.id;
      }
    }

    return null;
  }, [activeTimeline, paramDef]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Check if clicking on a keyframe
    const keyframeId = findKeyframeAt(canvasX, canvasY);

    if (keyframeId && activeTimeline) {
      const keyframe = activeTimeline.keyframes.find((kf) => kf.id === keyframeId);
      if (keyframe) {
        setDragState({
          keyframeId,
          startT: keyframe.t,
          startValue: keyframe.value,
          startMouseX: e.clientX,
          startMouseY: e.clientY,
        });
        setSelectedKeyframe(keyframeId);
        e.preventDefault();
      }
    } else {
      // Move scrubber
      const t = Math.max(0, Math.min(1, canvasX / rect.width));
      setScrubberPosition(t);
      setSelectedKeyframe(null);
    }
  }, [findKeyframeAt, activeTimeline]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    if (dragState) {
      // Dragging keyframe (hold Shift for free movement)
      const coords = canvasToTimeline(canvasX, canvasY, e.shiftKey);
      if (coords) {
        updateKeyframe(dragState.keyframeId, {
          t: coords.t,
          value: coords.value,
        });
      }
    } else {
      // Update hover state
      const keyframeId = findKeyframeAt(canvasX, canvasY);
      setHoveredKeyframe(keyframeId);
      canvas.style.cursor = keyframeId ? 'grab' : 'crosshair';
    }
  }, [dragState, canvasToTimeline, findKeyframeAt, updateKeyframe]);

  const handleMouseUp = useCallback(() => {
    if (dragState) {
      setDragState(null);
    }
  }, [dragState]);

  const handleMouseLeave = useCallback(() => {
    setHoveredKeyframe(null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'crosshair';
    }
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const keyframeId = findKeyframeAt(canvasX, canvasY);

    if (!keyframeId) {
      // Add keyframe at click position (respect Shift for free placement)
      const coords = canvasToTimeline(canvasX, canvasY, e.shiftKey);
      if (coords && selectedParam && paramDef) {
        const newKeyframe: Keyframe = {
          id: nanoid(),
          t: coords.t,
          value: coords.value,
          interpolation: 'linear',
        };

        if (activeTimeline) {
          const sortedKeyframes = [...activeTimeline.keyframes, newKeyframe].sort((a, b) => a.t - b.t);
          updateTimeline({
            ...activeTimeline,
            keyframes: sortedKeyframes,
          });
        } else {
          const newTimeline: Timeline = {
            id: nanoid(),
            paramName: selectedParam,
            keyframes: [newKeyframe],
            enabled: true,
          };
          updateTimeline(newTimeline);
        }

        setSelectedKeyframe(newKeyframe.id);
      }
    }
  }, [findKeyframeAt, canvasToTimeline, selectedParam, paramDef, activeTimeline, updateTimeline]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const keyframeId = findKeyframeAt(canvasX, canvasY);
    if (keyframeId) {
      setShowContextMenu({ x: e.clientX, y: e.clientY, keyframeId });
    }
  }, [findKeyframeAt]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedKeyframe || !activeTimeline) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        removeKeyframe(selectedKeyframe);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedKeyframe, activeTimeline, removeKeyframe]);

  // Close context menu on click
  useEffect(() => {
    if (showContextMenu) {
      const handleClick = () => setShowContextMenu(null);
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [showContextMenu]);

  // Set up ResizeObserver for responsive canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      // Trigger redraw on resize
      if (canvasRef.current) {
        const event = new Event('canvasResize');
        canvasRef.current.dispatchEvent(event);
      }
    });

    resizeObserver.observe(canvas);
    resizeObserverRef.current = resizeObserver;

    return () => {
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
    };
  }, []);

  // Draw timeline visualization
  useEffect(() => {
    if (!canvasRef.current || !selectedParam) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Set canvas resolution to match display size with pixel ratio for sharpness
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Scale context to match device pixel ratio
      ctx.scale(dpr, dpr);

      const width = rect.width;
      const height = rect.height;

      // Clear
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, width, height);

      // Grid lines (based on snap grid size)
      const numVerticalLines = Math.round(1 / gridSize);
      for (let i = 0; i <= numVerticalLines; i++) {
        const t = i * gridSize;
        const x = t * width;

        // Major grid lines every 10%
        const isMajor = Math.abs(t % 0.1) < 0.001;
        ctx.strokeStyle = isMajor ? '#444' : '#2a2a2a';
        ctx.lineWidth = isMajor ? 1 : 0.5;

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal grid lines
      for (let i = 0; i <= 5; i++) {
        const y = (i / 5) * height;
        ctx.strokeStyle = i === 0 || i === 5 ? '#444' : '#2a2a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Use fixed parameter range for consistent scaling
      const minValue = paramDef?.minValue || 0;
      const maxValue = paramDef?.maxValue || 1;
      const valueRange = maxValue - minValue;
      const defaultValue = paramDef?.defaultValue || 0;

      // Draw value range labels
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.fillText(maxValue.toFixed(1), 5, 12);
      ctx.fillText(minValue.toFixed(1), 5, height - 4);

      if (!activeTimeline || activeTimeline.keyframes.length === 0) {
        // Draw flat line for default value
        const defaultY = height - ((defaultValue - minValue) / valueRange) * height;
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, defaultY);
        ctx.lineTo(width, defaultY);
        ctx.stroke();
      } else {
        // Draw smooth interpolated curve
        ctx.strokeStyle = activeTimeline.enabled ? '#4a9eff' : '#666';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const sortedKeyframes = [...activeTimeline.keyframes].sort((a, b) => a.t - b.t);
        const numSamples = 200;

        for (let i = 0; i <= numSamples; i++) {
          const t = i / numSamples;
          const value = evaluateTimeline(t, sortedKeyframes, defaultValue);
          const x = t * width;
          const y = height - ((value - minValue) / valueRange) * height;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Draw keyframes
        sortedKeyframes.forEach((kf) => {
          const x = kf.t * width;
          const y = height - ((kf.value - minValue) / valueRange) * height;

          const isHovered = hoveredKeyframe === kf.id;
          const isSelected = selectedKeyframe === kf.id;
          const isDragging = dragState?.keyframeId === kf.id;

          // Outer glow for selected/hovered
          if (isSelected || isHovered || isDragging) {
            ctx.fillStyle = activeTimeline.enabled ? 'rgba(74, 158, 255, 0.3)' : 'rgba(102, 102, 102, 0.3)';
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.fill();
          }

          // Main circle
          const radius = isHovered || isSelected || isDragging ? 8 : 6;
          ctx.fillStyle = activeTimeline.enabled ? '#4a9eff' : '#666';
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();

          // White border
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw value label on hover/select
          if (isHovered || isSelected) {
            ctx.fillStyle = '#000';
            ctx.font = '11px monospace';
            const label = `t:${(kf.t * 100).toFixed(0)}% v:${kf.value.toFixed(2)}`;
            const metrics = ctx.measureText(label);
            const labelX = Math.max(5, Math.min(width - metrics.width - 10, x - metrics.width / 2));
            const labelY = y < height / 2 ? y + 25 : y - 15;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(labelX - 4, labelY - 12, metrics.width + 8, 16);

            ctx.fillStyle = '#fff';
            ctx.fillText(label, labelX, labelY);
          }
        });
      }

      // Draw scrubber
      const scrubberX = scrubberPosition * width;
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(scrubberX, 0);
      ctx.lineTo(scrubberX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Scrubber handle
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(scrubberX, 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    draw();

    // Listen for resize events
    const handleResize = () => draw();
    canvas.addEventListener('canvasResize', handleResize);

    return () => {
      canvas.removeEventListener('canvasResize', handleResize);
    };
  }, [selectedParam, activeTimeline, scrubberPosition, paramDef, hoveredKeyframe, selectedKeyframe, dragState, gridSize]);

  // Early return after all hooks
  if (!isOpen || !selectedFlowPath) {
    return null;
  }

  const selectedKf = selectedKeyframe && activeTimeline
    ? activeTimeline.keyframes.find((kf) => kf.id === selectedKeyframe)
    : null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '300px',
        backgroundColor: '#222',
        borderTop: '1px solid #444',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 15px',
          backgroundColor: '#2a2a2a',
          borderBottom: '1px solid #444',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Timeline Editor</h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#999',
            cursor: 'pointer',
            fontSize: '18px',
          }}
        >
          ×
        </button>
      </div>

      {/* Parameter info */}
      <div
        style={{
          padding: '10px 15px',
          backgroundColor: '#2a2a2a',
          borderBottom: '1px solid #444',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <label style={{ fontSize: '12px', color: '#aaa' }}>Parameter:</label>
        <span style={{ fontSize: '14px', color: '#fff', fontWeight: 500 }}>
          {paramDef?.label || selectedParam}
        </span>

        {selectedParam && (
          <>
            {activeTimeline && (
              <label style={{ fontSize: '12px', color: '#aaa', marginLeft: '20px' }}>
                <input
                  type="checkbox"
                  checked={activeTimeline.enabled}
                  onChange={toggleTimelineEnabled}
                  style={{ marginRight: '5px' }}
                />
                Enabled
              </label>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="checkbox"
                  checked={snapToGrid}
                  onChange={(e) => setSnapToGrid(e.target.checked)}
                  style={{ margin: 0 }}
                />
                Snap
              </label>

              <label style={{ fontSize: '11px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '5px' }}>
                Grid:
                <select
                  value={gridSize}
                  onChange={(e) => setGridSize(parseFloat(e.target.value))}
                  disabled={!snapToGrid}
                  style={{
                    padding: '2px 4px',
                    backgroundColor: '#444',
                    border: '1px solid #555',
                    borderRadius: '3px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                >
                  <option value={0.01}>1%</option>
                  <option value={0.05}>5%</option>
                  <option value={0.1}>10%</option>
                  <option value={0.25}>25%</option>
                </select>
              </label>

              <button
                onClick={addKeyframe}
                style={{
                  padding: '5px 15px',
                  backgroundColor: '#4a9eff',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Add Keyframe (K)
              </button>
            </div>

            <div style={{ fontSize: '11px', color: '#666', width: '100%', marginTop: '5px' }}>
              💡 Double-click to add • Drag to move • Delete to remove • Shift+drag for free movement
            </div>
          </>
        )}
      </div>

      {/* Timeline canvas */}
      {selectedParam && (
        <div style={{ flex: 1, padding: '15px', display: 'flex', gap: '15px', minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              style={{
                width: '100%',
                height: '100%',
                border: '1px solid #444',
                borderRadius: '4px',
                cursor: 'crosshair',
                display: 'block',
              }}
            />
          </div>

          {/* Keyframe properties panel */}
          {selectedKf && (
            <div
              style={{
                width: '200px',
                backgroundColor: '#2a2a2a',
                borderRadius: '4px',
                padding: '10px',
                overflowY: 'auto',
                maxHeight: '100%',
              }}
            >
              <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#aaa' }}>
                Keyframe Properties
              </h4>

              <label style={{ display: 'block', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '4px' }}>
                  Position (t)
                </span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={selectedKf.t.toFixed(2)}
                  onChange={(e) => updateKeyframe(selectedKf.id, { t: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '4px',
                    backgroundColor: '#444',
                    border: '1px solid #555',
                    borderRadius: '3px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '4px' }}>
                  Value
                </span>
                <input
                  type="number"
                  step="0.1"
                  value={selectedKf.value}
                  onChange={(e) => updateKeyframe(selectedKf.id, { value: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '4px',
                    backgroundColor: '#444',
                    border: '1px solid #555',
                    borderRadius: '3px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '4px' }}>
                  Interpolation
                </span>
                <select
                  value={selectedKf.interpolation}
                  onChange={(e) => updateKeyframe(selectedKf.id, { interpolation: e.target.value as InterpolationType })}
                  style={{
                    width: '100%',
                    padding: '4px',
                    backgroundColor: '#444',
                    border: '1px solid #555',
                    borderRadius: '3px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                >
                  <option value="linear">Linear</option>
                  <option value="ease">Ease</option>
                  <option value="sin">Sine</option>
                </select>
              </label>

              <button
                onClick={() => removeKeyframe(selectedKf.id)}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#ff6b6b',
                  border: 'none',
                  borderRadius: '3px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '11px',
                  marginTop: '10px',
                }}
              >
                Delete Keyframe (Del)
              </button>
            </div>
          )}
        </div>
      )}

      {!selectedParam && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            fontSize: '14px',
          }}
        >
          Select a parameter to edit its timeline
        </div>
      )}

      {/* Context menu */}
      {showContextMenu && activeTimeline && (
        <div
          style={{
            position: 'fixed',
            left: showContextMenu.x,
            top: showContextMenu.y,
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            padding: '4px 0',
            zIndex: 1000,
            minWidth: '150px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          {(['linear', 'ease', 'sin'] as InterpolationType[]).map((interp) => (
            <button
              key={interp}
              onClick={() => {
                updateKeyframe(showContextMenu.keyframeId, { interpolation: interp });
                setShowContextMenu(null);
              }}
              style={{
                width: '100%',
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '11px',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#333')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {interp.charAt(0).toUpperCase() + interp.slice(1)} Interpolation
            </button>
          ))}
          <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }} />
          <button
            onClick={() => {
              removeKeyframe(showContextMenu.keyframeId);
              setShowContextMenu(null);
            }}
            style={{
              width: '100%',
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#ff6b6b',
              cursor: 'pointer',
              fontSize: '11px',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#333')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Delete Keyframe
          </button>
        </div>
      )}
    </div>
  );
}
