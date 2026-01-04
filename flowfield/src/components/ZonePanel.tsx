import React from 'react';
import { useFlowFieldStore } from '../store/useFlowFieldStore';
import type { ZonePlacement } from '../core/types';
import { Section, Row, sliderStyle, valueStyle, selectStyle } from './ControlPanel';
import { analytics } from '../core/analytics';

export const ZonePanel: React.FC = () => {
  const zoneParams = useFlowFieldStore((s) => s.zoneParams);
  const setZoneParam = useFlowFieldStore((s) => s.setZoneParam);
  const regenerateZones = useFlowFieldStore((s) => s.regenerateZones);

  return (
    <Section title="Zones" defaultOpen={false}>
      {/* Enable toggle */}
      <Row label="Enable">
        <input
          type="checkbox"
          checked={zoneParams.enabled}
          onChange={(e) => {
            setZoneParam('enabled', e.target.checked);
            if (e.target.checked) {
              regenerateZones();
            }
            // Track zone toggle
            analytics.toggleZones(e.target.checked);
            // Trigger canvas regenerate after zone toggle
            setTimeout(() => {
              (window as any).__flowfield_export?.regenerate();
            }, 0);
          }}
          style={{ width: '16px', height: '16px' }}
        />
        <span style={{ fontSize: '10px', color: '#888' }}>
          {zoneParams.enabled ? 'Regional force blending active' : 'Disabled'}
        </span>
      </Row>

      {zoneParams.enabled && (
        <>
          {/* Zone Count */}
          <Row label="Count">
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={zoneParams.count}
              onChange={(e) => {
                setZoneParam('count', Number(e.target.value));
                // Auto-regenerate canvas when zone count changes
                setTimeout(() => {
                  (window as any).__flowfield_export?.regenerate();
                }, 0);
              }}
              style={sliderStyle}
              title="Number of zones"
            />
            <span style={valueStyle}>{zoneParams.count}</span>
          </Row>

          {/* Placement */}
          <Row label="Placement">
            <select
              value={zoneParams.placement}
              onChange={(e) => {
                setZoneParam('placement', e.target.value as ZonePlacement);
                // Auto-regenerate canvas when placement changes
                setTimeout(() => {
                  (window as any).__flowfield_export?.regenerate();
                }, 0);
              }}
              style={selectStyle}
            >
              <option value="random">Random</option>
              <option value="corners">Corners</option>
              <option value="grid">Grid</option>
            </select>
          </Row>

          {/* Transition Width */}
          <Row label="Blend Width">
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={zoneParams.transitionWidth}
              onChange={(e) => {
                setZoneParam('transitionWidth', Number(e.target.value));
                // Auto-regenerate canvas when blend width changes
                setTimeout(() => {
                  (window as any).__flowfield_export?.regenerate();
                }, 0);
              }}
              style={sliderStyle}
              title="How much zones blend together"
            />
            <span style={valueStyle}>{Math.round(zoneParams.transitionWidth * 100)}%</span>
          </Row>

          {/* Debug */}
          <Row label="Show Debug">
            <input
              type="checkbox"
              checked={zoneParams.showDebug}
              onChange={(e) => {
                setZoneParam('showDebug', e.target.checked);
                // Auto-regenerate to show/hide debug
                setTimeout(() => {
                  (window as any).__flowfield_export?.regenerate();
                }, 0);
              }}
              style={{ width: '16px', height: '16px' }}
            />
          </Row>

          {/* Regenerate button */}
          <div style={{ marginTop: '8px' }}>
            <button
              onClick={() => {
                regenerateZones();
                // Regenerate canvas after zones are regenerated
                setTimeout(() => {
                  (window as any).__flowfield_export?.regenerate();
                }, 0);
              }}
              style={{
                width: '100%',
                padding: '6px 12px',
                backgroundColor: '#333',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Regenerate Zones
            </button>
          </div>
        </>
      )}
    </Section>
  );
};
