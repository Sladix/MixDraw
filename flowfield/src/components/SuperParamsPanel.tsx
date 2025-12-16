import React from 'react';
import { useFlowFieldStore } from '../store/useFlowFieldStore';
import { MinMaxControl } from '../shared';

export const SuperParamsPanel: React.FC = () => {
  const superParams = useFlowFieldStore((s) => s.superParams);
  const setSuperParam = useFlowFieldStore((s) => s.setSuperParam);
  const resetSuperParams = useFlowFieldStore((s) => s.resetSuperParams);

  return (
    <div style={{ marginBottom: '12px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          backgroundColor: '#2a2a2a',
          borderRadius: '4px',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600 }}>Super Params</span>
        <button
          onClick={resetSuperParams}
          style={{
            padding: '2px 8px',
            backgroundColor: '#333',
            border: '1px solid #444',
            borderRadius: '3px',
            color: '#888',
            fontSize: '9px',
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Field Scale */}
        <MinMaxControl
          label="Field Scale"
          value={superParams.scale}
          min={50}
          max={400}
          step={10}
          onChange={(value) => {
            if (typeof value === 'number') {
              setSuperParam('scale', value);
            }
          }}
        />

        {/* Distortion (Warp) */}
        <MinMaxControl
          label="Distortion"
          value={superParams.warp}
          min={0}
          max={1}
          step={0.05}
          onChange={(value) => {
            if (typeof value === 'number') {
              setSuperParam('warp', value);
            }
          }}
        />

        {/* Twist */}
        <MinMaxControl
          label="Twist"
          value={superParams.twist}
          min={0}
          max={360}
          step={5}
          unit="°"
          onChange={(value) => {
            if (typeof value === 'number') {
              setSuperParam('twist', value);
            }
          }}
        />

        {/* Noise Layer (Turbulence) */}
        <MinMaxControl
          label="Noise Layer"
          value={superParams.turbulence}
          min={0}
          max={1}
          step={0.05}
          onChange={(value) => {
            if (typeof value === 'number') {
              setSuperParam('turbulence', value);
            }
          }}
        />
      </div>
    </div>
  );
};
