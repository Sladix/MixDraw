import React from 'react';
import type { AnyModifier, CurveType } from '../types';

interface Props {
  modifier: AnyModifier;
  onUpdate: (updates: Partial<AnyModifier>) => void;
  onRemove: () => void;
}

/**
 * Control panel for a single modifier
 * Displays controls for t-range, value range, and curve type
 */
export function ModifierControl({ modifier, onUpdate, onRemove }: Props) {
  const getModifierLabel = () => {
    switch (modifier.type) {
      case 'size':
        return 'Size Multiplier';
      case 'rotation':
        return 'Rotation Offset';
      case 'spacing':
        return 'Spacing Multiplier';
      case 'spread':
        return 'Spread Width';
    }
  };

  const getValueLabel = () => {
    switch (modifier.type) {
      case 'size':
        return 'x';
      case 'rotation':
        return '°';
      case 'spacing':
        return 'x';
      case 'spread':
        return 'mm';
    }
  };

  const getValueStep = () => {
    switch (modifier.type) {
      case 'size':
        return 0.1;
      case 'rotation':
        return 5;
      case 'spacing':
        return 0.1;
      case 'spread':
        return 1;
    }
  };

  return (
    <div
      style={{
        padding: '12px',
        backgroundColor: '#1a1a1a',
        borderRadius: '4px',
        border: modifier.enabled ? '1px solid #4a9eff' : '1px solid #333',
      }}
    >
      {/* Header with checkbox and remove button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={modifier.enabled}
            onChange={(e) => onUpdate({ enabled: e.target.checked })}
          />
          <span style={{ fontSize: '12px', fontWeight: 600, color: modifier.enabled ? '#fff' : '#888' }}>
            {getModifierLabel()}
          </span>
        </label>
        <button
          onClick={onRemove}
          style={{
            fontSize: '11px',
            padding: '4px 10px',
            backgroundColor: '#ff4444',
            border: 'none',
            borderRadius: '3px',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Remove
        </button>
      </div>

      {/* T Range Controls */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '6px' }}>
          Apply Range
        </label>
        {/* Start T */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', color: '#666', width: '35px' }}>Start</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={modifier.tStart}
            onChange={(e) => onUpdate({ tStart: parseFloat(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '10px', color: '#888', width: '35px', textAlign: 'right' }}>
            {modifier.tStart.toFixed(2)}
          </span>
        </div>
        {/* End T */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: '#666', width: '35px' }}>End</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={modifier.tEnd}
            onChange={(e) => onUpdate({ tEnd: parseFloat(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '10px', color: '#888', width: '35px', textAlign: 'right' }}>
            {modifier.tEnd.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Value Range Controls */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '6px' }}>
          Value Range
        </label>
        {/* Start Value */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', color: '#666', width: '35px' }}>Start</span>
          <input
            type="number"
            value={modifier.valueStart}
            onChange={(e) => onUpdate({ valueStart: parseFloat(e.target.value) || 0 })}
            step={getValueStep()}
            style={{
              flex: 1,
              padding: '4px 8px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '3px',
              color: '#fff',
              fontSize: '11px',
            }}
          />
          <span style={{ fontSize: '10px', color: '#888', width: '35px', textAlign: 'right' }}>
            {getValueLabel()}
          </span>
        </div>
        {/* End Value */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: '#666', width: '35px' }}>End</span>
          <input
            type="number"
            value={modifier.valueEnd}
            onChange={(e) => onUpdate({ valueEnd: parseFloat(e.target.value) || 0 })}
            step={getValueStep()}
            style={{
              flex: 1,
              padding: '4px 8px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '3px',
              color: '#fff',
              fontSize: '11px',
            }}
          />
          <span style={{ fontSize: '10px', color: '#888', width: '35px', textAlign: 'right' }}>
            {getValueLabel()}
          </span>
        </div>
      </div>

      {/* Curve Type Selector */}
      <div>
        <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '6px' }}>
          Interpolation Curve
        </label>
        <select
          value={modifier.curve}
          onChange={(e) => onUpdate({ curve: e.target.value as CurveType })}
          style={{
            width: '100%',
            padding: '6px 8px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '3px',
            color: '#fff',
            fontSize: '11px',
          }}
        >
          <option value="linear">Linear</option>
          <option value="ease-in">Ease In (slow → fast)</option>
          <option value="ease-out">Ease Out (fast → slow)</option>
          <option value="ease-in-out">Ease In-Out (slow → fast → slow)</option>
          <option value="sine">Sine Wave</option>
        </select>
      </div>
    </div>
  );
}
