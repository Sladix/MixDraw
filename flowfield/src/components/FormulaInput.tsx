import React, { useState, useEffect } from 'react';
import { validateFormula, FORMULA_VARIABLES, FORMULA_FUNCTIONS } from '../core/FormulaParser';
import { FORMULA_PRESETS } from '../forces/presets';

interface FormulaInputProps {
  value: string;
  onChange: (value: string) => void;
}

export const FormulaInput: React.FC<FormulaInputProps> = ({ value, onChange }) => {
  const [localValue, setLocalValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Validate on change (but don't apply)
  useEffect(() => {
    const result = validateFormula(localValue);
    if (result.valid) {
      setError(null);
    } else {
      setError(result.error || 'Invalid expression');
    }
  }, [localValue]);

  // Sync external value
  useEffect(() => {
    setLocalValue(value);
    setIsDirty(false);
  }, [value]);

  // Apply the formula (only when explicitly requested)
  const applyFormula = () => {
    const result = validateFormula(localValue);
    if (result.valid) {
      onChange(localValue);
      setIsDirty(false);
      // Trigger regenerate
      setTimeout(() => {
        (window as any).__flowfield_export?.regenerate();
      }, 0);
    }
  };

  const handleLocalChange = (newValue: string) => {
    setLocalValue(newValue);
    setIsDirty(newValue !== value);
  };

  const applyPreset = (expression: string) => {
    setLocalValue(expression);
    setIsDirty(true);
    setShowPresets(false);
    // Auto-apply presets since they're known to be valid
    const result = validateFormula(expression);
    if (result.valid) {
      onChange(expression);
      setIsDirty(false);
      setTimeout(() => {
        (window as any).__flowfield_export?.regenerate();
      }, 0);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Label and buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '10px', color: '#aaa' }}>Expression</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setShowPresets(!showPresets)}
            style={smallButtonStyle}
            title="Presets"
          >
            📋
          </button>
          <button
            onClick={() => setShowHelp(!showHelp)}
            style={smallButtonStyle}
            title="Help"
          >
            ?
          </button>
        </div>
      </div>

      {/* Text area */}
      <textarea
        value={localValue}
        onChange={(e) => handleLocalChange(e.target.value)}
        onKeyDown={(e) => {
          // Apply on Ctrl/Cmd + Enter
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            applyFormula();
          }
        }}
        placeholder="sin(x/scale) * cos(y/scale)"
        spellCheck={false}
        style={{
          width: '100%',
          minHeight: '60px',
          padding: '8px',
          backgroundColor: '#1a1a1a',
          border: `1px solid ${error ? '#f66' : isDirty ? '#f90' : '#444'}`,
          borderRadius: '4px',
          color: '#fff',
          fontSize: '11px',
          fontFamily: 'monospace',
          resize: 'vertical',
          lineHeight: '1.4',
        }}
      />

      {/* Apply button - only show when dirty and valid */}
      {isDirty && (
        <button
          onClick={applyFormula}
          disabled={!!error}
          style={{
            padding: '6px 12px',
            backgroundColor: error ? '#444' : '#4a9eff',
            border: 'none',
            borderRadius: '4px',
            color: error ? '#888' : '#fff',
            fontSize: '11px',
            fontWeight: 500,
            cursor: error ? 'not-allowed' : 'pointer',
            opacity: error ? 0.6 : 1,
          }}
        >
          Apply Formula (Ctrl+Enter)
        </button>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            fontSize: '10px',
            color: '#f66',
            padding: '4px 8px',
            backgroundColor: 'rgba(255, 102, 102, 0.1)',
            borderRadius: '3px',
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Presets dropdown */}
      {showPresets && (
        <div
          style={{
            backgroundColor: '#333',
            border: '1px solid #444',
            borderRadius: '4px',
            maxHeight: '200px',
            overflow: 'auto',
          }}
        >
          {FORMULA_PRESETS.map((preset) => (
            <div
              key={preset.name}
              onClick={() => applyPreset(preset.expression)}
              style={{
                padding: '8px 10px',
                borderBottom: '1px solid #444',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 500 }}>{preset.name}</div>
              <div
                style={{
                  fontSize: '9px',
                  color: '#888',
                  fontFamily: 'monospace',
                  marginTop: '2px',
                }}
              >
                {preset.expression}
              </div>
              <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                {preset.description}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help panel */}
      {showHelp && (
        <div
          style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '4px',
            padding: '10px',
            fontSize: '10px',
          }}
        >
          <div style={{ marginBottom: '8px', fontWeight: 600, color: '#4a9eff' }}>
            Variables
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: '4px 8px',
              marginBottom: '12px',
            }}
          >
            {FORMULA_VARIABLES.map((v) => (
              <React.Fragment key={v.name}>
                <code style={{ color: '#9f9' }}>{v.name}</code>
                <span style={{ color: '#888' }}>{v.description}</span>
              </React.Fragment>
            ))}
          </div>

          <div style={{ marginBottom: '8px', fontWeight: 600, color: '#4a9eff' }}>
            Functions
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
            }}
          >
            {FORMULA_FUNCTIONS.map((fn) => (
              <code
                key={fn}
                style={{
                  color: '#ff9',
                  backgroundColor: '#333',
                  padding: '2px 4px',
                  borderRadius: '2px',
                }}
              >
                {fn}
              </code>
            ))}
          </div>

          <div
            style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid #333',
              color: '#666',
            }}
          >
            Expression returns angle in radians. Use PI, TAU for full rotation.
          </div>
        </div>
      )}
    </div>
  );
};

const smallButtonStyle: React.CSSProperties = {
  padding: '2px 6px',
  backgroundColor: '#333',
  border: '1px solid #444',
  borderRadius: '3px',
  color: '#888',
  fontSize: '10px',
  cursor: 'pointer',
};
