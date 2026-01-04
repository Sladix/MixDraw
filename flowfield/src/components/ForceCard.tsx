import React from 'react';
import { useFlowFieldStore } from '../store/useFlowFieldStore';
import { MinMaxControl } from '../shared';
import { FormulaInput } from './FormulaInput';
import type { Force, NoiseForce, CircularForce, FormulaForce } from '../core/types';
import { analytics } from '../core/analytics';

interface ForceCardProps {
  force: Force;
}

export const ForceCard: React.FC<ForceCardProps> = ({ force }) => {
  const updateForce = useFlowFieldStore((s) => s.updateForce);
  const updateForceParams = useFlowFieldStore((s) => s.updateForceParams);
  const removeForce = useFlowFieldStore((s) => s.removeForce);
  const toggleForce = useFlowFieldStore((s) => s.toggleForce);

  const [isExpanded, setIsExpanded] = React.useState(true);

  const getForceIcon = () => {
    switch (force.type) {
      case 'noise':
        return '🌊';
      case 'circular':
        return '🔄';
      case 'formula':
        return '📐';
      default:
        return '⚡';
    }
  };

  return (
    <div
      style={{
        backgroundColor: force.enabled ? '#2a2a2a' : '#222',
        borderRadius: '6px',
        border: `1px solid ${force.enabled ? '#444' : '#333'}`,
        overflow: 'hidden',
        opacity: force.enabled ? 1 : 0.6,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 10px',
          borderBottom: isExpanded ? '1px solid #333' : 'none',
        }}
      >
        {/* Toggle enabled */}
        <input
          type="checkbox"
          checked={force.enabled}
          onChange={() => {
            toggleForce(force.id);
            analytics.toggleForce(force.type, !force.enabled);
          }}
          style={{ margin: 0 }}
        />

        {/* Icon */}
        <span style={{ fontSize: '14px' }}>{getForceIcon()}</span>

        {/* Name */}
        <input
          type="text"
          value={force.name}
          onChange={(e) => updateForce(force.id, { name: e.target.value })}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 500,
            padding: '2px 4px',
            borderRadius: '2px',
          }}
          onFocus={(e) => {
            e.currentTarget.style.backgroundColor = '#333';
          }}
          onBlur={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        />

        {/* Expand/Collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            padding: '2px 6px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#888',
            fontSize: '10px',
            cursor: 'pointer',
          }}
        >
          {isExpanded ? '▼' : '▶'}
        </button>

        {/* Delete */}
        <button
          onClick={() => {
            removeForce(force.id);
            analytics.removeForce(force.type);
          }}
          style={{
            padding: '2px 6px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#f66',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div style={{ padding: '10px' }}>
          {/* Weight - common to all forces */}
          <MinMaxControl
            label="Weight"
            value={force.weight}
            min={0}
            max={1}
            step={0.1}
            onChange={(value) => updateForce(force.id, { weight: value })}
          />

          {/* Type-specific params */}
          <div style={{ marginTop: '10px' }}>
            {force.type === 'noise' && (
              <NoiseParams
                force={force}
                onUpdate={(params) => updateForceParams(force.id, params)}
              />
            )}
            {force.type === 'circular' && (
              <CircularParams
                force={force}
                onUpdate={(params) => updateForceParams(force.id, params)}
              />
            )}
            {force.type === 'formula' && (
              <FormulaParams
                force={force}
                onUpdate={(params) => updateForceParams(force.id, params)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Type-specific Parameter Components
// ============================================================================

const NoiseParams: React.FC<{
  force: NoiseForce;
  onUpdate: (params: Partial<NoiseForce['params']>) => void;
}> = ({ force, onUpdate }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <MinMaxControl
      label="Scale"
      value={force.params.scale}
      min={20}
      max={500}
      step={10}
      onChange={(value) => onUpdate({ scale: value })}
    />
    <ParamRow label="Complexity">
      <input
        type="range"
        min={0.5}
        max={3}
        step={0.1}
        value={force.params.complexity}
        onChange={(e) => onUpdate({ complexity: Number(e.target.value) })}
        style={sliderStyle}
      />
      <span style={valueStyle}>{force.params.complexity.toFixed(1)}</span>
    </ParamRow>
    <ParamRow label="Octaves">
      <input
        type="range"
        min={1}
        max={4}
        step={1}
        value={force.params.octaves}
        onChange={(e) => onUpdate({ octaves: Number(e.target.value) })}
        style={sliderStyle}
      />
      <span style={valueStyle}>{force.params.octaves}</span>
    </ParamRow>
  </div>
);

const CircularParams: React.FC<{
  force: CircularForce;
  onUpdate: (params: Partial<CircularForce['params']>) => void;
}> = ({ force, onUpdate }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <ParamRow label="Mode">
      <select
        value={force.params.mode}
        onChange={(e) =>
          onUpdate({ mode: e.target.value as CircularForce['params']['mode'] })
        }
        style={selectStyle}
      >
        <option value="tangent">Tangent</option>
        <option value="radial">Radial</option>
        <option value="spiral">Spiral</option>
      </select>
    </ParamRow>
    <ParamRow label="Center X">
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={force.params.centerX}
        onChange={(e) => onUpdate({ centerX: Number(e.target.value) })}
        style={sliderStyle}
      />
      <span style={valueStyle}>{force.params.centerX.toFixed(2)}</span>
    </ParamRow>
    <ParamRow label="Center Y">
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={force.params.centerY}
        onChange={(e) => onUpdate({ centerY: Number(e.target.value) })}
        style={sliderStyle}
      />
      <span style={valueStyle}>{force.params.centerY.toFixed(2)}</span>
    </ParamRow>
    <MinMaxControl
      label="Frequency"
      value={force.params.frequency}
      min={0.5}
      max={10}
      step={0.5}
      onChange={(value) => onUpdate({ frequency: value })}
    />
  </div>
);

const FormulaParams: React.FC<{
  force: FormulaForce;
  onUpdate: (params: Partial<FormulaForce['params']>) => void;
}> = ({ force, onUpdate }) => (
  <div>
    <FormulaInput
      value={force.params.expression}
      onChange={(expression) => onUpdate({ expression })}
    />
  </div>
);

// ============================================================================
// Helper Components & Styles
// ============================================================================

const ParamRow: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}
  >
    <span
      style={{
        fontSize: '10px',
        color: '#aaa',
        minWidth: '70px',
      }}
    >
      {label}
    </span>
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
      {children}
    </div>
  </div>
);

const sliderStyle: React.CSSProperties = {
  flex: 1,
  height: '4px',
  accentColor: '#4a9eff',
};

const selectStyle: React.CSSProperties = {
  flex: 1,
  padding: '4px 6px',
  backgroundColor: '#1a1a1a',
  border: '1px solid #444',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '10px',
};

const valueStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#888',
  minWidth: '30px',
  textAlign: 'right',
};
