/**
 * Google Analytics utilities for FlowField Generator
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

// Event categories
type EventCategory = 'export' | 'canvas' | 'lines' | 'forces' | 'colors' | 'zones';

interface AnalyticsEvent {
  action: string;
  category: EventCategory;
  label?: string;
  value?: number;
}

/**
 * Track an event in Google Analytics
 */
export function trackEvent({ action, category, label, value }: AnalyticsEvent): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
}

// Pre-defined events for common actions
export const analytics = {
  // Export events
  exportSVG: (format: string, seed: number, hash: string) =>
    trackEvent({
      action: 'export_svg',
      category: 'export',
      label: `${format}_${seed}_${hash}`,
    }),

  exportPNG: (format: string, seed: number, hash: string) =>
    trackEvent({
      action: 'export_png',
      category: 'export',
      label: `${format}_${seed}_${hash}`,
    }),

  // Canvas events
  changeFormat: (format: string) =>
    trackEvent({
      action: 'change_format',
      category: 'canvas',
      label: format,
    }),

  changeSeed: (method: 'manual' | 'random') =>
    trackEvent({
      action: 'change_seed',
      category: 'canvas',
      label: method,
    }),

  regenerate: () =>
    trackEvent({
      action: 'regenerate',
      category: 'canvas',
    }),

  // Line params events
  changeLineParam: (param: string, value: number | boolean) =>
    trackEvent({
      action: 'change_line_param',
      category: 'lines',
      label: param,
      value: typeof value === 'number' ? value : (value ? 1 : 0),
    }),

  // Force events
  addForce: (forceType: string) =>
    trackEvent({
      action: 'add_force',
      category: 'forces',
      label: forceType,
    }),

  removeForce: (forceType: string) =>
    trackEvent({
      action: 'remove_force',
      category: 'forces',
      label: forceType,
    }),

  toggleForce: (forceType: string, enabled: boolean) =>
    trackEvent({
      action: 'toggle_force',
      category: 'forces',
      label: `${forceType}_${enabled ? 'on' : 'off'}`,
    }),

  // Color events
  changeColorMode: (mode: string) =>
    trackEvent({
      action: 'change_color_mode',
      category: 'colors',
      label: mode,
    }),

  applyColorPreset: (presetName: string) =>
    trackEvent({
      action: 'apply_color_preset',
      category: 'colors',
      label: presetName,
    }),

  // Zone events
  toggleZones: (enabled: boolean) =>
    trackEvent({
      action: 'toggle_zones',
      category: 'zones',
      label: enabled ? 'on' : 'off',
    }),
};
