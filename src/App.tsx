import { useEffect, useState } from 'react';
import { CanvasWorking } from './components/CanvasWorking';
import { Toolbar } from './components/Toolbar';
import { LayersPanel } from './components/LayersPanel';
import { LayerContentsPanel } from './components/LayerContentsPanel';
import { ControlPanel } from './components/ControlPanel';
import { GeneratorLibraryPanel } from './components/GeneratorLibraryPanel';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { TimelinePanel } from './components/TimelinePanel';
import { TimelineProvider, useTimeline } from './contexts/TimelineContext';
import { registerAllGenerators } from './generators';
import { useStore } from './store/useStore';
import { keyboardManager, setupKeyboardShortcuts } from './utils/keyboard';

function AppContent() {
  const setTool = useStore((state) => state.setTool);
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);
  const copySelected = useStore((state) => state.copySelected);
  const pasteClipboard = useStore((state) => state.pasteClipboard);
  const deleteSelected = useStore((state) => state.deleteSelected);
  const mirrorSelected = useStore((state) => state.mirrorSelected);
  const deselectAll = useStore((state) => state.deselectAll);
  const selection = useStore((state) => state.selection);
  const project = useStore((state) => state.project);

  const { showTimelinePanel, closeTimelinePanel } = useTimeline();
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  useEffect(() => {
    // Register all generators on app startup
    registerAllGenerators();
  }, []);

  // Setup keyboard shortcuts
  useEffect(() => {
    // Register all shortcuts
    keyboardManager.register({
      key: 'z',
      ctrl: true,
      description: 'Undo',
      action: undo,
      category: 'general',
    });

    keyboardManager.register({
      key: 'z',
      ctrl: true,
      shift: true,
      description: 'Redo',
      action: redo,
      category: 'general',
    });

    keyboardManager.register({
      key: 'c',
      ctrl: true,
      description: 'Copy selected',
      action: copySelected,
      category: 'selection',
    });

    keyboardManager.register({
      key: 'v',
      ctrl: true,
      description: 'Paste',
      action: () => pasteClipboard({ x: 0.05, y: 0.05 }), // Offset by 5%
      category: 'selection',
    });

    keyboardManager.register({
      key: 'delete',
      description: 'Delete selected',
      action: deleteSelected,
      category: 'selection',
    });

    keyboardManager.register({
      key: 'backspace',
      description: 'Delete selected',
      action: deleteSelected,
      category: 'selection',
    });

    keyboardManager.register({
      key: 'm',
      description: 'Mirror horizontal',
      action: () => mirrorSelected('horizontal'),
      category: 'transform',
    });

    keyboardManager.register({
      key: 'm',
      shift: true,
      description: 'Mirror vertical',
      action: () => mirrorSelected('vertical'),
      category: 'transform',
    });

    keyboardManager.register({
      key: 'a',
      ctrl: true,
      description: 'Select all',
      action: () => {
        // Select all objects in active layer
        const activeLayer = project.layers.find((l) => !l.locked) || project.layers[0];
        if (!activeLayer) return;

        // Collect all IDs based on current selection type or default to standaloneGenerator
        const type = selection.type === 'none' ? 'standaloneGenerator' : selection.type;
        let ids: string[] = [];

        if (type === 'flowPath') {
          ids = activeLayer.flowPaths.map((fp) => fp.id);
        } else if (type === 'standaloneGenerator') {
          ids = activeLayer.standaloneGenerators.map((sg) => sg.id);
        }

        if (ids.length > 0) {
          useStore.getState().selectMultiple(ids, type as 'flowPath' | 'standaloneGenerator');
        }
      },
      category: 'selection',
    });

    keyboardManager.register({
      key: 'escape',
      description: 'Deselect / Cancel',
      action: () => {
        deselectAll();
        setTool('select');
      },
      category: 'general',
    });

    keyboardManager.register({
      key: '?',
      shift: true, // Shift+? = ?
      description: 'Show keyboard shortcuts',
      action: () => setShowShortcutsModal(true),
      category: 'general',
    });

    // Tool shortcuts (Note: plain 'v' without Ctrl - Ctrl+V is for Paste)
    keyboardManager.register({
      key: 'v',
      description: 'Select tool',
      action: () => setTool('select'),
      category: 'tools',
    });

    keyboardManager.register({
      key: 'p',
      description: 'Draw flowpath tool',
      action: () => setTool('flowpath'),
      category: 'tools',
    });

    keyboardManager.register({
      key: 'g',
      description: 'Place generator tool',
      action: () => setTool('standalone'),
      category: 'tools',
    });

    // Setup global keyboard event listener
    const cleanup = setupKeyboardShortcuts();

    return () => {
      cleanup();
      keyboardManager.clear();
    };
  }, [setTool, undo, redo, copySelected, pasteClipboard, deleteSelected, mirrorSelected, deselectAll, selection.type, project]);

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

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* Timeline Panel */}
      <TimelinePanel isOpen={showTimelinePanel} onClose={closeTimelinePanel} />
    </div>
  );
}

function App() {
  return (
    <TimelineProvider>
      <AppContent />
    </TimelineProvider>
  );
}

export default App;
