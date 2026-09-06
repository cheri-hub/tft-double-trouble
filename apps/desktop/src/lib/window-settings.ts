import { invoke } from '@tauri-apps/api/core';
import {
  availableMonitors,
  getCurrentWindow,
  LogicalPosition,
  LogicalSize,
} from '@tauri-apps/api/window';

export type WindowSettings = {
  x: number;
  y: number;
  width: number;
  height: number;
  expanded: boolean;
};

export const DEFAULT_WINDOW_SETTINGS: WindowSettings = {
  x: 24,
  y: 24,
  width: 320,
  height: 420,
  expanded: false,
};

const EXPANDED_SIZE = { width: 760, height: 680 };
const MAX_WINDOW_SIZE = { width: 1920, height: 1080 };

type LogicalMonitorBounds = { x: number; y: number; width: number; height: number };

let currentSettings: WindowSettings = { ...DEFAULT_WINDOW_SETTINGS };
let listenersInstalled = false;

export async function loadWindowSettings(): Promise<WindowSettings> {
  try {
    const settings = await invoke<WindowSettings>('get_window_settings');
    return clampWindowSettings(settings, await monitorBounds());
  } catch {
    return { ...DEFAULT_WINDOW_SETTINGS };
  }
}

export function clampWindowSettings(
  settings: WindowSettings,
  monitors: readonly LogicalMonitorBounds[] = [],
): WindowSettings {
  const limits = monitorLimits(monitors);
  const width = clampFinite(settings.width, DEFAULT_WINDOW_SETTINGS.width, limits.width);
  const height = clampFinite(settings.height, DEFAULT_WINDOW_SETTINGS.height, limits.height);
  const candidate = {
    x: finiteInteger(settings.x, DEFAULT_WINDOW_SETTINGS.x),
    y: finiteInteger(settings.y, DEFAULT_WINDOW_SETTINGS.y),
    width,
    height,
    expanded: Boolean(settings.expanded),
  };
  const intersectsMonitor = monitors.length === 0 || monitors.some((monitor) => (
    candidate.x + width > monitor.x
    && candidate.x < monitor.x + monitor.width
    && candidate.y + height > monitor.y
    && candidate.y < monitor.y + monitor.height
  ));
  return intersectsMonitor
    ? candidate
    : { ...candidate, x: DEFAULT_WINDOW_SETTINGS.x, y: DEFAULT_WINDOW_SETTINGS.y };
}

export async function saveWindowSettings(settings: WindowSettings): Promise<void> {
  await invoke('save_window_settings', { settings: clampWindowSettings(settings, await monitorBounds()) });
}

function finiteInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function clampFinite(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, finiteInteger(value, minimum)));
}

function monitorLimits(monitors: readonly LogicalMonitorBounds[]): { width: number; height: number } {
  if (!monitors.length) return MAX_WINDOW_SIZE;
  return monitors.reduce((limits, monitor) => ({
    width: Math.max(limits.width, monitor.width),
    height: Math.max(limits.height, monitor.height),
  }), { width: DEFAULT_WINDOW_SETTINGS.width, height: DEFAULT_WINDOW_SETTINGS.height });
}

async function monitorBounds(): Promise<LogicalMonitorBounds[]> {
  try {
    const monitors = await availableMonitors();
    if (monitors.length) {
      return monitors.map((monitor) => ({
        x: Math.round(monitor.workArea.position.x / monitor.scaleFactor),
        y: Math.round(monitor.workArea.position.y / monitor.scaleFactor),
        width: Math.round(monitor.workArea.size.width / monitor.scaleFactor),
        height: Math.round(monitor.workArea.size.height / monitor.scaleFactor),
      }));
    }
  } catch {
    // Fall back to the browser screen geometry when native monitor queries are unavailable.
  }
  return browserMonitorBounds();
}

function browserMonitorBounds(): LogicalMonitorBounds[] {
  if (typeof window === 'undefined' || !window.screen?.availWidth || !window.screen?.availHeight) return [];
  return [{ x: 0, y: 0, width: window.screen.availWidth, height: window.screen.availHeight }];
}

export async function enterOverlayMode(): Promise<boolean> {
  const appWindow = getCurrentWindow();
  currentSettings = await loadWindowSettings();

  await Promise.all([
    appWindow.setDecorations(false),
    appWindow.setAlwaysOnTop(true),
    appWindow.setResizable(true),
    appWindow.setMinSize(new LogicalSize(DEFAULT_WINDOW_SETTINGS.width, DEFAULT_WINDOW_SETTINGS.height)),
    appWindow.setPosition(new LogicalPosition(currentSettings.x, currentSettings.y)),
    appWindow.setSize(new LogicalSize(currentSettings.width, currentSettings.height)),
  ]);

  if (!listenersInstalled) {
    listenersInstalled = true;
    await appWindow.onMoved(async ({ payload }) => {
      const scaleFactor = await appWindow.scaleFactor();
      currentSettings = {
        ...currentSettings,
        x: Math.round(payload.x / scaleFactor),
        y: Math.round(payload.y / scaleFactor),
      };
      await saveWindowSettings(currentSettings).catch(() => undefined);
    });
    await appWindow.onResized(async ({ payload }) => {
      const scaleFactor = await appWindow.scaleFactor();
      currentSettings = {
        ...currentSettings,
        width: Math.round(payload.width / scaleFactor),
        height: Math.round(payload.height / scaleFactor),
      };
      await saveWindowSettings(currentSettings).catch(() => undefined);
    });
  }

  return currentSettings.expanded;
}

export async function setOverlayExpanded(expanded: boolean): Promise<void> {
  const size = expanded
    ? EXPANDED_SIZE
    : { width: DEFAULT_WINDOW_SETTINGS.width, height: DEFAULT_WINDOW_SETTINGS.height };
  currentSettings = { ...currentSettings, ...size, expanded };

  await getCurrentWindow().setSize(new LogicalSize(size.width, size.height));
  await saveWindowSettings(currentSettings);
}
