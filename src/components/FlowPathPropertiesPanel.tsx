import { useState } from 'react';
import { useStore } from '../store/useStore';
import { GeneratorRegistry } from '../core/GeneratorRegistry';
import type { ParamDefinition } from '../types';
import { CollapsibleSection } from './CollapsibleSection';
import { ModifierList } from './ModifierList';
import { MinMaxControl } from './MinMaxControl';

export function FlowPathPropertiesPanel() {
  const project = useStore((state) => state.project);
  const selection = useStore((state) => state.selection);
  const updateFlowPath = useStore((state) => state.updateFlowPath);

  // State for collapsed sections
  const [collapsedSections, setCollapsedSections] = useState({
    shape: false,
    distribution: false,
    generators: false,
    modifiers: false,
    advanced: true, // Collapsed by default
  });

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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
        FlowPath Properties
      </h4>

      {/* Path Shape */}
      <CollapsibleSection
        title="Path Shape"
        collapsed={collapsedSections.shape}
        onToggle={() => toggleSection('shape')}
      >
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
      </CollapsibleSection>

      {/* Distribution Parameters */}
      <CollapsibleSection
        title="Distribution"
        collapsed={collapsedSections.distribution}
        onToggle={() => toggleSection('distribution')}
      >
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

        {/* Density Mode Toggle */}
        <div style={{ marginTop: '12px' }}>
          <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '4px' }}>
            Density Mode
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleDistributionChange('densityMode', 'visual')}
              style={{
                flex: 1,
                padding: '6px 12px',
                backgroundColor: (selectedFlowPath.distributionParams.densityMode || 'visual') === 'visual' ? '#4a9eff' : '#333',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '10px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              Visual
            </button>
            <button
              onClick={() => handleDistributionChange('densityMode', 'fixed-count')}
              style={{
                flex: 1,
                padding: '6px 12px',
                backgroundColor: selectedFlowPath.distributionParams.densityMode === 'fixed-count' ? '#4a9eff' : '#333',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '10px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              Fixed Count
            </button>
          </div>
        </div>

        {/* Packing Mode (only in visual mode) */}
        {(selectedFlowPath.distributionParams.densityMode || 'visual') === 'visual' && (
          <label style={{ display: 'block', fontSize: '11px', marginTop: '12px', marginBottom: '4px' }}>
            Packing Mode
            <span style={{ fontSize: '9px', color: '#666', marginLeft: '6px', display: 'block', marginTop: '2px' }}>
              Controls overlap tolerance between shapes
            </span>
            <select
              value={selectedFlowPath.distributionParams.packingMode || 'normal'}
              onChange={(e) => handleDistributionChange('packingMode', e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px',
                marginTop: '4px',
                backgroundColor: '#2a2a2a',
                color: 'white',
                border: '1px solid #444',
                borderRadius: '3px',
                fontSize: '11px',
              }}
            >
              <option value="tight">Tight (no overlap)</option>
              <option value="normal">Normal (10% tolerance)</option>
              <option value="loose">Loose (25% tolerance)</option>
              <option value="allow-overlap">Allow Overlap</option>
            </select>
          </label>
        )}

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
      </CollapsibleSection>

      {/* Generators */}
      <CollapsibleSection
        title={`Generators (${selectedFlowPath.generators.length})`}
        collapsed={collapsedSections.generators}
        onToggle={() => toggleSection('generators')}
      >
        {selectedFlowPath.generators.map((gen, index) => {
          const generator = GeneratorRegistry.get(gen.type);
          const paramDefs = generator?.getParamDefinitions() || [];

          return (
            <div
              key={gen.id}
              style={{
                padding: '10px',
                backgroundColor: '#2a2a2a',
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
      </CollapsibleSection>

      {/* Modifiers */}
      <CollapsibleSection
        title="Modifiers"
        collapsed={collapsedSections.modifiers}
        onToggle={() => toggleSection('modifiers')}
      >
        <ModifierList
          modifiers={selectedFlowPath.modifiers || []}
          onUpdate={(modifiers) => updateFlowPath(selectedFlowPath.id, { modifiers })}
        />
      </CollapsibleSection>

      {/* Advanced Flow Parameters */}
      <CollapsibleSection
        title="Advanced Flow"
        collapsed={collapsedSections.advanced}
        onToggle={() => toggleSection('advanced')}
      >
        {/* NEW TUBE FILLING SYSTEM */}
        <div style={{ padding: '12px', backgroundColor: '#1a3a1a', borderRadius: '4px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#4ade80', marginBottom: '12px' }}>
            🎨 Tube Filling (NEW)
          </div>

          <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>
            Spread: {(selectedFlowPath.flowParams.spread ?? 10).toFixed(1)} mm
            <span style={{ fontSize: '9px', color: '#666', marginLeft: '6px', display: 'block' }}>
              Width of tube area to fill (total width, both sides of path)
            </span>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={selectedFlowPath.flowParams.spread ?? 10}
              onChange={(e) => handleFlowChange('spread', parseFloat(e.target.value))}
              style={{
                display: 'block',
                width: '100%',
                marginTop: '4px',
              }}
            />
          </label>

          <label style={{ display: 'block', fontSize: '11px', marginTop: '12px', marginBottom: '4px' }}>
            Fill Mode
            <span style={{ fontSize: '9px', color: '#666', marginLeft: '6px', display: 'block' }}>
              How to distribute shapes within the tube
            </span>
            <select
              value={selectedFlowPath.flowParams.fillMode || 'grid'}
              onChange={(e) => handleFlowChange('fillMode', e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px',
                marginTop: '4px',
                backgroundColor: '#2a2a2a',
                color: 'white',
                border: '1px solid #444',
                borderRadius: '3px',
                fontSize: '11px',
              }}
            >
              <option value="grid">Grid (regular pattern)</option>
              <option value="noise">Noise (organic clustering)</option>
              <option value="random">Random (uniform distribution)</option>
              <option value="packed">Packed (maximum density)</option>
            </select>
          </label>
        </div>

        {/* Follow Curve Control */}
        <label style={{ display: 'block', fontSize: '11px', marginTop: '12px', marginBottom: '4px' }}>
          Follow Curve: {selectedFlowPath.flowParams.followCurve.toFixed(2)}
          <span style={{ fontSize: '9px', color: '#666', marginLeft: '6px', display: 'block' }}>
            How much shapes align with curve direction (0 = no rotation, 1 = full alignment)
          </span>
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

        {/* Boids Controls */}
        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
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
      </CollapsibleSection>
    </div>
  );
}
