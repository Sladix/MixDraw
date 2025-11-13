import type { Project } from '../types';

/**
 * History management for undo/redo functionality
 */

export interface HistoryState {
  past: Project[];
  future: Project[];
  maxHistory: number;
}

/**
 * Create initial history state
 */
export function createHistoryState(maxHistory = 50): HistoryState {
  return {
    past: [],
    future: [],
    maxHistory,
  };
}

/**
 * Push a new state to history (before making changes)
 */
export function pushHistory(
  history: HistoryState,
  currentProject: Project
): HistoryState {
  const newPast = [...history.past, currentProject];

  // Limit history size
  if (newPast.length > history.maxHistory) {
    newPast.shift(); // Remove oldest entry
  }

  return {
    ...history,
    past: newPast,
    future: [], // Clear future when new action is performed
  };
}

/**
 * Undo: Move back in history
 */
export function undo(
  history: HistoryState,
  currentProject: Project
): { history: HistoryState; project: Project | null } {
  if (history.past.length === 0) {
    return { history, project: null };
  }

  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, -1);

  return {
    history: {
      ...history,
      past: newPast,
      future: [currentProject, ...history.future],
    },
    project: previous,
  };
}

/**
 * Redo: Move forward in history
 */
export function redo(
  history: HistoryState,
  currentProject: Project
): { history: HistoryState; project: Project | null } {
  if (history.future.length === 0) {
    return { history, project: null };
  }

  const next = history.future[0];
  const newFuture = history.future.slice(1);

  return {
    history: {
      ...history,
      past: [...history.past, currentProject],
      future: newFuture,
    },
    project: next,
  };
}

/**
 * Clear all history
 */
export function clearHistory(): HistoryState {
  return createHistoryState();
}

/**
 * Check if undo is available
 */
export function canUndo(history: HistoryState): boolean {
  return history.past.length > 0;
}

/**
 * Check if redo is available
 */
export function canRedo(history: HistoryState): boolean {
  return history.future.length > 0;
}

/**
 * Deep clone a project for history
 * Using JSON stringify/parse for simplicity - Paper.js objects are already serialized
 */
export function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project));
}
