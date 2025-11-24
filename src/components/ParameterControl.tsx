import type { ParamDefinition, Timeline } from '../types';
import { MinMaxControl } from './MinMaxControl';

interface ParameterControlProps {
  paramDef: ParamDefinition;
  value: any;
  onChange: (value: any) => void;
  onCreateTimeline?: () => void;
  hasTimeline?: boolean;
  timeline?: Timeline;
}

/**
 * Unified parameter control component for rendering different parameter types
 * Used by both FlowPathPropertiesPanel and StandaloneGeneratorPropertiesPanel
 */
export function ParameterControl({
  paramDef,
  value: currentValue,
  onChange,
  onCreateTimeline,
  hasTimeline = false,
  timeline,
}: ParameterControlProps) {
  const value = currentValue !== undefined ? currentValue : paramDef.defaultValue;

  switch (paramDef.type) {
    case 'slider':
    case 'number':
      return (
        <label
          key={paramDef.name}
          style={{ display: 'block', fontSize: '10px', marginTop: '6px', marginBottom: '4px' }}
        >
          {paramDef.label}: {typeof value === 'number' ? value.toFixed(2) : value}
          <input
            type="range"
            min={paramDef.min}
            max={paramDef.max}
            step={paramDef.step || 0.1}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '2px',
            }}
          />
        </label>
      );

    case 'checkbox':
      return (
        <label
          key={paramDef.name}
          style={{ display: 'flex', alignItems: 'center', fontSize: '10px', marginTop: '6px', cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
            style={{ marginRight: '6px', cursor: 'pointer' }}
          />
          {paramDef.label}
        </label>
      );

    case 'select':
      return (
        <label key={paramDef.name} style={{ display: 'block', fontSize: '10px', marginTop: '6px' }}>
          {paramDef.label}
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '4px',
              marginTop: '2px',
              backgroundColor: '#1a1a1a',
              color: 'white',
              border: '1px solid #333',
              borderRadius: '3px',
              fontSize: '10px',
            }}
          >
            {paramDef.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      );

    case 'minmax':
      return (
        <MinMaxControl
          key={paramDef.name}
          label={paramDef.label}
          value={value}
          min={paramDef.min || 0}
          max={paramDef.max || 100}
          step={paramDef.step}
          unit={paramDef.unit}
          onChange={onChange}
          onCreateTimeline={onCreateTimeline}
          hasTimeline={hasTimeline}
          timeline={timeline}
        />
      );

    default:
      return null;
  }
}
