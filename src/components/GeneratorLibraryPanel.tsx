import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { GeneratorRegistry } from '../core/GeneratorRegistry';
import paper from 'paper';
import { seededRandom } from '../utils/random';
import { evaluateAnimatableParams } from '../utils/animatable';

// Component to render a generator preview
function GeneratorPreview({ generatorType, seed }: { generatorType: string; seed: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const size = 80;
    canvas.width = size;
    canvas.height = size;

    // Create temporary Paper.js project for preview
    const tempProject = new paper.Project(canvas);

    try {
      const generator = GeneratorRegistry.get(generatorType);
      if (!generator) return;

      // Generate the shape at t=0.5 with default params
      const defaultParams = GeneratorRegistry.getDefaultParams(generatorType);

      // Evaluate animatable parameters before passing to generator
      const rng = seededRandom(seed);
      const evaluatedParams = evaluateAnimatableParams(defaultParams, 0.5, rng);

      const shape = generator.generate(0.5, evaluatedParams, seed);

      // Calculate bounds to center and scale the shape
      const group = new paper.Group(shape.paths);
      const bounds = group.bounds;

      if (bounds.width > 0 && bounds.height > 0) {
        // Scale to fit in preview (with some padding)
        const padding = 10;
        const scale = Math.min(
          (size - padding * 2) / bounds.width,
          (size - padding * 2) / bounds.height
        );

        // Center the shape
        group.scale(scale);
        group.position = new paper.Point(size / 2, size / 2);

        // Set stroke color
        group.strokeColor = new paper.Color('#4a9eff');
        group.strokeWidth = 1.5;
      }

      tempProject.view.update();
    } catch (error) {
      console.error(`Error generating preview for ${generatorType}:`, error);
    }

    // Cleanup
    return () => {
      tempProject.remove();
    };
  }, [generatorType, seed]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '4px',
        display: 'block',
      }}
    />
  );
}

export function GeneratorLibraryPanel() {
  const selectedGeneratorType = useStore((state) => state.selectedGeneratorType);
  const setSelectedGeneratorType = useStore((state) => state.setSelectedGeneratorType);
  const currentTool = useStore((state) => state.currentTool);
  const setTool = useStore((state) => state.setTool);
  const globalSeed = useStore((state) => state.globalSeed);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const generators = GeneratorRegistry.list();

  // Get all unique tags
  const allTags = Array.from(
    new Set(generators.flatMap((g) => g.tags))
  ).sort();

  // Filter generators
  const filteredGenerators = generators.filter((generator) => {
    const matchesSearch =
      searchTerm === '' ||
      generator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      generator.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTag = filterTag === null || generator.tags.includes(filterTag);

    return matchesSearch && matchesTag;
  });

  const handleGeneratorClick = (type: string) => {
    setSelectedGeneratorType(type);
    // Auto-switch to standalone tool when selecting a generator
    if (currentTool !== 'standalone' && currentTool !== 'flowpath') {
      setTool('standalone');
    }
  };

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
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
          Generator Library
        </h3>
        <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>
          Select a generator to place on canvas
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search generators..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          padding: '8px',
          backgroundColor: '#1a1a1a',
          color: 'white',
          border: '1px solid #555',
          borderRadius: '4px',
          fontSize: '12px',
        }}
      />

      {/* Tag Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <button
          onClick={() => setFilterTag(null)}
          style={{
            padding: '4px 8px',
            backgroundColor: filterTag === null ? '#4a9eff' : '#3a3a3a',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '10px',
            transition: 'all 0.2s',
          }}
        >
          All
        </button>
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setFilterTag(tag === filterTag ? null : tag)}
            style={{
              padding: '4px 8px',
              backgroundColor: filterTag === tag ? '#4a9eff' : '#3a3a3a',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '10px',
              transition: 'all 0.2s',
            }}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Generator List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredGenerators.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
            No generators found
          </div>
        ) : (
          filteredGenerators.map((generator) => (
            <div
              key={generator.type}
              onClick={() => handleGeneratorClick(generator.type)}
              style={{
                padding: '12px',
                backgroundColor:
                  selectedGeneratorType === generator.type ? '#3a4a5a' : '#222',
                border:
                  selectedGeneratorType === generator.type
                    ? '2px solid #4a9eff'
                    : '1px solid #444',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (selectedGeneratorType !== generator.type) {
                  e.currentTarget.style.backgroundColor = '#2a2a2a';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedGeneratorType !== generator.type) {
                  e.currentTarget.style.backgroundColor = '#222';
                }
              }}
            >
              <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                {/* Preview */}
                <div style={{ flexShrink: 0 }}>
                  <GeneratorPreview generatorType={generator.type} seed={globalSeed} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '4px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: 'white' }}>
                      {generator.name}
                    </h4>
                    {selectedGeneratorType === generator.type && (
                      <span style={{ fontSize: '16px', flexShrink: 0 }}>✓</span>
                    )}
                  </div>

                  <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#aaa', lineHeight: '1.4' }}>
                    {generator.description}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {generator.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: '#1a1a1a',
                          borderRadius: '8px',
                          fontSize: '9px',
                          color: '#888',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Status */}
      {selectedGeneratorType && (
        <div
          style={{
            marginTop: 'auto',
            padding: '12px',
            backgroundColor: '#1a1a1a',
            borderRadius: '6px',
            fontSize: '11px',
          }}
        >
          <div style={{ color: '#4a9eff', fontWeight: 'bold', marginBottom: '4px' }}>
            Selected: {generators.find((g) => g.type === selectedGeneratorType)?.name}
          </div>
          {currentTool === 'standalone' && (
            <div style={{ color: '#4c4' }}>✓ Ready to place (click on canvas)</div>
          )}
          {currentTool === 'flowpath' && (
            <div style={{ color: '#fa4' }}>✓ Ready for FlowPath drawing</div>
          )}
          {currentTool !== 'standalone' && currentTool !== 'flowpath' && (
            <div style={{ color: '#c44' }}>Switch to Place or FlowPath tool</div>
          )}
        </div>
      )}
    </div>
  );
}
