import React, { useState, useRef, useEffect } from 'react';
import type { MinMaxValue, Timeline } from '../types';
import { isMinMaxValue } from '../types';
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

// Reusable input component that handles drag-to-edit and click-to-type
interface DeferredNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  label?: string;
}

const DeferredNumberInput: React.FC<DeferredNumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step,
  label,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState('');

  const drag = useDragNumber({
    value,
    onChange,
    min,
    max,
    step,
    deferred: true, // Enable deferred mode for performance
  });

  // Focus input when entering edit mode
  useEffect(() => {
    if (drag.isEditing && inputRef.current) {
      setEditValue(drag.displayValue);
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [drag.isEditing, drag.displayValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const parsed = parseFloat(editValue);
      if (!isNaN(parsed)) {
        drag.commitEdit(parsed);
      } else {
        drag.setIsEditing(false);
      }
    } else if (e.key === 'Escape') {
      drag.setIsEditing(false);
    }
  };

  const handleBlur = () => {
    if (drag.isEditing) {
      const parsed = parseFloat(editValue);
      if (!isNaN(parsed)) {
        drag.commitEdit(parsed);
      } else {
        drag.setIsEditing(false);
      }
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {label && <span style={{ color: '#888', fontSize: '9px' }}>{label}:</span>}
      <input
        ref={inputRef}
        type={drag.isEditing ? 'text' : 'number'}
        value={drag.isEditing ? editValue : drag.displayValue}
        onChange={(e) => {
          if (drag.isEditing) {
            setEditValue(e.target.value);
          }
        }}
        onMouseDown={drag.onMouseDown}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        step={step}
        min={min}
        max={max}
        readOnly={!drag.isEditing}
        title="Drag up/down to adjust • Click to type • Shift for fine control"
        style={{
          width: '60px',
          padding: '4px 6px',
          backgroundColor: drag.isDragging ? '#3a3a3a' : drag.isEditing ? '#2d3748' : '#2a2a2a',
          border: `1px solid ${drag.isDragging ? '#4a9eff' : drag.isEditing ? '#68d391' : '#444'}`,
          borderRadius: '3px',
          color: '#fff',
          fontSize: '10px',
          cursor: drag.isEditing ? 'text' : 'ns-resize',
          transition: 'background-color 0.1s, border-color 0.1s',
          outline: 'none',
        }}
      />
    </div>
  );
};

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
      {/* Label */}
      <label style={{
        color: '#aaa',
        whiteSpace: 'nowrap',
        minWidth: '60px',
        fontSize: '10px',
      }}>
        {label} {unit && `(${unit})`}:
      </label>
      {/* First row: min/max controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '10px',
        marginTop: '6px',
      }}>

      {/* Inputs */}
      {mode === 'range' ? (
        <>
          <DeferredNumberInput
            value={minValue}
            onChange={handleMinChange}
            min={min}
            max={maxValue}
            step={step}
            label="Min"
          />
          <DeferredNumberInput
            value={maxValue}
            onChange={handleMaxChange}
            min={minValue}
            max={max}
            step={step}
            label="Max"
          />
        </>
      ) : (
        <DeferredNumberInput
          value={minValue}
          onChange={handleSingleChange}
          min={min}
          max={max}
          step={step}
          label="Value"
        />
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
