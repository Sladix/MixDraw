import { useStore } from '../store/useStore';
import { GeneratorRegistry } from '../core/GeneratorRegistry';
import type { ParamDefinition } from '../types';

export function FlowPathPropertiesPanel() {
  const project = useStore((state) => state.project);
  const selection = useStore((state) => state.selection);
  const updateFlowPath = useStore((state) => state.updateFlowPath);

  if (selection.type !== 'flowPath' || !selection.id) {
    return null;
  }

  // Find the selected FlowPath
  let selectedFlowPath = null;
  for (const layer of project.layers) {
    const fp = layer.flowPaths.find((f) => f.id === selection.id);
    if (fp) {
      selectedFlowPath = fp;
      break;
    }
  }

  if (!selectedFlowPath) {
    return null;
  }

  const handleDistributionChange = (key: string, value: any) => {
    updateFlowPath(selection.id, {
      distributionParams: {
        ...selectedFlowPath.distributionParams,
        [key]: value,
      },
    });
  };

  const handleFlowChange = (key: string, value: any) => {
    updateFlowPath(selection.id, {
      flowParams: {
        ...selectedFlowPath.flowParams,
        [key]: value,
      },
    });
  };

  const handleClosedChange = (closed: boolean) => {
    updateFlowPath(selection.id, {
      closed,
    });
  };

  const handleGeneratorFollowNormalChange = (generatorId: string, followNormal: boolean) => {
    const updatedGenerators = selectedFlowPath.generators.map((gen) =>
      gen.id === generatorId ? { ...gen, followNormal } : gen
    );
    updateFlowPath(selection.id, {
      generators: updatedGenerators,
    });
  };

  const handleGeneratorParamChange = (generatorId: string, paramName: string, value: any) => {
    const updatedGenerators = selectedFlowPath.generators.map((gen) =>
      gen.id === generatorId
        ? { ...gen, params: { ...gen.params, [paramName]: value } }
        : gen
    );
    updateFlowPath(selection.id, {
      generators: updatedGenerators,
    });
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
        FlowPath Properties
      </h4>

      {/* Path Shape */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', fontSize: '11px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selectedFlowPath.closed || false}
            onChange={(e) => handleClosedChange(e.target.checked)}
            style={{
              marginRight: '8px',
              cursor: 'pointer',
            }}
          />
          Close Shape
          <span style={{ fontSize: '10px', color: '#888', marginLeft: '8px' }}>
            (Connect last to first point)
          </span>
        </label>
      </div>

      {/* Distribution Parameters */}
      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#aaa' }}>
          Distribution
        </h5>

        <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>
          Mode
          <select
            value={selectedFlowPath.distributionParams.mode}
            onChange={(e) => handleDistributionChange('mode', e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '6px',
              marginTop: '4px',
              backgroundColor: '#2a2a2a',
              color: 'white',
              border: '1px solid #444',
              borderRadius: '3px',
            }}
          >
            <option value="linear">Linear</option>
            <option value="noise">Perlin Noise</option>
            <option value="random">Random</option>
          </select>
        </label>

        <label style={{ display: 'block', fontSize: '11px', marginTop: '8px', marginBottom: '4px' }}>
          Density: {selectedFlowPath.distributionParams.density.toFixed(2)} total shapes/mm
          {selectedFlowPath.generators.length > 1 && (
            <span style={{ fontSize: '9px', color: '#666', marginLeft: '6px' }}>
              ({selectedFlowPath.generators.length} gen × {(selectedFlowPath.distributionParams.density / selectedFlowPath.generators.length).toFixed(2)}/mm each)
            </span>
          )}
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={selectedFlowPath.distributionParams.density}
            onChange={(e) => handleDistributionChange('density', parseFloat(e.target.value))}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '4px',
            }}
          />
        </label>

        {/* Perlin Noise Controls */}
        {selectedFlowPath.distributionParams.mode === 'noise' && (
          <>
            <label style={{ display: 'block', fontSize: '11px', marginTop: '8px', marginBottom: '4px' }}>
              Noise Scale: {(selectedFlowPath.distributionParams.noiseScale || 0.3).toFixed(2)}
              <span style={{ fontSize: '9px', color: '#666', marginLeft: '6px' }}>
                (frequency)
              </span>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={selectedFlowPath.distributionParams.noiseScale || 0.3}
                onChange={(e) => handleDistributionChange('noiseScale', parseFloat(e.target.value))}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                }}
              />
            </label>

            <label style={{ display: 'block', fontSize: '11px', marginTop: '8px', marginBottom: '4px' }}>
              Noise Strength: {(selectedFlowPath.distributionParams.noiseStrength || 1.0).toFixed(2)}
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={selectedFlowPath.distributionParams.noiseStrength || 1.0}
                onChange={(e) => handleDistributionChange('noiseStrength', parseFloat(e.target.value))}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                }}
              />
            </label>

            <label style={{ display: 'block', fontSize: '11px', marginTop: '8px', marginBottom: '4px' }}>
              Cluster Threshold: {selectedFlowPath.distributionParams.noiseThreshold !== undefined ? selectedFlowPath.distributionParams.noiseThreshold.toFixed(2) : 'off'}
              <span style={{ fontSize: '9px', color: '#666', marginLeft: '6px' }}>
                (creates clusters)
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={selectedFlowPath.distributionParams.noiseThreshold ?? 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  handleDistributionChange('noiseThreshold', val === 0 ? undefined : val);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '4px',
                }}
              />
            </label>
          </>
        )}
      </div>

      {/* Generators */}
      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#aaa' }}>
          Generators ({selectedFlowPath.generators.length})
        </h5>
        {selectedFlowPath.generators.map((gen, index) => {
          const generator = GeneratorRegistry.get(gen.type);
          const paramDefs = generator?.getParamDefinitions() || [];

          return (
            <div
              key={gen.id}
              style={{
                padding: '10px',
                backgroundColor: '#222',
                borderRadius: '4px',
                marginBottom: '8px',
                border: '1px solid #333',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'capitalize' }}>
                {gen.type} (Weight: {gen.weight})
              </div>

              {/* Follow Normal Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '10px', cursor: 'pointer', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={gen.followNormal || false}
                  onChange={(e) => handleGeneratorFollowNormalChange(gen.id, e.target.checked)}
                  style={{
                    marginRight: '8px',
                    cursor: 'pointer',
                  }}
                />
                Point toward curve normal
                <span style={{ fontSize: '9px', color: '#666', marginLeft: '6px' }}>
                  (⊥ perpendicular)
                </span>
              </label>

              {/* Generator Parameters */}
              {paramDefs.length > 0 && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
                  <div style={{ fontSize: '10px', color: '#999', marginBottom: '6px' }}>Parameters:</div>
                  {paramDefs.map((paramDef) =>
                    renderParamControl(
                      paramDef,
                      gen.params[paramDef.name],
                      (value) => handleGeneratorParamChange(gen.id, paramDef.name, value)
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Flow Parameters */}
      <div>
        <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#aaa' }}>
          Flow
        </h5>

        <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>
          Follow Curve: {selectedFlowPath.flowParams.followCurve.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={selectedFlowPath.flowParams.followCurve}
            onChange={(e) => handleFlowChange('followCurve', parseFloat(e.target.value))}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '4px',
            }}
          />
        </label>

        <label style={{ display: 'block', fontSize: '11px', marginTop: '8px', marginBottom: '4px' }}>
          Deviation: {selectedFlowPath.flowParams.deviation.toFixed(1)} mm
          <input
            type="range"
            min="0"
            max="50"
            step="0.5"
            value={selectedFlowPath.flowParams.deviation}
            onChange={(e) => handleFlowChange('deviation', parseFloat(e.target.value))}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '4px',
            }}
          />
        </label>

        {/* Deviation Gradient Controls */}
        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#222', borderRadius: '4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', fontSize: '11px', cursor: 'pointer', marginBottom: '8px' }}>
            <input
              type="checkbox"
              checked={selectedFlowPath.flowParams.deviationGradient?.enabled || false}
              onChange={(e) => handleFlowChange('deviationGradient', {
                ...(selectedFlowPath.flowParams.deviationGradient || {
                  startMultiplier: 0,
                  endMultiplier: 2.0,
                  startT: 0,
                  endT: 1,
                  reverse: false,
                }),
                enabled: e.target.checked,
              })}
              style={{ marginRight: '8px', cursor: 'pointer' }}
            />
            Enable Deviation Gradient
            <span style={{ fontSize: '9px', color: '#666', marginLeft: '8px' }}>
              (cone dispersion)
            </span>
          </label>

          {selectedFlowPath.flowParams.deviationGradient?.enabled && (
            <>
              <label style={{ display: 'block', fontSize: '10px', marginTop: '8px', marginBottom: '4px' }}>
                Start Multiplier: {(selectedFlowPath.flowParams.deviationGradient.startMultiplier ?? 0).toFixed(2)}
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={selectedFlowPath.flowParams.deviationGradient.startMultiplier ?? 0}
                  onChange={(e) => handleFlowChange('deviationGradient', {
                    ...selectedFlowPath.flowParams.deviationGradient,
                    startMultiplier: parseFloat(e.target.value),
                  })}
                  style={{ display: 'block', width: '100%', marginTop: '2px' }}
                />
              </label>

              <label style={{ display: 'block', fontSize: '10px', marginTop: '8px', marginBottom: '4px' }}>
                End Multiplier: {(selectedFlowPath.flowParams.deviationGradient.endMultiplier || 2.0).toFixed(2)}
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={selectedFlowPath.flowParams.deviationGradient.endMultiplier || 2.0}
                  onChange={(e) => handleFlowChange('deviationGradient', {
                    ...selectedFlowPath.flowParams.deviationGradient,
                    endMultiplier: parseFloat(e.target.value),
                  })}
                  style={{ display: 'block', width: '100%', marginTop: '2px' }}
                />
              </label>

              <label style={{ display: 'block', fontSize: '10px', marginTop: '8px', marginBottom: '4px' }}>
                Start T: {(selectedFlowPath.flowParams.deviationGradient.startT || 0).toFixed(2)}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedFlowPath.flowParams.deviationGradient.startT || 0}
                  onChange={(e) => handleFlowChange('deviationGradient', {
                    ...selectedFlowPath.flowParams.deviationGradient,
                    startT: parseFloat(e.target.value),
                  })}
                  style={{ display: 'block', width: '100%', marginTop: '2px' }}
                />
              </label>

              <label style={{ display: 'block', fontSize: '10px', marginTop: '8px', marginBottom: '4px' }}>
                End T: {(selectedFlowPath.flowParams.deviationGradient.endT || 1).toFixed(2)}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedFlowPath.flowParams.deviationGradient.endT || 1}
                  onChange={(e) => handleFlowChange('deviationGradient', {
                    ...selectedFlowPath.flowParams.deviationGradient,
                    endT: parseFloat(e.target.value),
                  })}
                  style={{ display: 'block', width: '100%', marginTop: '2px' }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', fontSize: '10px', cursor: 'pointer', marginTop: '8px' }}>
                <input
                  type="checkbox"
                  checked={selectedFlowPath.flowParams.deviationGradient.reverse || false}
                  onChange={(e) => handleFlowChange('deviationGradient', {
                    ...selectedFlowPath.flowParams.deviationGradient,
                    reverse: e.target.checked,
                  })}
                  style={{ marginRight: '6px', cursor: 'pointer' }}
                />
                Reverse Direction
              </label>
            </>
          )}
        </div>

        <label style={{ display: 'block', fontSize: '11px', marginTop: '8px', marginBottom: '4px' }}>
          Normal Offset: {selectedFlowPath.flowParams.normalOffset.toFixed(1)} mm
          <input
            type="range"
            min="-50"
            max="50"
            step="0.5"
            value={selectedFlowPath.flowParams.normalOffset}
            onChange={(e) => handleFlowChange('normalOffset', parseFloat(e.target.value))}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '4px',
            }}
          />
        </label>

        {/* Boids Controls */}
        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#222', borderRadius: '4px' }}>
          <h5 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#aaa' }}>
            Boids Simulation
            <span style={{ fontSize: '9px', color: '#666', marginLeft: '8px' }}>
              (flocking behavior)
            </span>
          </h5>

          <label style={{ display: 'block', fontSize: '10px', marginTop: '8px', marginBottom: '4px' }}>
            Strength: {selectedFlowPath.flowParams.boidsStrength.toFixed(2)}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={selectedFlowPath.flowParams.boidsStrength}
              onChange={(e) => handleFlowChange('boidsStrength', parseFloat(e.target.value))}
              style={{
                display: 'block',
                width: '100%',
                marginTop: '2px',
              }}
            />
          </label>

          <label style={{ display: 'block', fontSize: '10px', marginTop: '8px', marginBottom: '4px' }}>
            Radius: {selectedFlowPath.flowParams.boidsRadius.toFixed(1)} mm
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={selectedFlowPath.flowParams.boidsRadius}
              onChange={(e) => handleFlowChange('boidsRadius', parseFloat(e.target.value))}
              style={{
                display: 'block',
                width: '100%',
                marginTop: '2px',
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
