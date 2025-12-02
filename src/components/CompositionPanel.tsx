/**
 * CompositionPanel - UI for magazine cover composition generation
 *
 * Features:
 * - Template selection dropdown (10 templates + Random)
 * - Seed input for reproducibility
 * - Generate/Regenerate buttons
 * - Preview of selected template description
 */

import { useState } from 'react';
import { useStore } from '../store/useStore';
import { composeMagazineCover, getTemplateOptions } from '../core/composition';

interface CompositionPanelProps {
  onClose?: () => void;
}

export function CompositionPanel({ onClose }: CompositionPanelProps) {
  const globalSeed = useStore((state) => state.globalSeed);
  const regenerateSeed = useStore((state) => state.regenerateSeed);
  const setGlobalSeed = useStore((state) => state.setGlobalSeed);

  const [selectedTemplate, setSelectedTemplate] = useState('random');
  const [seed, setSeed] = useState(globalSeed);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const templates = getTemplateOptions();

  const handleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      setSeed(value);
    }
  };

  const handleRandomSeed = () => {
    const newSeed = Math.floor(Math.random() * 1000000);
    setSeed(newSeed);
  };

  const handleGenerate = () => {
    setIsGenerating(true);

    try {
      // Generate the composition
      const result = composeMagazineCover({
        templateId: selectedTemplate,
        seed,
        enableSpawning: true
      });

      // Get store actions
      const store = useStore.getState();

      // Add generated layers with their content
      for (const layer of result.layers) {
        // Create the layer using addLayer (creates empty layer)
        store.addLayer();

        // Get the newly created layer (last one)
        const currentLayers = useStore.getState().project.layers;
        const newLayer = currentLayers[currentLayers.length - 1];

        // Update the layer with composition settings
        store.updateLayer(newLayer.id, {
          name: layer.name,
          color: layer.color,
          strokeWidth: layer.strokeWidth,
          order: currentLayers.length - 1
        });

        // Add FlowPaths to the layer
        for (const fp of layer.flowPaths) {
          const { id: _fpId, layerId: _fpLayerId, ...flowPathData } = fp;
          store.addFlowPath(newLayer.id, flowPathData);
        }

        // Add StandaloneGenerators to the layer
        for (const sg of layer.standaloneGenerators) {
          const { id: _sgId, layerId: _sgLayerId, ...standaloneData } = sg;
          store.addStandaloneGenerator(newLayer.id, standaloneData);
        }
      }

      setLastGenerated(result.metadata.templateName);

      // Update global seed and regenerate for next time
      setGlobalSeed(seed);
      regenerateSeed();
      setSeed(useStore.getState().globalSeed);

      console.log(`Generated composition: ${result.metadata.templateName}`);
      console.log(`  Slots: ${result.metadata.slotCount}`);
      console.log(`  Generators: ${result.metadata.generatorTypes.join(', ')}`);

    } catch (error) {
      console.error('Failed to generate composition:', error);
      alert('Failed to generate composition: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedTemplateInfo = templates.find(t => t.id === selectedTemplate);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#2a2a2a',
          borderRadius: '8px',
          padding: '24px',
          minWidth: '400px',
          maxWidth: '500px',
          border: '1px solid #444',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px 0', color: 'white', fontSize: '18px' }}>
          Generate Magazine Cover
        </h3>

        {/* Template Selection */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '6px' }}>
            Template
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#1a1a1a',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          {selectedTemplateInfo && (
            <p style={{ fontSize: '12px', color: '#888', marginTop: '6px', marginBottom: 0 }}>
              {selectedTemplateInfo.description}
            </p>
          )}
        </div>

        {/* Seed Input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '6px' }}>
            Seed
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="number"
              value={seed}
              onChange={handleSeedChange}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#1a1a1a',
                color: 'white',
                border: '1px solid #555',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
            <button
              onClick={handleRandomSeed}
              style={{
                padding: '10px 16px',
                backgroundColor: '#3a3a3a',
                color: 'white',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
              title="Generate random seed"
            >
              Random
            </button>
          </div>
        </div>

        {/* Last Generated Info */}
        {lastGenerated && (
          <div style={{
            marginBottom: '16px',
            padding: '10px',
            backgroundColor: '#1a3a1a',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#8f8',
          }}>
            Last generated: {lastGenerated}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3a3a3a',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              padding: '10px 24px',
              backgroundColor: isGenerating ? '#2a5a8a' : '#4a9eff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {/* Help Text */}
        <p style={{
          fontSize: '11px',
          color: '#666',
          marginTop: '16px',
          marginBottom: 0,
          textAlign: 'center',
        }}>
          This will create 3 new layers (Background, Midground, Foreground) with generated content.
        </p>
      </div>
    </div>
  );
}
