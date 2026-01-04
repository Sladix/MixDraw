import React from 'react';
import { useFlowFieldStore } from '../store/useFlowFieldStore';
import { ForceEditor } from './ForceEditor';
import { SuperParamsPanel } from './SuperParamsPanel';
import { ZonePanel } from './ZonePanel';
import type { FormatType, PaletteMode, GradientDirection } from '../core/types';
import { PALETTE_PRESETS } from '../core/types';
import { analytics } from '../core/analytics';

export const ControlPanel: React.FC = () => {
  const format = useFlowFieldStore((s) => s.format);
  const customWidth = useFlowFieldStore((s) => s.customWidth);
  const customHeight = useFlowFieldStore((s) => s.customHeight);
  const margin = useFlowFieldStore((s) => s.margin);
  const seed = useFlowFieldStore((s) => s.seed);
  const strokeColor = useFlowFieldStore((s) => s.strokeColor);
  const lineParams = useFlowFieldStore((s) => s.lineParams);
  const colorPalette = useFlowFieldStore((s) => s.colorPalette);

  const setFormat = useFlowFieldStore((s) => s.setFormat);
  const setCustomDimensions = useFlowFieldStore((s) => s.setCustomDimensions);
  const setMargin = useFlowFieldStore((s) => s.setMargin);
  const setSeed = useFlowFieldStore((s) => s.setSeed);
  const randomizeSeed = useFlowFieldStore((s) => s.randomizeSeed);
  const setStrokeColor = useFlowFieldStore((s) => s.setStrokeColor);
  const setLineParam = useFlowFieldStore((s) => s.setLineParam);
  const setColorPalette = useFlowFieldStore((s) => s.setColorPalette);
  const applyPalettePreset = useFlowFieldStore((s) => s.applyPalettePreset);

  const handleExportSVG = () => {
    (window as any).__flowfield_export?.exportSVG();
  };

  const handleExportPNG = () => {
    (window as any).__flowfield_export?.exportPNG();
  };

  const handleRegenerate = () => {
    (window as any).__flowfield_export?.regenerate();
    analytics.regenerate();
  };

  const handleFormatChange = (newFormat: FormatType) => {
    setFormat(newFormat);
    analytics.changeFormat(newFormat);
  };

  const handleSeedChange = (newSeed: number) => {
    setSeed(newSeed);
    analytics.changeSeed('manual');
  };

  const handleRandomizeSeed = () => {
    randomizeSeed();
    analytics.changeSeed('random');
  };

  const handleLineParamChange = <K extends keyof typeof lineParams>(key: K, value: typeof lineParams[K]) => {
    setLineParam(key, value);
    analytics.changeLineParam(key, value as number | boolean);
  };

  const handleColorModeChange = (mode: PaletteMode) => {
    setColorPalette('mode', mode);
    analytics.changeColorMode(mode);
  };

  const handlePresetApply = (presetName: string, colors: string[]) => {
    applyPalettePreset(colors);
    analytics.applyColorPreset(presetName);
  };

  return (
    <div
      style={{
        width: '320px',
        height: '100vh',
        backgroundColor: '#252525',
        borderLeft: '1px solid #333',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #333',
          backgroundColor: '#2a2a2a',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
          FlowField Generator
        </h1>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {/* Canvas Settings */}
        <Section title="Canvas">
          <Row label="Format">
            <select
              value={format}
              onChange={(e) => handleFormatChange(e.target.value as FormatType)}
              style={selectStyle}
            >
              <option value="custom">Custom</option>
              <option value="a6">A6 (297×420)</option>
              <option value="a5">A5 (420×595)</option>
              <option value="a4">A4 (595×842)</option>
              <option value="a3">A3 (842×1190)</option>
              <option value="square">Square (800×800)</option>
            </select>
          </Row>

          {format === 'custom' && (
            <>
              <Row label="Width">
                <input
                  type="number"
                  min={100}
                  max={4000}
                  value={customWidth}
                  onChange={(e) => setCustomDimensions(Number(e.target.value), customHeight)}
                  style={{ ...inputStyle, width: '70px' }}
                />
                <span style={valueStyle}>px</span>
              </Row>
              <Row label="Height">
                <input
                  type="number"
                  min={100}
                  max={4000}
                  value={customHeight}
                  onChange={(e) => setCustomDimensions(customWidth, Number(e.target.value))}
                  style={{ ...inputStyle, width: '70px' }}
                />
                <span style={valueStyle}>px</span>
              </Row>
            </>
          )}

          <Row label="Margin">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              style={sliderStyle}
            />
            <span style={valueStyle}>{margin}px</span>
          </Row>

          <Row label="Seed">
            <input
              type="number"
              value={seed}
              onChange={(e) => handleSeedChange(Number(e.target.value))}
              style={{ ...inputStyle, width: '80px' }}
            />
            <button onClick={handleRandomizeSeed} style={buttonStyle}>
              🎲
            </button>
          </Row>
        </Section>

        {/* Line Settings */}
        <Section title="Lines">
          <Row label="Seed Spacing">
            <input
              type="range"
              min={4}
              max={40}
              step={1}
              value={lineParams.dSep}
              onChange={(e) => handleLineParamChange('dSep', Number(e.target.value))}
              style={sliderStyle}
              title="dSep: Controls line density (grid spacing for seed points)"
            />
            <span style={valueStyle}>{lineParams.dSep}</span>
          </Row>

          <Row label="Min Distance">
            <input
              type="range"
              min={1}
              max={40}
              step={0.5}
              value={lineParams.dTest}
              onChange={(e) => handleLineParamChange('dTest', Number(e.target.value))}
              style={sliderStyle}
              title="dTest: Minimum distance between lines (collision detection)"
            />
            <span style={valueStyle}>{lineParams.dTest}</span>
          </Row>

          <Row label="Step Size">
            <input
              type="range"
              min={0.5}
              max={8}
              step={0.5}
              value={lineParams.stepSize}
              onChange={(e) => handleLineParamChange('stepSize', Number(e.target.value))}
              style={sliderStyle}
              title="Integration step size for tracing"
            />
            <span style={valueStyle}>{lineParams.stepSize}</span>
          </Row>

          <Row label="Stroke">
            <input
              type="range"
              min={0.5}
              max={8}
              step={0.5}
              value={lineParams.strokeWidth}
              onChange={(e) => handleLineParamChange('strokeWidth', Number(e.target.value))}
              style={sliderStyle}
            />
            <span style={valueStyle}>{lineParams.strokeWidth}</span>
          </Row>

          <Row label="Max Length">
            <input
              type="range"
              min={100}
              max={2000}
              step={100}
              value={lineParams.maxSteps}
              onChange={(e) => handleLineParamChange('maxSteps', Number(e.target.value))}
              style={sliderStyle}
              title="Maximum steps per line (higher = longer lines)"
            />
            <span style={valueStyle}>{lineParams.maxSteps}</span>
          </Row>

          <Row label="Min Segments">
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={lineParams.minLength}
              onChange={(e) => handleLineParamChange('minLength', Number(e.target.value))}
              style={sliderStyle}
              title="Minimum points for a valid streamline"
            />
            <span style={valueStyle}>{lineParams.minLength}</span>
          </Row>

          <Row label="Max Length">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: '#ccc' }}>
              <input
                type="checkbox"
                checked={lineParams.maximizeLength}
                onChange={(e) => handleLineParamChange('maximizeLength', e.target.checked)}
                style={{ accentColor: '#4a9eff' }}
              />
              Optimize for longest lines
            </label>
          </Row>

          <Row label="Animation">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: '#ccc' }}>
              <input
                type="checkbox"
                checked={lineParams.progressiveRender}
                onChange={(e) => handleLineParamChange('progressiveRender', e.target.checked)}
                style={{ accentColor: '#4a9eff' }}
              />
              Progressive rendering
            </label>
          </Row>

          <Row label="Color">
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              style={{ ...inputStyle, width: '60px', padding: '2px' }}
            />
          </Row>
        </Section>

        {/* Color Palette */}
        <Section title="Color Palette">
          <Row label="Mode">
            <select
              value={colorPalette.mode}
              onChange={(e) => handleColorModeChange(e.target.value as PaletteMode)}
              style={selectStyle}
            >
              <option value="single">Single Color</option>
              <option value="gradient">Gradient</option>
              <option value="noise">Noise</option>
              <option value="palette">Palette</option>
            </select>
          </Row>

          {/* Presets - available for all modes except single */}
          {colorPalette.mode !== 'single' && (
            <Row label="Preset">
              <select
                onChange={(e) => {
                  const preset = PALETTE_PRESETS.find((p) => p.name === e.target.value);
                  if (preset) handlePresetApply(preset.name, preset.colors);
                }}
                style={selectStyle}
                defaultValue=""
              >
                <option value="" disabled>
                  Select preset...
                </option>
                {PALETTE_PRESETS.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </Row>
          )}

          {/* Gradient settings */}
          {colorPalette.mode === 'gradient' && (
            <>
              <Row label="Direction">
                <select
                  value={colorPalette.gradientDirection}
                  onChange={(e) =>
                    setColorPalette('gradientDirection', e.target.value as GradientDirection)
                  }
                  style={selectStyle}
                >
                  <option value="horizontal">Horizontal</option>
                  <option value="vertical">Vertical</option>
                  <option value="radial">Radial</option>
                  <option value="angular">Angular</option>
                </select>
              </Row>
              <Row label="Start">
                <input
                  type="color"
                  value={colorPalette.gradientColors[0] || '#000000'}
                  onChange={(e) =>
                    setColorPalette('gradientColors', [
                      e.target.value,
                      colorPalette.gradientColors[1] || '#ffffff',
                    ])
                  }
                  style={{ ...inputStyle, width: '40px', padding: '2px' }}
                />
              </Row>
              <Row label="End">
                <input
                  type="color"
                  value={colorPalette.gradientColors[1] || '#ffffff'}
                  onChange={(e) =>
                    setColorPalette('gradientColors', [
                      colorPalette.gradientColors[0] || '#000000',
                      e.target.value,
                    ])
                  }
                  style={{ ...inputStyle, width: '40px', padding: '2px' }}
                />
              </Row>
            </>
          )}

          {/* Noise settings */}
          {colorPalette.mode === 'noise' && (
            <>
              <Row label="Scale">
                <input
                  type="range"
                  min={20}
                  max={400}
                  step={10}
                  value={colorPalette.noiseScale}
                  onChange={(e) => setColorPalette('noiseScale', Number(e.target.value))}
                  style={sliderStyle}
                  title="How quickly colors change across the canvas"
                />
                <span style={valueStyle}>{colorPalette.noiseScale}</span>
              </Row>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', padding: '4px 0' }}>
                {colorPalette.noiseColors.map((color, i) => (
                  <input
                    key={i}
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const newColors = [...colorPalette.noiseColors];
                      newColors[i] = e.target.value;
                      setColorPalette('noiseColors', newColors);
                    }}
                    style={{ width: '28px', height: '28px', padding: '1px', border: '1px solid #444', borderRadius: '3px', cursor: 'pointer' }}
                  />
                ))}
              </div>
            </>
          )}

          {/* Palette settings */}
          {colorPalette.mode === 'palette' && (
            <>
              <Row label="Selection">
                <select
                  value={colorPalette.paletteMode}
                  onChange={(e) =>
                    setColorPalette('paletteMode', e.target.value as 'random' | 'sequential' | 'position')
                  }
                  style={selectStyle}
                >
                  <option value="random">Random</option>
                  <option value="sequential">Sequential</option>
                  <option value="position">By Position</option>
                </select>
              </Row>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', padding: '4px 0' }}>
                {colorPalette.paletteColors.map((color, i) => (
                  <input
                    key={i}
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const newColors = [...colorPalette.paletteColors];
                      newColors[i] = e.target.value;
                      setColorPalette('paletteColors', newColors);
                    }}
                    style={{ width: '28px', height: '28px', padding: '1px', border: '1px solid #444', borderRadius: '3px', cursor: 'pointer' }}
                  />
                ))}
              </div>
            </>
          )}
        </Section>

        {/* Super Params */}
        <SuperParamsPanel />

        {/* Zones */}
        <ZonePanel />

        {/* Forces */}
        <ForceEditor />
      </div>

      {/* Footer with actions */}
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid #333',
          backgroundColor: '#2a2a2a',
          display: 'flex',
          gap: '8px',
        }}
      >
        <button onClick={handleRegenerate} style={{ ...buttonStyle, flex: 1 }}>
          Regenerate
        </button>
        <button onClick={handleExportSVG} style={buttonStyle}>
          SVG
        </button>
        <button onClick={handleExportPNG} style={buttonStyle}>
          PNG
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Helper Components
// ============================================================================

const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div style={{ marginBottom: '12px' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          backgroundColor: '#2a2a2a',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: isOpen ? '8px' : 0,
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: '10px', color: '#888' }}>{isOpen ? '▼' : '▶'}</span>
      </div>
      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {children}
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 0',
    }}
  >
    <span style={{ fontSize: '11px', color: '#aaa', minWidth: '70px' }}>{label}</span>
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
      {children}
    </div>
  </div>
);

// ============================================================================
// Styles
// ============================================================================

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  backgroundColor: '#1a1a1a',
  border: '1px solid #444',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '11px',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  flex: 1,
};

const sliderStyle: React.CSSProperties = {
  flex: 1,
  height: '4px',
  accentColor: '#4a9eff',
};

const valueStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#888',
  minWidth: '35px',
  textAlign: 'right',
};

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px',
  backgroundColor: '#333',
  border: '1px solid #444',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '11px',
  cursor: 'pointer',
};

export { Section, Row, inputStyle, selectStyle, sliderStyle, valueStyle, buttonStyle };
