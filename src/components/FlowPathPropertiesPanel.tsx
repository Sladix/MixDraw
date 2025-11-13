import { useState } from 'react';
import { useStore } from '../store/useStore';
import { GeneratorRegistry } from '../core/GeneratorRegistry';
import type { ParamDefinition } from '../types';
import { CollapsibleSection } from './CollapsibleSection';
import { ModifierList } from './ModifierList';
import { MinMaxControl } from './MinMaxControl';
import { TimelinePreview } from './TimelinePreview';
import { useTimeline } from '../contexts/TimelineContext';

export function FlowPathPropertiesPanel() {
  const project = useStore((state) => state.project);
  const selection = useStore((state) => state.selection);
  const updateFlowPath = useStore((state) => state.updateFlowPath);
  const copyFlowPathConfig = useStore((state) => state.copyFlowPathConfig);
  const pasteFlowPathConfig = useStore((state) => state.pasteFlowPathConfig);
  const clipboard = useStore((state) => state.clipboard);
  const { openTimelinePanel } = useTimeline();

  // State for collapsed sections
  const [collapsedSections, setCollapsedSections] = useState({
    basic: false,
    generators: false,
    timeline: false,
    modifiers: false,
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
    onChange: (value: any) => void,
    generatorId?: string, // Optional: for generator-specific params
  ) => {
    const value = currentValue !== undefined ? currentValue : paramDef.defaultValue;

    // Build timeline parameter name (e.g., "gen.abc123.size")
    const timelineParamName = generatorId ? `gen.${generatorId}.${paramDef.name}` : paramDef.name;

    // Check if there's an active timeline for this parameter
    const hasTimeline = selectedFlowPath.timelines?.some(
      tl => tl.paramName === timelineParamName && tl.enabled
    ) || false;

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
        // Find the timeline for this parameter
        const paramTimeline = selectedFlowPath.timelines?.find(
          tl => tl.paramName === timelineParamName
        );

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
            onCreateTimeline={() => openTimelinePanel(timelineParamName)}
            hasTimeline={hasTimeline}
            timeline={paramTimeline}
          />
        );

      default:
        return null;
    }
  };

  const handleCopyConfig = () => {
    copyFlowPathConfig(selection.id!);
  };

  const handlePasteConfig = () => {
    pasteFlowPathConfig(selection.id!);
  };

  const hasConfigInClipboard = clipboard?.type === 'flowPathConfig';

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#1a1a1a',
        borderRadius: '6px',
        marginTop: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: '0', fontSize: '14px', color: '#4a9eff' }}>
          FlowPath Properties
        </h4>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={handleCopyConfig}
            style={{
              padding: '4px 10px',
              backgroundColor: '#333',
              border: '1px solid #444',
              borderRadius: '3px',
              color: '#fff',
              fontSize: '10px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#444'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#333'}
            title="Copy configuration (params, generators, modifiers, timelines)"
          >
            Copy Config
          </button>
          <button
            onClick={handlePasteConfig}
            disabled={!hasConfigInClipboard}
            style={{
              padding: '4px 10px',
              backgroundColor: hasConfigInClipboard ? '#4a9eff' : '#222',
              border: '1px solid #444',
              borderRadius: '3px',
              color: hasConfigInClipboard ? '#fff' : '#666',
              fontSize: '10px',
              cursor: hasConfigInClipboard ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s',
              opacity: hasConfigInClipboard ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (hasConfigInClipboard) e.currentTarget.style.backgroundColor = '#5aa9ff';
            }}
            onMouseLeave={(e) => {
              if (hasConfigInClipboard) e.currentTarget.style.backgroundColor = '#4a9eff';
            }}
            title={hasConfigInClipboard ? "Paste configuration to this flowpath" : "No configuration in clipboard"}
          >
            Paste Config
          </button>
        </div>
      </div>

      {/* Basic Settings */}
      <CollapsibleSection
        title="Basic Settings"
        collapsed={collapsedSections.basic}
        onToggle={() => toggleSection('basic')}
      >
        {/* Close Shape */}
        <label style={{ display: 'flex', alignItems: 'center', fontSize: '11px', cursor: 'pointer', marginBottom: '12px' }}>
          <input
            type="checkbox"
            checked={selectedFlowPath.closed || false}
            onChange={(e) => handleClosedChange(e.target.checked)}
            style={{
              marginRight: '8px',
              cursor: 'pointer',
            }}
          />
          Close Path
          <span style={{ fontSize: '10px', color: '#888', marginLeft: '8px' }}>
            (connect last to first point)
          </span>
        </label>

        {/* Seed */}
        <label style={{ display: 'block', fontSize: '11px', marginBottom: '12px' }}>
          Random Seed: {selectedFlowPath.distributionParams.seed}
          <input
            type="number"
            value={selectedFlowPath.distributionParams.seed}
            onChange={(e) => handleDistributionChange('seed', parseInt(e.target.value))}
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
          />
        </label>

        {/* Density */}
        <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>
          Density: {selectedFlowPath.distributionParams.density.toFixed(2)} shapes/mm
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
          <span style={{ fontSize: '9px', color: '#aaa', display: 'block', marginTop: '4px' }}>
            💡 Use Timeline Keyframes to animate density along the path
          </span>
        </label>

        {/* Spread */}
        <label style={{ display: 'block', fontSize: '11px', marginTop: '12px', marginBottom: '4px' }}>
          Spread: {(selectedFlowPath.flowParams.spread ?? 10).toFixed(1)} mm
          <span style={{ fontSize: '9px', color: '#666', display: 'block', marginTop: '2px' }}>
            Width of the tube area (both sides of path)
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
          <span style={{ fontSize: '9px', color: '#aaa', display: 'block', marginTop: '4px' }}>
            💡 Use Timeline Keyframes to animate spread along the path
          </span>
        </label>

        {/* Fill Mode */}
        <label style={{ display: 'block', fontSize: '11px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #333', marginBottom: '4px' }}>
          Fill Mode
          <span style={{ fontSize: '9px', color: '#666', display: 'block', marginTop: '2px' }}>
            Distribution pattern within tube area
          </span>
          <select
            value={selectedFlowPath.flowParams.fillMode || 'packed'}
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
            <option value="packed">Packed (maximum density)</option>
            <option value="grid">Grid (regular pattern)</option>
            <option value="noise">Noise (organic clustering)</option>
            <option value="random">Random (uniform)</option>
          </select>
        </label>

        {/* Packing Mode & Min Spacing (only for packed fill mode) */}
        {selectedFlowPath.flowParams.fillMode === 'packed' && (
          <>
            <label style={{ display: 'block', fontSize: '11px', marginTop: '12px', marginBottom: '4px' }}>
              Packing Mode
              <span style={{ fontSize: '9px', color: '#666', display: 'block', marginTop: '2px' }}>
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
                <option value="tight">Tight (maximum density)</option>
                <option value="normal">Normal (10% tolerance)</option>
                <option value="loose">Loose (25% tolerance)</option>
                <option value="allow-overlap">Allow Overlap</option>
              </select>
            </label>

            {/* Min Spacing */}
            <label style={{ display: 'block', fontSize: '11px', marginTop: '12px', marginBottom: '4px' }}>
              Min Spacing: {(selectedFlowPath.distributionParams.minSpacing ?? 0).toFixed(1)} mm
              <span style={{ fontSize: '9px', color: '#666', display: 'block', marginTop: '2px' }}>
                Fine-tune spacing (negative = tighter, positive = more space)
              </span>
              <input
                type="range"
                min="-2"
                max="5"
                step="0.1"
                value={selectedFlowPath.distributionParams.minSpacing ?? 0}
                onChange={(e) => handleDistributionChange('minSpacing', parseFloat(e.target.value))}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '6px',
                }}
              />
            </label>
          </>
        )}

        {/* Density Mode Toggle */}
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #333' }}>
          <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '6px' }}>
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

        {/* Follow Curve */}
        <label style={{ display: 'block', fontSize: '11px', marginTop: '12px', marginBottom: '4px' }}>
          Follow Curve: {selectedFlowPath.flowParams.followCurve.toFixed(2)}
          <span style={{ fontSize: '9px', color: '#666', display: 'block', marginTop: '2px' }}>
            Align shapes with path direction (0 = no rotation, 1 = full alignment)
          </span>
          <span style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }}>
            💡 Use Timeline Keyframes to animate rotation along the path
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
              marginTop: '6px',
            }}
          />
        </label>
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
                      (value) => handleGeneratorParamChange(gen.id, paramDef.name, value),
                      gen.id // Pass generator ID for timeline naming
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

      {/* Timeline Keyframes */}
      <CollapsibleSection
        title="Timeline Keyframes"
        collapsed={collapsedSections.timeline}
        onToggle={() => toggleSection('timeline')}
      >
        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '12px' }}>
          Animate parameters along the flowPath using keyframes
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <TimelinePreview
            timeline={selectedFlowPath.timelines?.find((tl) => tl.paramName === 'density')}
            defaultValue={selectedFlowPath.distributionParams.density}
            paramName="density"
            paramLabel="Density"
            onClick={openTimelinePanel}
          />
          <TimelinePreview
            timeline={selectedFlowPath.timelines?.find((tl) => tl.paramName === 'spread')}
            defaultValue={selectedFlowPath.flowParams.spread}
            paramName="spread"
            paramLabel="Spread"
            onClick={openTimelinePanel}
          />
          <TimelinePreview
            timeline={selectedFlowPath.timelines?.find((tl) => tl.paramName === 'followCurve')}
            defaultValue={selectedFlowPath.flowParams.followCurve}
            paramName="followCurve"
            paramLabel="Follow Curve"
            onClick={openTimelinePanel}
          />
        </div>
      </CollapsibleSection>

    </div>
  );
}
