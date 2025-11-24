import { useState } from 'react';
import { useStore } from '../store/useStore';
import { GeneratorRegistry } from '../core/GeneratorRegistry';
import type { ParamDefinition, MinMaxValue } from '../types';
import { isMinMaxValue } from '../types';
import { CollapsibleSection } from './CollapsibleSection';
import { ModifierList } from './ModifierList';
import { ParameterControl } from './ParameterControl';
import { MinMaxControl } from './MinMaxControl';
import { useTimeline } from '../contexts/TimelineContext';

export function FlowPathPropertiesPanel() {
  const project = useStore((state) => state.project);
  const selection = useStore((state) => state.selection);
  const updateFlowPath = useStore((state) => state.updateFlowPath);
  const copyFlowPathConfig = useStore((state) => state.copyFlowPathConfig);
  const pasteFlowPathConfig = useStore((state) => state.pasteFlowPathConfig);
  const clipboard = useStore((state) => state.clipboard);
  const addGeneratorToFlowPath = useStore((state) => state.addGeneratorToFlowPath);
  const removeGeneratorFromFlowPath = useStore((state) => state.removeGeneratorFromFlowPath);
  const { openTimelinePanel } = useTimeline();

  // State for collapsed sections
  const [collapsedSections, setCollapsedSections] = useState({
    basic: false,
    generators: false,
    modifiers: false,
  });

  // State for generator picker dropdown
  const [showGeneratorPicker, setShowGeneratorPicker] = useState(false);

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
    // Build timeline parameter name (e.g., "gen.abc123.size")
    const timelineParamName = generatorId ? `gen.${generatorId}.${paramDef.name}` : paramDef.name;

    // Check if there's an active timeline for this parameter
    const hasTimeline = selectedFlowPath.timelines?.some(
      tl => tl.paramName === timelineParamName && tl.enabled
    ) || false;

    // Find the timeline for this parameter
    const paramTimeline = selectedFlowPath.timelines?.find(
      tl => tl.paramName === timelineParamName
    );

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
        <div style={{ marginBottom: '12px' }}>
          <MinMaxControl
            label="Density"
            value={selectedFlowPath.distributionParams.density}
            min={0.1}
            max={2}
            step={0.1}
            unit="shapes/mm"
            onChange={(value) => handleDistributionChange('density', value)}
            onCreateTimeline={() => openTimelinePanel('density')}
            hasTimeline={!!selectedFlowPath.timelines?.find((tl) => tl.paramName === 'density')}
            timeline={selectedFlowPath.timelines?.find((tl) => tl.paramName === 'density')}
          />
          {selectedFlowPath.generators.length > 1 && (
            <div style={{ fontSize: '9px', color: '#666', marginTop: '6px' }}>
              {selectedFlowPath.generators.length} generators × {
                isMinMaxValue(selectedFlowPath.distributionParams.density)
                  ? `${((selectedFlowPath.distributionParams.density.min + selectedFlowPath.distributionParams.density.max) / 2 / selectedFlowPath.generators.length).toFixed(2)}`
                  : (selectedFlowPath.distributionParams.density / selectedFlowPath.generators.length).toFixed(2)
              }/mm each (avg)
            </div>
          )}
        </div>

        {/* Spread */}
        <div style={{ marginBottom: '12px' }}>
          <MinMaxControl
            label="Spread"
            value={selectedFlowPath.flowParams.spread ?? 10}
            min={1}
            max={100}
            step={1}
            unit="mm"
            onChange={(value) => handleFlowChange('spread', value)}
            onCreateTimeline={() => openTimelinePanel('spread')}
            hasTimeline={!!selectedFlowPath.timelines?.find((tl) => tl.paramName === 'spread')}
            timeline={selectedFlowPath.timelines?.find((tl) => tl.paramName === 'spread')}
          />
          <div style={{ fontSize: '9px', color: '#666', marginTop: '6px' }}>
            Width of the tube area (both sides of path)
          </div>
        </div>

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
        <div style={{ marginBottom: '12px' }}>
          <MinMaxControl
            label="Follow Curve"
            value={selectedFlowPath.flowParams.followCurve}
            min={0}
            max={1}
            step={0.1}
            onChange={(value) => handleFlowChange('followCurve', value)}
            onCreateTimeline={() => openTimelinePanel('followCurve')}
            hasTimeline={!!selectedFlowPath.timelines?.find((tl) => tl.paramName === 'followCurve')}
            timeline={selectedFlowPath.timelines?.find((tl) => tl.paramName === 'followCurve')}
          />
          <div style={{ fontSize: '9px', color: '#666', marginTop: '6px' }}>
            Align shapes with path direction (0 = no rotation, 1 = full alignment)
          </div>
        </div>
      </CollapsibleSection>

      {/* Generators */}
      <CollapsibleSection
        title={`Generators (${selectedFlowPath.generators.length})`}
        collapsed={collapsedSections.generators}
        onToggle={() => toggleSection('generators')}
      >
        {/* Add Generator Button */}
        <div style={{ marginBottom: '10px', position: 'relative' }}>
          <button
            onClick={() => setShowGeneratorPicker(!showGeneratorPicker)}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#4a9eff',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
            }}
          >
            + Add Generator
          </button>

          {/* Generator Picker Dropdown */}
          {showGeneratorPicker && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '4px',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 1000,
              }}
            >
              {GeneratorRegistry.list().map((gen) => (
                <button
                  key={gen.type}
                  onClick={() => {
                    addGeneratorToFlowPath(selectedFlowPath.id, gen.type);
                    setShowGeneratorPicker(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #333',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '11px',
                    textAlign: 'left',
                    textTransform: 'capitalize',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#3a3a3a';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {gen.name}
                </button>
              ))}
            </div>
          )}
        </div>

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
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                  {gen.type} (Weight: {gen.weight})
                </div>
                <button
                  onClick={() => removeGeneratorFromFlowPath(selectedFlowPath.id, gen.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ff4444',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '0 4px',
                    lineHeight: '1',
                  }}
                  title="Remove generator"
                >
                  ×
                </button>
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


    </div>
  );
}
