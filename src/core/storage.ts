import type { Project } from '../types';

const STORAGE_KEY_PREFIX = 'mixdraw_project_';
const STORAGE_INDEX_KEY = 'mixdraw_project_index';

export interface SavedProject {
  id: string;
  name: string;
  timestamp: number;
  project: Project;
}

/**
 * Get list of all saved projects
 */
export function listSavedProjects(): SavedProject[] {
  try {
    const indexJson = localStorage.getItem(STORAGE_INDEX_KEY);
    if (!indexJson) return [];

    const index: string[] = JSON.parse(indexJson);
    const projects: SavedProject[] = [];

    for (const id of index) {
      const projectJson = localStorage.getItem(STORAGE_KEY_PREFIX + id);
      if (projectJson) {
        try {
          const saved = JSON.parse(projectJson);
          projects.push(saved);
        } catch (e) {
          console.error(`Failed to parse project ${id}:`, e);
        }
      }
    }

    // Sort by timestamp descending (newest first)
    return projects.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to list projects:', error);
    return [];
  }
}

/**
 * Save project to localStorage
 * @param project - Project to save
 * @param name - Project name
 * @returns ID of saved project
 */
export function saveProjectToLocalStorage(project: Project, name: string): string {
  try {
    // Generate ID based on timestamp + random
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const saved: SavedProject = {
      id,
      name,
      timestamp: Date.now(),
      project,
    };

    // Save project
    localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify(saved));

    // Update index
    const indexJson = localStorage.getItem(STORAGE_INDEX_KEY);
    const index: string[] = indexJson ? JSON.parse(indexJson) : [];
    index.push(id);
    localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index));

    console.log(`✅ Project saved: ${name} (${id})`);
    return id;
  } catch (error) {
    console.error('Failed to save project:', error);
    throw new Error('Failed to save project. Storage might be full.');
  }
}

/**
 * Load project from localStorage
 * @param id - Project ID
 * @returns Saved project or null if not found
 */
export function loadProjectFromLocalStorage(id: string): SavedProject | null {
  try {
    const projectJson = localStorage.getItem(STORAGE_KEY_PREFIX + id);
    if (!projectJson) return null;

    return JSON.parse(projectJson);
  } catch (error) {
    console.error(`Failed to load project ${id}:`, error);
    return null;
  }
}

/**
 * Delete project from localStorage
 * @param id - Project ID
 */
export function deleteProjectFromLocalStorage(id: string): void {
  try {
    // Remove project data
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);

    // Update index
    const indexJson = localStorage.getItem(STORAGE_INDEX_KEY);
    if (indexJson) {
      const index: string[] = JSON.parse(indexJson);
      const newIndex = index.filter((i) => i !== id);
      localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(newIndex));
    }

    console.log(`✅ Project deleted: ${id}`);
  } catch (error) {
    console.error(`Failed to delete project ${id}:`, error);
    throw new Error('Failed to delete project');
  }
}

/**
 * Update project name
 * @param id - Project ID
 * @param newName - New name
 */
export function renameProject(id: string, newName: string): void {
  try {
    const saved = loadProjectFromLocalStorage(id);
    if (!saved) {
      throw new Error('Project not found');
    }

    saved.name = newName;
    localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify(saved));

    console.log(`✅ Project renamed: ${id} -> ${newName}`);
  } catch (error) {
    console.error(`Failed to rename project ${id}:`, error);
    throw new Error('Failed to rename project');
  }
}

/**
 * Get storage usage info
 */
export function getStorageInfo(): { used: number; total: number; projects: number } {
  try {
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX) || key === STORAGE_INDEX_KEY) {
        const value = localStorage.getItem(key);
        if (value) {
          used += value.length * 2; // 2 bytes per character (UTF-16)
        }
      }
    }

    const projects = listSavedProjects().length;

    // Most browsers give 5-10MB, we'll estimate 5MB
    const total = 5 * 1024 * 1024;

    return { used, total, projects };
  } catch (error) {
    console.error('Failed to get storage info:', error);
    return { used: 0, total: 5 * 1024 * 1024, projects: 0 };
  }
}
