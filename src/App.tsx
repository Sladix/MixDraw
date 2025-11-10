import { useEffect } from 'react';
import { CanvasWorking } from './components/CanvasWorking';
import { Toolbar } from './components/Toolbar';
import { LayersPanel } from './components/LayersPanel';
import { LayerContentsPanel } from './components/LayerContentsPanel';
import { ControlPanel } from './components/ControlPanel';
import { GeneratorLibraryPanel } from './components/GeneratorLibraryPanel';
import { registerAllGenerators } from './generators';
import { useStore } from './store/useStore';

function App() {
  const setTool = useStore((state) => state.setTool);

  useEffect(() => {
    // Register all generators on app startup
    registerAllGenerators();
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key - deselect tool
      if (e.key === 'Escape') {
        setTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: '#1a1a1a',
          color: 'white',
          padding: '12px 20px',
          borderBottom: '1px solid #444',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
          Mix Draw
        </h1>
        <div style={{ fontSize: '12px', color: '#888' }}>
          Generative Art Platform
        </div>
      </div>

      {/* Toolbar */}
      <Toolbar />

      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Control Panel (Left) */}
        <ControlPanel />

        {/* Layers Panel */}
        <LayersPanel />

        {/* Canvas (Center) */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <CanvasWorking />
        </div>

        {/* Layer Contents Panel (Middle Right) */}
        <LayerContentsPanel />

        {/* Generator Library Panel (Far Right) */}
        <GeneratorLibraryPanel />
      </div>
    </div>
  );
}

export default App;
