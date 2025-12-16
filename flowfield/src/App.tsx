import React from 'react';
import { Canvas } from './components/Canvas';
import { ControlPanel } from './components/ControlPanel';

export const App: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Main canvas area */}
      <Canvas />

      {/* Right panel with controls */}
      <ControlPanel />
    </div>
  );
};
