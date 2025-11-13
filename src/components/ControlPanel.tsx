import { useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { exportAllLayers, saveProject, loadProject } from '../core/export';
import { PAPER_FORMATS, mmToPx } from '../types/formats';
import type { FormatType } from '../types/formats';
import {
  saveProjectToLocalStorage,
  listSavedProjects,
  loadProjectFromLocalStorage,
  deleteProjectFromLocalStorage,
  getStorageInfo,
  type SavedProject,
} from '../core/storage';
import { generateComposition, getCompositionTypes } from '../core/compositionGenerator';

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
  const loadProjectToStore = useStore((state) => state.loadProject);
  const addFlowPath = useStore((state) => state.addFlowPath);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectLoadRef = useRef<HTMLInputElement>(null);

  const [showProjectBrowser, setShowProjectBrowser] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [showCompositionGenerator, setShowCompositionGenerator] = useState(false);

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

  const handleSaveToLocalStorage = () => {
    try {
      const name = projectName || 'Untitled Project';
      saveProjectToLocalStorage(project, name);
      alert(`Project "${name}" saved successfully!`);
    } catch (error) {
      alert('Failed to save project: ' + (error as Error).message);
    }
  };

  const handleLoadFromLocalStorage = () => {
    setSavedProjects(listSavedProjects());
    setShowProjectBrowser(true);
  };

  const handleLoadProject = (saved: SavedProject) => {
    if (confirm(`Load project "${saved.name}"? Current work will be lost.`)) {
      loadProjectToStore(saved.project);
      setProjectName(saved.name);
      setShowProjectBrowser(false);
      console.log(`✅ Loaded project: ${saved.name}`);
    }
  };

  const handleDeleteProject = (id: string, name: string) => {
    if (confirm(`Delete project "${name}"? This cannot be undone.`)) {
      deleteProjectFromLocalStorage(id);
      setSavedProjects(listSavedProjects());
    }
  };

  const handleLoadFromFile = () => {
    projectLoadRef.current?.click();
  };

  const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const loadedProject = await loadProject(file);
      if (confirm(`Load project from file? Current work will be lost.`)) {
        loadProjectToStore(loadedProject);
        setProjectName(file.name.replace('.json', ''));
        console.log('✅ Project loaded from file');
      }
    } catch (error) {
      alert('Failed to load project: ' + (error as Error).message);
    }

    // Reset input
    e.target.value = '';
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

  const handleGenerateComposition = (compositionType: string, usePacking: boolean, addStandalones: boolean) => {
    // Get canvas dimensions
    const format = PAPER_FORMATS[paperFormat];
    const canvasWidth = mmToPx(paperOrientation === 'portrait' ? format.width : format.height);
    const canvasHeight = mmToPx(paperOrientation === 'portrait' ? format.height : format.width);

    // Generate composition
    const { flowPath, standalones } = generateComposition({
      type: compositionType as any,
      generatorType: '', // Let it pick randomly
      usePacking,
      addStandalones,
      canvasWidth,
      canvasHeight,
      seed: globalSeed,
      paperFormat,
      paperOrientation,
    });

    // Add flowpath to first layer
    if (project.layers.length > 0) {
      addFlowPath(project.layers[0].id, flowPath);
    }

    // Close the modal
    setShowCompositionGenerator(false);

    // Regenerate seed for next generation
    regenerateSeed();
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

      {/* Project Name */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', color: '#aaa' }}>Project Name</label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Untitled Project"
          style={{
            padding: '8px',
            backgroundColor: '#1a1a1a',
            color: 'white',
            border: '1px solid #555',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        />
      </div>

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

      {/* Generate Composition */}
      <button
        onClick={() => setShowCompositionGenerator(true)}
        style={{
          padding: '10px 12px',
          backgroundColor: '#8b4eff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          justifyContent: 'center',
        }}
      >
        <span>✨</span>
        Generate Composition
      </button>

      <div style={{ borderTop: '1px solid #444', margin: '4px 0' }} />

      {/* Save/Load Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={handleSaveToLocalStorage}
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
          💾 Save to Browser
        </button>

        <button
          onClick={handleLoadFromLocalStorage}
          style={{
            padding: '10px 12px',
            backgroundColor: '#4a9eff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
          }}
        >
          📂 Load from Browser
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSaveProject}
            style={{
              flex: 1,
              padding: '8px 10px',
              backgroundColor: '#3a3a3a',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            💾 Save File
          </button>

          <button
            onClick={handleLoadFromFile}
            style={{
              flex: 1,
              padding: '8px 10px',
              backgroundColor: '#3a3a3a',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            📁 Load File
          </button>
        </div>

        <input
          ref={projectLoadRef}
          type="file"
          accept=".json"
          onChange={handleFileLoad}
          style={{ display: 'none' }}
        />
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

      {/* Project Browser Modal */}
      {showProjectBrowser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowProjectBrowser(false)}
        >
          <div
            style={{
              backgroundColor: '#2a2a2a',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', color: 'white' }}>
                Saved Projects ({savedProjects.length})
              </h3>
              <button
                onClick={() => setShowProjectBrowser(false)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ✕
              </button>
            </div>

            {savedProjects.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#888',
                  fontSize: '14px',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                <div>No saved projects yet</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                  Save your current project to get started
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {savedProjects.map((saved) => (
                  <div
                    key={saved.id}
                    style={{
                      padding: '16px',
                      backgroundColor: '#1a1a1a',
                      borderRadius: '6px',
                      border: '1px solid #444',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: 'white',
                          marginBottom: '8px',
                        }}
                      >
                        {saved.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                        {new Date(saved.timestamp).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        {saved.project.layers.length} layers,{' '}
                        {saved.project.layers.reduce((sum, l) => sum + l.flowPaths.length, 0)}{' '}
                        flowpaths
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleLoadProject(saved)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#4a9eff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteProject(saved.id, saved.name)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#c44',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#1a1a1a',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#666',
              }}
            >
              {(() => {
                const info = getStorageInfo();
                const usedMB = (info.used / (1024 * 1024)).toFixed(2);
                const totalMB = (info.total / (1024 * 1024)).toFixed(0);
                const percent = ((info.used / info.total) * 100).toFixed(1);
                return (
                  <div>
                    Storage: {usedMB}MB / {totalMB}MB ({percent}%)
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Composition Generator Modal */}
      {showCompositionGenerator && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={() => setShowCompositionGenerator(false)}
        >
          <div
            style={{
              backgroundColor: '#2a2a2a',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflowY: 'auto',
              color: 'white',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Generate Composition</h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#aaa' }}>
              Choose a composition style to generate an aesthetic flowpath
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {getCompositionTypes().map((comp) => (
                <button
                  key={comp.type}
                  onClick={() => {
                    // Show options or generate directly
                    const usePacking = confirm('Use packing distribution? (Cancel for grid/noise)');
                    const addStandalones = confirm('Add standalone elements?');
                    handleGenerateComposition(comp.type, usePacking, addStandalones);
                  }}
                  style={{
                    padding: '16px',
                    backgroundColor: '#3a3a3a',
                    border: '1px solid #555',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#4a4a4a';
                    e.currentTarget.style.borderColor = '#4a9eff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#3a3a3a';
                    e.currentTarget.style.borderColor = '#555';
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: '#4a9eff' }}>
                    {comp.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>
                    {comp.description}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCompositionGenerator(false)}
              style={{
                marginTop: '20px',
                padding: '10px 16px',
                backgroundColor: '#555',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                width: '100%',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
