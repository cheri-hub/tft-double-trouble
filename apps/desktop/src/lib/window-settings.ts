import { invoke } from '@tauri-apps/api/core';
import {
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  PhysicalSize,
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

let currentSettings: WindowSettings = { ...DEFAULT_WINDOW_SETTINGS };
let listenersInstalled = false;

export async function loadWindowSettings(): Promise<WindowSettings> {
  try {
    return await invoke<WindowSettings>('get_window_settings');
  } catch {
    return { ...DEFAULT_WINDOW_SETTINGS };
  }
}

export async function saveWindowSettings(settings: WindowSettings): Promise<void> {
  await invoke('save_window_settings', { settings });
}

export async function enterOverlayMode(): Promise<boolean> {
  const appWindow = getCurrentWindow();
  currentSettings = await loadWindowSettings();

  await Promise.all([
    appWindow.setDecorations(false),
    appWindow.setAlwaysOnTop(true),
    appWindow.setResizable(true),
    appWindow.setMinSize(new LogicalSize(DEFAULT_WINDOW_SETTINGS.width, DEFAULT_WINDOW_SETTINGS.height)),
    appWindow.setPosition(new PhysicalPosition(currentSettings.x, currentSettings.y)),
    appWindow.setSize(new PhysicalSize(currentSettings.width, currentSettings.height)),
  ]);

  if (!listenersInstalled) {
    listenersInstalled = true;
    await appWindow.onMoved(({ payload }) => {
      currentSettings = { ...currentSettings, x: payload.x, y: payload.y };
      void saveWindowSettings(currentSettings).catch(() => undefined);
    });
    await appWindow.onResized(({ payload }) => {
      currentSettings = { ...currentSettings, width: payload.width, height: payload.height };
      void saveWindowSettings(currentSettings).catch(() => undefined);
    });
  }

  return currentSettings.expanded;
}

export async function setOverlayExpanded(expanded: boolean): Promise<void> {
  const size = expanded
    ? EXPANDED_SIZE
    : { width: DEFAULT_WINDOW_SETTINGS.width, height: DEFAULT_WINDOW_SETTINGS.height };
  currentSettings = { ...currentSettings, ...size, expanded };

  await getCurrentWindow().setSize(new PhysicalSize(size.width, size.height));
  await saveWindowSettings(currentSettings);
}
