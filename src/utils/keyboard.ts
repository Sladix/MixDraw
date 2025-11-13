/**
 * Keyboard shortcuts system for MixDraw
 */

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
  category: 'tools' | 'selection' | 'transform' | 'navigation' | 'general';
}

class KeyboardShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private enabled = true;

  /**
   * Register a keyboard shortcut
   */
  register(shortcut: KeyboardShortcut) {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(key: string, ctrl?: boolean, shift?: boolean, alt?: boolean) {
    const shortcutKey = this.makeKey(key, ctrl, shift, alt);
    this.shortcuts.delete(shortcutKey);
  }

  /**
   * Handle keyboard event
   */
  handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.enabled) return false;

    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Allow Escape to blur inputs
      if (e.key === 'Escape') {
        target.blur();
        return true;
      }
      return false;
    }

    const key = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey; // Support both Ctrl and Cmd
    const shift = e.shiftKey;
    const alt = e.altKey;

    const shortcutKey = this.makeKey(key, ctrl, shift, alt);
    const shortcut = this.shortcuts.get(shortcutKey);

    if (shortcut) {
      e.preventDefault();
      shortcut.action();
      return true;
    }

    return false;
  }

  /**
   * Get all registered shortcuts
   */
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts by category
   */
  getShortcutsByCategory(category: KeyboardShortcut['category']): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values()).filter(s => s.category === category);
  }

  /**
   * Enable/disable shortcuts
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Clear all shortcuts
   */
  clear() {
    this.shortcuts.clear();
  }

  // Private helpers

  private getShortcutKey(shortcut: KeyboardShortcut): string {
    return this.makeKey(shortcut.key, shortcut.ctrl, shortcut.shift, shortcut.alt);
  }

  private makeKey(key: string, ctrl?: boolean, shift?: boolean, alt?: boolean): string {
    const parts: string[] = [];
    if (ctrl) parts.push('ctrl');
    if (shift) parts.push('shift');
    if (alt) parts.push('alt');
    parts.push(key.toLowerCase());
    return parts.join('+');
  }
}

// Singleton instance
export const keyboardManager = new KeyboardShortcutManager();

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  // Use platform-specific modifier key names
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  if (shortcut.ctrl) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  // Capitalize and format key
  let keyLabel = shortcut.key.toUpperCase();

  // Special key formatting
  const specialKeys: Record<string, string> = {
    'ARROWUP': '↑',
    'ARROWDOWN': '↓',
    'ARROWLEFT': '←',
    'ARROWRIGHT': '→',
    'ESCAPE': 'Esc',
    'DELETE': 'Del',
    'BACKSPACE': '⌫',
    ' ': 'Space',
  };

  keyLabel = specialKeys[keyLabel] || keyLabel;
  parts.push(keyLabel);

  return parts.join('+');
}

/**
 * Setup global keyboard event listener
 */
export function setupKeyboardShortcuts() {
  const handleKeyDown = (e: KeyboardEvent) => {
    keyboardManager.handleKeyDown(e);
  };

  window.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}
