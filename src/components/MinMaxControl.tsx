import React, { useState, useRef, useEffect } from 'react';
import type { MinMaxValue, AnimatableMinMaxValue, Timeline } from '../types';
import { isMinMaxValue, isAnimatableMinMaxValue } from '../types';
import { useDragNumber } from '../hooks/useDragNumber';
import { evaluateTimeline } from '../utils/interpolation';

interface MinMaxControlProps {
  label: string;
  value: MinMaxValue | number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: MinMaxValue | number) => void;
  onCreateTimeline?: () => void; // Optional callback to create timeline
  hasTimeline?: boolean; // Whether this parameter has an active timeline
  timeline?: Timeline; // The timeline object for preview
}

export const MinMaxControl: React.FC<MinMaxControlProps> = ({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit = '',
  onChange,
  onCreateTimeline,
  hasTimeline = false,
  timeline,
}) => {
  const timelineCanvasRef = useRef<HTMLCanvasElement>(null);
  // Determine if we're in range mode or single value mode
  const isRangeMode = isMinMaxValue(value);
  const [mode, setMode] = useState<'range' | 'single'>(isRangeMode ? 'range' : 'single');

  // Get current values
  const minValue = isMinMaxValue(value) ? value.min : value;
  const maxValue = isMinMaxValue(value) ? value.max : value;

  const handleMinChange = (newMin: number) => {
    if (mode === 'range') {
      const clampedMin = Math.max(min, Math.min(newMin, maxValue));
      onChange({ min: clampedMin, max: maxValue });
    }
  };

  const handleMaxChange = (newMax: number) => {
    if (mode === 'range') {
      const clampedMax = Math.min(max, Math.max(newMax, minValue));
      onChange({ min: minValue, max: clampedMax });
    }
  };

  const handleSingleChange = (newValue: number) => {
    if (mode === 'single') {
      const clamped = Math.max(min, Math.min(max, newValue));
      onChange(clamped);
    }
  };

  const toggleMode = () => {
    if (mode === 'range') {
      // Switch to single: use average of min/max
      const avg = (minValue + maxValue) / 2;
      onChange(avg);
      setMode('single');
    } else {
      // Switch to range: create a small range around the single value
      const spread = (max - min) * 0.1; // 10% of total range
      const newMin = Math.max(min, minValue - spread / 2);
      const newMax = Math.min(max, minValue + spread / 2);
      onChange({ min: newMin, max: newMax });
      setMode('range');
    }
  };

  // Drag-to-edit hooks for each value
  const minDrag = useDragNumber({
    value: minValue,
    onChange: handleMinChange,
    min,
    max: maxValue,
    step,
  });

  const maxDrag = useDragNumber({
    value: maxValue,
    onChange: handleMaxChange,
    min: minValue,
    max,
    step,
  });

  const singleDrag = useDragNumber({
    value: minValue,
    onChange: handleSingleChange,
    min,
    max,
    step,
  });

  // Draw timeline preview
  useEffect(() => {
    if (!timeline || !timelineCanvasRef.current) return;

    const canvas = timelineCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = timeline.enabled ? '#4a9eff' : '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    if (timeline.keyframes.length === 0) {
      // Draw flat line for default value
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    // Calculate default value from min/max
    const defaultValue = isMinMaxValue(value) ? (value.min + value.max) / 2 : value;

    // Find value range for scaling
    const values = timeline.keyframes.map((kf) => kf.value);
    const rangeMin = Math.min(...values, min);
    const rangeMax = Math.max(...values, max);
    const valueRange = rangeMax - rangeMin || 1;

    // Draw curve
    ctx.strokeStyle = timeline.enabled ? '#4a9eff' : '#666';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    // Sample the curve at multiple points
    const numSamples = 80;
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const curveValue = evaluateTimeline(t, timeline.keyframes, defaultValue);
      const x = t * width;
      const y = height - ((curveValue - rangeMin) / valueRange) * height * 0.8 - height * 0.1;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw keyframe dots
    const sortedKeyframes = [...timeline.keyframes].sort((a, b) => a.t - b.t);
    sortedKeyframes.forEach((kf) => {
      const x = kf.t * width;
      const y = height - ((kf.value - rangeMin) / valueRange) * height * 0.8 - height * 0.1;

      ctx.fillStyle = timeline.enabled ? '#4a9eff' : '#666';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [timeline, value, min, max]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {/* First row: min/max controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '10px',
        marginTop: '6px',
      }}>
      {/* Label */}
      <label style={{
        color: '#aaa',
        whiteSpace: 'nowrap',
        minWidth: '60px',
      }}>
        {label} {unit && `(${unit})`}:
      </label>

      {/* Inputs */}
      {mode === 'range' ? (
        <>
          {/* Min Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#888', fontSize: '9px' }}>Min:</span>
            <input
              type="number"
              value={minDrag.displayValue}
              onChange={(e) => handleMinChange(parseFloat(e.target.value))}
              onMouseDown={minDrag.onMouseDown}
              step={step}
              min={min}
              max={maxValue}
              title="Click and drag up/down to adjust (Shift for fine control)"
              style={{
                width: '60px',
                padding: '4px 6px',
                backgroundColor: minDrag.isDragging ? '#3a3a3a' : '#2a2a2a',
                border: `1px solid ${minDrag.isDragging ? '#4a9eff' : '#444'}`,
                borderRadius: '3px',
                color: '#fff',
                fontSize: '10px',
                cursor: minDrag.cursorStyle,
                transition: 'background-color 0.1s, border-color 0.1s',
              }}
            />
          </div>

          {/* Max Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#888', fontSize: '9px' }}>Max:</span>
            <input
              type="number"
              value={maxDrag.displayValue}
              onChange={(e) => handleMaxChange(parseFloat(e.target.value))}
              onMouseDown={maxDrag.onMouseDown}
              step={step}
              min={minValue}
              max={max}
              title="Click and drag up/down to adjust (Shift for fine control)"
              style={{
                width: '60px',
                padding: '4px 6px',
                backgroundColor: maxDrag.isDragging ? '#3a3a3a' : '#2a2a2a',
                border: `1px solid ${maxDrag.isDragging ? '#4a9eff' : '#444'}`,
                borderRadius: '3px',
                color: '#fff',
                fontSize: '10px',
                cursor: maxDrag.cursorStyle,
                transition: 'background-color 0.1s, border-color 0.1s',
              }}
            />
          </div>
        </>
      ) : (
        <>
          {/* Single Value Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
            <span style={{ color: '#888', fontSize: '9px' }}>Value:</span>
            <input
              type="number"
              value={singleDrag.displayValue}
              onChange={(e) => handleSingleChange(parseFloat(e.target.value))}
              onMouseDown={singleDrag.onMouseDown}
              step={step}
              min={min}
              max={max}
              title="Click and drag up/down to adjust (Shift for fine control)"
              style={{
                flex: 1,
                maxWidth: '130px',
                padding: '4px 6px',
                backgroundColor: singleDrag.isDragging ? '#3a3a3a' : '#2a2a2a',
                border: `1px solid ${singleDrag.isDragging ? '#4a9eff' : '#444'}`,
                borderRadius: '3px',
                color: '#fff',
                fontSize: '10px',
                cursor: singleDrag.cursorStyle,
                transition: 'background-color 0.1s, border-color 0.1s',
              }}
            />
          </div>
        </>
      )}

      {/* Toggle Button */}
      <button
        onClick={toggleMode}
        title={mode === 'range' ? 'Switch to single value' : 'Switch to range'}
        style={{
          padding: '4px 8px',
          backgroundColor: mode === 'range' ? '#4a9eff' : '#2a2a2a',
          border: '1px solid #444',
          borderRadius: '3px',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '10px',
          whiteSpace: 'nowrap',
        }}
      >
        {mode === 'range' ? '🔗' : '○'}
      </button>

      {/* Timeline Button (only show in range mode and if callback provided) */}
      {mode === 'range' && onCreateTimeline && (
        <button
          onClick={onCreateTimeline}
          title={hasTimeline ? 'Edit timeline animation' : 'Add timeline animation'}
          style={{
            padding: '4px 8px',
            backgroundColor: hasTimeline ? '#4a9eff' : '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '3px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '10px',
            whiteSpace: 'nowrap',
          }}
        >
          ⏱
        </button>
      )}
      </div>

      {/* Second row: timeline preview (if timeline exists) */}
      {timeline && timeline.keyframes.length > 0 && (
        <div
          onClick={onCreateTimeline}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 6px',
            backgroundColor: '#1a1a1a',
            borderRadius: '3px',
            cursor: onCreateTimeline ? 'pointer' : 'default',
            transition: 'background-color 0.15s',
            marginLeft: '68px', // Align with inputs (label width + gap)
          }}
          onMouseEnter={(e) => {
            if (onCreateTimeline) {
              e.currentTarget.style.backgroundColor = '#252525';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#1a1a1a';
          }}
        >
          <canvas
            ref={timelineCanvasRef}
            width={120}
            height={24}
            style={{
              width: '120px',
              height: '24px',
              display: 'block',
            }}
          />
          <div style={{ flex: 1, fontSize: '9px', color: '#888' }}>
            {timeline.enabled ? (
              <span style={{ color: '#4a9eff' }}>
                {timeline.keyframes.length} keyframe{timeline.keyframes.length !== 1 ? 's' : ''}
              </span>
            ) : (
              <span>Timeline (disabled)</span>
            )}
          </div>
          {onCreateTimeline && (
            <div
              style={{
                fontSize: '9px',
                color: '#666',
                whiteSpace: 'nowrap',
              }}
            >
              Click to edit
            </div>
          )}
        </div>
      )}
    </div>
  );
};
