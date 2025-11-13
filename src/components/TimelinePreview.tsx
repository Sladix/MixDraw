import { useRef, useEffect } from 'react';
import type { Timeline } from '../types';
import { evaluateTimeline } from '../utils/interpolation';

interface TimelinePreviewProps {
  timeline: Timeline | undefined;
  defaultValue: number;
  paramName: string;
  paramLabel: string;
  onClick: (paramName: string) => void;
}

/**
 * Small canvas preview showing timeline curve
 */
export function TimelinePreview({
  timeline,
  defaultValue,
  paramName,
  paramLabel,
  onClick,
}: TimelinePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw mini timeline preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = timeline && timeline.enabled ? '#2a2a2a' : '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = timeline && timeline.enabled ? '#4a9eff' : '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    if (!timeline || timeline.keyframes.length === 0) {
      // Draw flat line for default value
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    // Find value range for scaling
    const values = timeline.keyframes.map((kf) => kf.value);
    const minValue = Math.min(...values, defaultValue);
    const maxValue = Math.max(...values, defaultValue);
    const valueRange = maxValue - minValue || 1;

    // Draw curve
    ctx.strokeStyle = timeline.enabled ? '#4a9eff' : '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();

    // Sample the curve at multiple points
    const numSamples = 50;
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const value = evaluateTimeline(t, timeline.keyframes, defaultValue);
      const x = t * width;
      const y = height - ((value - minValue) / valueRange) * height * 0.8 - height * 0.1;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw keyframe dots
    const sortedKeyframes = [...timeline.keyframes].sort((a, b) => a.t - b.t);
    sortedKeyframes.forEach((kf) => {
      const x = kf.t * width;
      const y = height - ((kf.value - minValue) / valueRange) * height * 0.8 - height * 0.1;

      ctx.fillStyle = timeline.enabled ? '#4a9eff' : '#666';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [timeline, defaultValue]);

  return (
    <div
      onClick={() => onClick(paramName)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px',
        backgroundColor: '#2a2a2a',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#333')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2a2a2a')}
    >
      <canvas
        ref={canvasRef}
        width={80}
        height={30}
        style={{
          width: '80px',
          height: '30px',
          display: 'block',
        }}
      />
      <div style={{ flex: 1, fontSize: '11px' }}>
        <div style={{ color: '#aaa' }}>{paramLabel}</div>
        {timeline && timeline.enabled && (
          <div style={{ color: '#4a9eff', fontSize: '10px' }}>
            {timeline.keyframes.length} keyframes
          </div>
        )}
        {(!timeline || !timeline.enabled) && (
          <div style={{ color: '#666', fontSize: '10px' }}>No timeline</div>
        )}
      </div>
      <div
        style={{
          padding: '4px 8px',
          backgroundColor: '#333',
          borderRadius: '3px',
          fontSize: '10px',
          color: '#aaa',
        }}
      >
        Edit
      </div>
    </div>
  );
}
