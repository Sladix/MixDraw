import React, { useState } from 'react';
import { keyboardManager, formatShortcut, type KeyboardShortcut } from '../utils/keyboard';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const allShortcuts = keyboardManager.getAllShortcuts();

  // Group shortcuts by category
  const categories: Record<KeyboardShortcut['category'], string> = {
    general: 'General',
    tools: 'Tools',
    selection: 'Selection',
    transform: 'Transform',
    navigation: 'Navigation',
  };

  // Filter shortcuts by search query
  const filteredShortcuts = searchQuery
    ? allShortcuts.filter(
        (s) =>
          s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          formatShortcut(s).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allShortcuts;

  // Group filtered shortcuts by category
  const groupedShortcuts = Object.keys(categories).reduce((acc, category) => {
    acc[category as KeyboardShortcut['category']] = filteredShortcuts.filter(
      (s) => s.category === category
    );
    return acc;
  }, {} as Record<KeyboardShortcut['category'], KeyboardShortcut[]>);

  return (
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
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          border: '1px solid #333',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid #333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#aaa',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 8px',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px', borderBottom: '1px solid #333' }}>
          <input
            type="text"
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '14px',
            }}
            autoFocus
          />
        </div>

        {/* Shortcuts List */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {Object.entries(categories).map(([category, categoryLabel]) => {
            const shortcuts = groupedShortcuts[category as KeyboardShortcut['category']];

            if (shortcuts.length === 0) return null;

            return (
              <div key={category} style={{ marginBottom: '24px' }}>
                <h3
                  style={{
                    margin: '0 0 12px 0',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#4a9eff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {categoryLabel}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        backgroundColor: '#2a2a2a',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      <span style={{ color: '#ccc' }}>{shortcut.description}</span>
                      <kbd
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #444',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          color: '#fff',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {filteredShortcuts.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                color: '#888',
                fontSize: '14px',
              }}
            >
              No shortcuts found matching "{searchQuery}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: '#888',
          }}
        >
          <span>Press ? to toggle this panel</span>
          <span>Press Esc to close</span>
        </div>
      </div>
    </div>
  );
};
