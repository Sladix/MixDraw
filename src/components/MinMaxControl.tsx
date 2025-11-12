import React, { useState } from 'react';
import type { MinMaxValue } from '../types';
import { isMinMaxValue } from '../types';

interface MinMaxControlProps {
  label: string;
  value: MinMaxValue | number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: MinMaxValue | number) => void;
}

export const MinMaxControl: React.FC<MinMaxControlProps> = ({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit = '',
  onChange,
}) => {
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

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '10px',
      marginTop: '6px',
      marginBottom: '4px',
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
              value={minValue.toFixed(2)}
              onChange={(e) => handleMinChange(parseFloat(e.target.value))}
              step={step}
              min={min}
              max={maxValue}
              style={{
                width: '60px',
                padding: '4px 6px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '3px',
                color: '#fff',
                fontSize: '10px',
              }}
            />
          </div>

          {/* Max Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#888', fontSize: '9px' }}>Max:</span>
            <input
              type="number"
              value={maxValue.toFixed(2)}
              onChange={(e) => handleMaxChange(parseFloat(e.target.value))}
              step={step}
              min={minValue}
              max={max}
              style={{
                width: '60px',
                padding: '4px 6px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '3px',
                color: '#fff',
                fontSize: '10px',
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
              value={minValue.toFixed(2)}
              onChange={(e) => handleSingleChange(parseFloat(e.target.value))}
              step={step}
              min={min}
              max={max}
              style={{
                flex: 1,
                maxWidth: '130px',
                padding: '4px 6px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '3px',
                color: '#fff',
                fontSize: '10px',
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
    </div>
  );
};
