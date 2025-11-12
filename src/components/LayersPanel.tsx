import { useStore } from '../store/useStore';

export function LayersPanel() {
  const layers = useStore((state) => state.project.layers);
  const addLayer = useStore((state) => state.addLayer);
  const removeLayer = useStore((state) => state.removeLayer);
  const updateLayer = useStore((state) => state.updateLayer);
  const selection = useStore((state) => state.selection);
  const setSelection = useStore((state) => state.setSelection);

  return (
    <div
      style={{
        width: '250px',
        backgroundColor: '#2a2a2a',
        color: 'white',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        borderRight: '1px solid #444',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px' }}>Layers</h3>
        <button
          onClick={addLayer}
          style={{
            padding: '6px 12px',
            backgroundColor: '#4a9eff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          + Add
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[...layers]
          .sort((a, b) => b.order - a.order)
          .map((layer) => (
            <div
              key={layer.id}
              onClick={() => setSelection({ type: 'layer', id: layer.id })}
              style={{
                padding: '12px',
                backgroundColor:
                  selection.type === 'layer' && selection.id === layer.id
                    ? '#3a3a3a'
                    : '#222',
                borderRadius: '6px',
                cursor: 'pointer',
                border: '1px solid #444',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  value={layer.name}
                  onChange={(e) =>
                    updateLayer(layer.id, { name: e.target.value })
                  }
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    outline: 'none',
                    flex: 1,
                  }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (layers.length > 1) {
                      removeLayer(layer.id);
                    }
                  }}
                  disabled={layers.length <= 1}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: layers.length > 1 ? '#c44' : '#555',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: layers.length > 1 ? 'pointer' : 'not-allowed',
                    fontSize: '12px',
                  }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  fontSize: '12px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    onChange={(e) =>
                      updateLayer(layer.id, { visible: e.target.checked })
                    }
                  />
                  Visible
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={layer.locked}
                    onChange={(e) =>
                      updateLayer(layer.id, { locked: e.target.checked })
                    }
                  />
                  Locked
                </label>

                <input
                  type="color"
                  value={layer.color}
                  onChange={(e) => updateLayer(layer.id, { color: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '30px',
                    height: '20px',
                    border: 'none',
                    cursor: 'pointer',
                    marginLeft: 'auto',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <label style={{ color: '#aaa', fontSize: '11px' }}>
                  Line Width (mm):
                </label>
                <input
                  type="number"
                  value={layer.strokeWidth}
                  onChange={(e) =>
                    updateLayer(layer.id, {
                      strokeWidth: parseFloat(e.target.value) || 0.3,
                    })
                  }
                  min="0.1"
                  max="5"
                  step="0.1"
                  style={{
                    width: '60px',
                    padding: '4px',
                    backgroundColor: '#333',
                    border: '1px solid #555',
                    borderRadius: '3px',
                    color: 'white',
                    fontSize: '11px',
                  }}
                />
              </div>

              <div style={{ fontSize: '11px', color: '#888' }}>
                {layer.flowPaths.length} FlowPaths,{' '}
                {layer.standaloneGenerators.length} Standalone
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
