import React from 'react';
import type { AnyModifier, SizeModifier, RotationModifier, SpacingModifier } from '../types';
import { ModifierControl } from './ModifierControl';

interface Props {
  modifiers: AnyModifier[];
  onUpdate: (modifiers: AnyModifier[]) => void;
}

/**
 * List of modifiers with add/remove/update controls
 */
export function ModifierList({ modifiers, onUpdate }: Props) {
  const addModifier = (type: 'size' | 'rotation' | 'spacing' | 'spread') => {
    let newModifier: AnyModifier;

    switch (type) {
      case 'size':
        newModifier = {
          id: `modifier-${Date.now()}`,
          type: 'size',
          enabled: true,
          tStart: 0,
          tEnd: 1,
          valueStart: 1.0,
          valueEnd: 1.0,
          curve: 'linear',
        } as SizeModifier;
        break;

      case 'rotation':
        newModifier = {
          id: `modifier-${Date.now()}`,
          type: 'rotation',
          enabled: true,
          tStart: 0,
          tEnd: 1,
          valueStart: 0,
          valueEnd: 90,
          curve: 'linear',
        } as RotationModifier;
        break;

      case 'spacing':
        newModifier = {
          id: `modifier-${Date.now()}`,
          type: 'spacing',
          enabled: true,
          tStart: 0,
          tEnd: 1,
          valueStart: 1.0,
          valueEnd: 1.0,
          curve: 'linear',
        } as SpacingModifier;
        break;

      case 'spread':
        newModifier = {
          id: `modifier-${Date.now()}`,
          type: 'spread',
          enabled: true,
          tStart: 0,
          tEnd: 1,
          valueStart: 10,
          valueEnd: 10,
          curve: 'linear',
        } as any; // SpreadModifier
        break;
    }

    onUpdate([...modifiers, newModifier]);
  };

  const updateModifier = (id: string, updates: Partial<AnyModifier>) => {
    onUpdate(modifiers.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const removeModifier = (id: string) => {
    onUpdate(modifiers.filter((m) => m.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Empty state */}
      {modifiers.length === 0 && (
        <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', padding: '8px 0' }}>
          No modifiers. Add modifiers to control size, rotation, or spacing along the curve.
        </div>
      )}

      {/* Modifier List */}
      {modifiers.map((modifier) => (
        <ModifierControl
          key={modifier.id}
          modifier={modifier}
          onUpdate={(updates) => updateModifier(modifier.id, updates)}
          onRemove={() => removeModifier(modifier.id)}
        />
      ))}

      {/* Add Buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: modifiers.length > 0 ? '8px' : '0' }}>
        <button
          onClick={() => addModifier('size')}
          style={{
            flex: '1 1 45%',
            padding: '8px 12px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3a3a3a')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2a2a2a')}
        >
          + Size
        </button>
        <button
          onClick={() => addModifier('rotation')}
          style={{
            flex: '1 1 45%',
            padding: '8px 12px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3a3a3a')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2a2a2a')}
        >
          + Rotation
        </button>
        <button
          onClick={() => addModifier('spread')}
          style={{
            flex: '1 1 45%',
            padding: '8px 12px',
            backgroundColor: '#1a3a1a',
            border: '1px solid #4ade80',
            borderRadius: '4px',
            color: '#4ade80',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2a4a2a')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1a3a1a')}
        >
          + Spread
        </button>
      </div>
    </div>
  );
}
