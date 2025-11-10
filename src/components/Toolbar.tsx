import { useStore } from '../store/useStore';
import type { ToolType } from '../types';

export function Toolbar() {
  const currentTool = useStore((state) => state.currentTool);
  const setTool = useStore((state) => state.setTool);

  const tools: Array<{ type: ToolType['type']; label: string; icon: string }> = [
    { type: 'select', label: 'Select', icon: '↖' },
    { type: 'flowpath', label: 'FlowPath', icon: '〰' },
    { type: 'standalone', label: 'Place', icon: '✦' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px',
        backgroundColor: '#2a2a2a',
        borderBottom: '1px solid #444',
      }}
    >
      {tools.map((tool) => (
        <button
          key={tool.type}
          onClick={() => setTool(tool.type)}
          style={{
            padding: '8px 16px',
            backgroundColor: currentTool === tool.type ? '#4a9eff' : '#3a3a3a',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (currentTool !== tool.type) {
              e.currentTarget.style.backgroundColor = '#444';
            }
          }}
          onMouseLeave={(e) => {
            if (currentTool !== tool.type) {
              e.currentTarget.style.backgroundColor = '#3a3a3a';
            }
          }}
        >
          <span style={{ fontSize: '18px' }}>{tool.icon}</span>
          <span>{tool.label}</span>
        </button>
      ))}
    </div>
  );
}
