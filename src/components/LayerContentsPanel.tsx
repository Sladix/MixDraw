import { useStore } from '../store/useStore';
import { FlowPathPropertiesPanel } from './FlowPathPropertiesPanel';
import { StandaloneGeneratorPropertiesPanel } from './StandaloneGeneratorPropertiesPanel';

export function LayerContentsPanel() {
  const project = useStore((state) => state.project);
  const selection = useStore((state) => state.selection);
  const setSelection = useStore((state) => state.setSelection);
  const removeFlowPath = useStore((state) => state.removeFlowPath);
  const removeStandaloneGenerator = useStore((state) => state.removeStandaloneGenerator);

  const selectedLayer = project.layers.find((l) => l.visible && !l.locked);

  if (!selectedLayer) {
    return (
      <div
        style={{
          width: '280px',
          backgroundColor: '#2a2a2a',
          color: 'white',
          padding: '16px',
          borderLeft: '1px solid #444',
        }}
      >
        <p style={{ fontSize: '12px', color: '#888' }}>No active layer</p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '280px',
        backgroundColor: '#2a2a2a',
        color: 'white',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        borderLeft: '1px solid #444',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>
          Layer Contents
        </h3>
        <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>
          {selectedLayer.name}
        </p>
      </div>

      {/* FlowPaths */}
      {selectedLayer.flowPaths.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#aaa' }}>
            FlowPaths ({selectedLayer.flowPaths.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {selectedLayer.flowPaths.map((flowPath, index) => (
              <div
                key={flowPath.id}
                onClick={() => setSelection({ type: 'flowPath', id: flowPath.id })}
                style={{
                  padding: '10px',
                  backgroundColor:
                    selection.type === 'flowPath' && selection.id === flowPath.id
                      ? '#3a4a5a'
                      : '#222',
                  border:
                    selection.type === 'flowPath' && selection.id === flowPath.id
                      ? '2px solid #4a9eff'
                      : '1px solid #444',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                      FlowPath #{index + 1}
                    </div>
                    <div style={{ fontSize: '10px', color: '#888' }}>
                      {flowPath.generators.length} generator(s) |
                      {' '}{flowPath.distributionParams.mode} distribution
                    </div>
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                      Types: {flowPath.generators.map((g) => g.type).join(', ')}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFlowPath(flowPath.id);
                    }}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#c44',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standalone Generators */}
      {selectedLayer.standaloneGenerators.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#aaa' }}>
            Standalone ({selectedLayer.standaloneGenerators.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {selectedLayer.standaloneGenerators.map((gen, index) => (
              <div
                key={gen.id}
                onClick={() => setSelection({ type: 'standaloneGenerator', id: gen.id })}
                style={{
                  padding: '10px',
                  backgroundColor:
                    selection.type === 'standaloneGenerator' && selection.id === gen.id
                      ? '#3a4a5a'
                      : '#222',
                  border:
                    selection.type === 'standaloneGenerator' && selection.id === gen.id
                      ? '2px solid #4a9eff'
                      : '1px solid #444',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', textTransform: 'capitalize' }}>
                      {gen.generatorType} #{index + 1}
                    </div>
                    <div style={{ fontSize: '10px', color: '#888' }}>
                      Position: ({gen.position.x.toFixed(0)}, {gen.position.y.toFixed(0)})
                    </div>
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                      Seed: {gen.seed} | Scale: {gen.scale}x
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStandaloneGenerator(gen.id);
                    }}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#c44',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedLayer.flowPaths.length === 0 && selectedLayer.standaloneGenerators.length === 0 && (
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            color: '#666',
            fontSize: '12px',
          }}
        >
          This layer is empty.
          <br />
          <br />
          Use FlowPath or Place tools to add content.
        </div>
      )}

      {/* Properties Editors */}
      <FlowPathPropertiesPanel />
      <StandaloneGeneratorPropertiesPanel />
    </div>
  );
}
