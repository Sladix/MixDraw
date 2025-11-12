import React from 'react';

interface Props {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/**
 * Collapsible section component for organizing UI into expandable panels
 */
export function CollapsibleSection({ title, collapsed, onToggle, children }: Props) {
  return (
    <div style={{ marginTop: '16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: '#2a2a2a',
          borderRadius: '4px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={onToggle}
      >
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
          {title}
        </span>
        <span style={{ fontSize: '12px', color: '#aaa' }}>
          {collapsed ? '▶' : '▼'}
        </span>
      </div>

      {/* Content */}
      {!collapsed && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#222',
            borderRadius: '0 0 4px 4px',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
