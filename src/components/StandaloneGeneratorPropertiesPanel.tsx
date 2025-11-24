import { useStore } from '../store/useStore';
import { GeneratorRegistry } from '../core/GeneratorRegistry';
import type { ParamDefinition } from '../types';
import { ParameterControl } from './ParameterControl';
import { useTimeline } from '../contexts/TimelineContext';

export function StandaloneGeneratorPropertiesPanel() {
  const project = useStore((state) => state.project);
  const selection = useStore((state) => state.selection);
  const updateStandaloneGenerator = useStore((state) => state.updateStandaloneGenerator);
  const { openTimelinePanel } = useTimeline();

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
    // Build timeline parameter name for standalone generator (e.g., "standalone.gen123.size")
    const timelineParamName = `standalone.${selection.id}.${paramDef.name}`;

    // Check if there's an active timeline for this parameter
    // Note: Standalone generators don't currently have timeline support in the data model
    // but we're setting up the infrastructure for future support
    const hasTimeline = false; // TODO: Add timeline support to StandaloneGenerator type
    const paramTimeline = undefined;

    return (
      <ParameterControl
        key={paramDef.name}
        paramDef={paramDef}
        value={currentValue}
        onChange={onChange}
        onCreateTimeline={() => openTimelinePanel(timelineParamName)}
        hasTimeline={hasTimeline}
        timeline={paramTimeline}
      />
    );
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
