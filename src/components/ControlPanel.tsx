import { useRef } from 'react';
import { useStore } from '../store/useStore';
import { exportAllLayers, saveProject } from '../core/export';
import { PAPER_FORMATS } from '../types/formats';
import type { FormatType } from '../types/formats';

export function ControlPanel() {
  const project = useStore((state) => state.project);
  const paperFormat = useStore((state) => state.paperFormat);
  const paperOrientation = useStore((state) => state.paperOrientation);
  const globalSeed = useStore((state) => state.globalSeed);
  const setPaperFormat = useStore((state) => state.setPaperFormat);
  const setPaperOrientation = useStore((state) => state.setPaperOrientation);
  const setGlobalSeed = useStore((state) => state.setGlobalSeed);
  const regenerateSeed = useStore((state) => state.regenerateSeed);
  const setBackgroundImage = useStore((state) => state.setBackgroundImage);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFormatChange = (format: FormatType) => {
    setPaperFormat(format);
    console.log(`Format changed to ${format}`);
  };

  const handleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      setGlobalSeed(value);
    }
  };

  const handleRandomSeed = () => {
    regenerateSeed();
    console.log('New random seed generated');
  };

  const handleExportAll = () => {
    exportAllLayers(project, 'mixdraw-project', paperFormat, paperOrientation);
    console.log(`Exporting all layers as SVG with format ${paperFormat} ${paperOrientation}...`);
  };

  const handleSaveProject = () => {
    saveProject(project, 'mixdraw-project.json');
    console.log('Project saved as JSON');
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setBackgroundImage({
          dataUrl: event.target?.result as string,
          width: img.width,
          height: img.height,
        });
        console.log(`Background image loaded: ${img.width}x${img.height}px`);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      style={{
        width: '260px',
        backgroundColor: '#2a2a2a',
        color: 'white',
        padding: '16px',
        borderRight: '1px solid #444',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
        Project Controls
      </h4>

      {/* Paper Format Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', color: '#aaa' }}>Paper Format</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(Object.keys(PAPER_FORMATS) as FormatType[]).map((format) => (
            <button
              key={format}
              onClick={() => handleFormatChange(format)}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: paperFormat === format ? '#4a9eff' : '#3a3a3a',
                color: 'white',
                border: paperFormat === format ? '2px solid #4a9eff' : '1px solid #555',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: paperFormat === format ? 'bold' : 'normal',
                transition: 'all 0.2s',
              }}
            >
              {format}
              <div style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }}>
                {PAPER_FORMATS[format].width} × {PAPER_FORMATS[format].height}mm
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Paper Orientation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', color: '#aaa' }}>Orientation</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setPaperOrientation('portrait')}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: paperOrientation === 'portrait' ? '#4a9eff' : '#3a3a3a',
              color: 'white',
              border: paperOrientation === 'portrait' ? '2px solid #4a9eff' : '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: paperOrientation === 'portrait' ? 'bold' : 'normal',
              transition: 'all 0.2s',
            }}
          >
            Portrait
          </button>
          <button
            onClick={() => setPaperOrientation('landscape')}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: paperOrientation === 'landscape' ? '#4a9eff' : '#3a3a3a',
              color: 'white',
              border: paperOrientation === 'landscape' ? '2px solid #4a9eff' : '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: paperOrientation === 'landscape' ? 'bold' : 'normal',
              transition: 'all 0.2s',
            }}
          >
            Landscape
          </button>
        </div>
      </div>

      {/* Global Seed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', color: '#aaa' }}>Global Seed</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="number"
            value={globalSeed}
            onChange={handleSeedChange}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: '#1a1a1a',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px',
              fontSize: '13px',
            }}
          />
          <button
            onClick={handleRandomSeed}
            style={{
              padding: '8px 12px',
              backgroundColor: '#3a3a3a',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            🎲
          </button>
        </div>
      </div>

      {/* Background Image */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', color: '#aaa' }}>Background Image</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleBackgroundUpload}
          style={{ display: 'none' }}
        />
        <button
          onClick={handleBackgroundClick}
          style={{
            padding: '8px 12px',
            backgroundColor: project.backgroundImage ? '#4c4' : '#3a3a3a',
            color: 'white',
            border: '1px solid #555',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            justifyContent: 'center',
          }}
        >
          <span>📁</span>
          {project.backgroundImage ? 'Change Image' : 'Upload Image'}
        </button>
      </div>

      <div style={{ borderTop: '1px solid #444', margin: '4px 0' }} />

      {/* Export Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={handleExportAll}
          style={{
            padding: '10px 12px',
            backgroundColor: '#5a4fc4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
          }}
        >
          📤 Export All Layers (SVG)
        </button>

        <button
          onClick={handleSaveProject}
          style={{
            padding: '10px 12px',
            backgroundColor: '#2d9c5e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
          }}
        >
          💾 Save Project (JSON)
        </button>
      </div>

      {/* Stats */}
      <div
        style={{
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#1a1a1a',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#888',
        }}
      >
        <div>Layers: {project.layers.length}</div>
        <div>
          FlowPaths: {project.layers.reduce((sum, l) => sum + l.flowPaths.length, 0)}
        </div>
        <div>
          Standalone: {project.layers.reduce((sum, l) => sum + l.standaloneGenerators.length, 0)}
        </div>
      </div>
    </div>
  );
}
