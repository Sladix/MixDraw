import { useStore } from '../store/useStore';
import { GeneratorRegistry } from '../core/GeneratorRegistry';
import type { ParamDefinition } from '../types';
import { MinMaxControl } from './MinMaxControl';

export function StandaloneGeneratorPropertiesPanel() {
  const project = useStore((state) => state.project);
  const selection = useStore((state) => state.selection);
  const updateStandaloneGenerator = useStore((state) => state.updateStandaloneGenerator);

  if (selection.type !== 'standaloneGenerator' || !selection.id) {
    return null;
  }

  // Find the selected standalone generator
  let selectedGenerator = null;
  for (const layer of project.layers) {
    const gen = layer.standaloneGenerators.find((g) => g.id === selection.id);
    if (gen) {
      selectedGenerator = gen;
      break;
    }
  }

  if (!selectedGenerator) {
    return null;
  }

  const generator = GeneratorRegistry.get(selectedGenerator.generatorType);
  const paramDefs = generator?.getParamDefinitions() || [];

  const handleParamChange = (paramName: string, value: any) => {
    updateStandaloneGenerator(selection.id, {
      params: {
        ...selectedGenerator.params,
        [paramName]: value,
      },
    });
  };

  const handlePositionChange = (axis: 'x' | 'y', value: number) => {
    updateStandaloneGenerator(selection.id, {
      position: {
        ...selectedGenerator.position,
        [axis]: value,
      },
    });
  };

  const handleRotationChange = (rotation: number) => {
    updateStandaloneGenerator(selection.id, { rotation });
  };

  const handleScaleChange = (scale: number) => {
    updateStandaloneGenerator(selection.id, { scale });
  };

  const renderParamControl = (
    paramDef: ParamDefinition,
    currentValue: any,
    onChange: (value: any) => void
  ) => {
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
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#1a1a1a',
        borderRadius: '6px',
        marginTop: '12px',
      }}
    >
      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#4a9eff' }}>
        Standalone Generator
      </h4>

      <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '12px', textTransform: 'capitalize' }}>
        {selectedGenerator.generatorType}
      </div>

      {/* Transform Controls */}
      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#aaa' }}>
          Transform
        </h5>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '10px' }}>
            X: {selectedGenerator.position.x.toFixed(0)}
            <input
              type="number"
              value={selectedGenerator.position.x.toFixed(0)}
              onChange={(e) => handlePositionChange('x', parseFloat(e.target.value))}
              style={{
                display: 'block',
                width: '100%',
                padding: '4px',
                marginTop: '2px',
                backgroundColor: '#2a2a2a',
                color: 'white',
                border: '1px solid #444',
                borderRadius: '3px',
                fontSize: '10px',
              }}
            />
          </label>

          <label style={{ display: 'block', fontSize: '10px' }}>
            Y: {selectedGenerator.position.y.toFixed(0)}
            <input
              type="number"
              value={selectedGenerator.position.y.toFixed(0)}
              onChange={(e) => handlePositionChange('y', parseFloat(e.target.value))}
              style={{
                display: 'block',
                width: '100%',
                padding: '4px',
                marginTop: '2px',
                backgroundColor: '#2a2a2a',
                color: 'white',
                border: '1px solid #444',
                borderRadius: '3px',
                fontSize: '10px',
              }}
            />
          </label>
        </div>

        <label style={{ display: 'block', fontSize: '10px', marginBottom: '8px' }}>
          Rotation: {selectedGenerator.rotation.toFixed(0)}°
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={selectedGenerator.rotation}
            onChange={(e) => handleRotationChange(parseFloat(e.target.value))}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '2px',
            }}
          />
        </label>

        <label style={{ display: 'block', fontSize: '10px' }}>
          Scale: {selectedGenerator.scale.toFixed(2)}x
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={selectedGenerator.scale}
            onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '2px',
            }}
          />
        </label>
      </div>

      {/* Generator Parameters */}
      {paramDefs.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#aaa' }}>
            Generator Parameters
          </h5>
          {paramDefs.map((paramDef) =>
            renderParamControl(
              paramDef,
              selectedGenerator.params[paramDef.name],
              (value) => handleParamChange(paramDef.name, value)
            )
          )}
        </div>
      )}

      {/* Seed Display */}
      <div style={{ fontSize: '10px', color: '#666', marginTop: '12px' }}>
        Seed: {selectedGenerator.seed}
      </div>
    </div>
  );
}
