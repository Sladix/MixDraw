import React from 'react';
import { useFlowFieldStore } from '../store/useFlowFieldStore';
import { ForceCard } from './ForceCard';
import type { Force } from '../core/types';

export const ForceEditor: React.FC = () => {
  const forces = useFlowFieldStore((s) => s.forces);
  const addForce = useFlowFieldStore((s) => s.addForce);

  const [showAddMenu, setShowAddMenu] = React.useState(false);

  const handleAddForce = (type: Force['type']) => {
    addForce(type);
    setShowAddMenu(false);
  };

  return (
    <div style={{ marginBottom: '12px' }}>
      {/* Header */}
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
        <span style={{ fontSize: '12px', fontWeight: 600 }}>Forces</span>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            style={{
              padding: '2px 8px',
              backgroundColor: '#4a9eff',
              border: 'none',
              borderRadius: '3px',
              color: '#fff',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            + Add
          </button>

          {/* Dropdown menu */}
          {showAddMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                backgroundColor: '#333',
                border: '1px solid #444',
                borderRadius: '4px',
                overflow: 'hidden',
                zIndex: 100,
                minWidth: '120px',
              }}
            >
              <MenuItem onClick={() => handleAddForce('noise')}>
                🌊 Noise
              </MenuItem>
              <MenuItem onClick={() => handleAddForce('circular')}>
                🔄 Circular
              </MenuItem>
              <MenuItem onClick={() => handleAddForce('formula')}>
                📐 Formula
              </MenuItem>
            </div>
          )}
        </div>
      </div>

      {/* Force list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {forces.length === 0 ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: '#666',
              fontSize: '11px',
            }}
          >
            No forces. Click "+ Add" to add one.
          </div>
        ) : (
          forces.map((force) => <ForceCard key={force.id} force={force} />)
        )}
      </div>

      {/* Click outside to close */}
      {showAddMenu && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99,
          }}
          onClick={() => setShowAddMenu(false)}
        />
      )}
    </div>
  );
};

const MenuItem: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
}> = ({ children, onClick }) => (
  <div
    onClick={onClick}
    style={{
      padding: '8px 12px',
      fontSize: '11px',
      cursor: 'pointer',
      borderBottom: '1px solid #444',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = '#444';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = 'transparent';
    }}
  >
    {children}
  </div>
);
