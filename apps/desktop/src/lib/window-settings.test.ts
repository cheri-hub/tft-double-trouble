import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
const { appWindow } = vi.hoisted(() => ({
  appWindow: {
    setDecorations: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setResizable: vi.fn(),
    setMinSize: vi.fn(),
    setPosition: vi.fn(),
    setSize: vi.fn(),
    onMoved: vi.fn(),
    onResized: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => appWindow,
  LogicalPosition: class LogicalPosition {
    constructor(public x: number, public y: number) {}
  },
  LogicalSize: class LogicalSize {
    constructor(public width: number, public height: number) {}
  },
  PhysicalPosition: class PhysicalPosition {
    constructor(public x: number, public y: number) {}
  },
  PhysicalSize: class PhysicalSize {
    constructor(public width: number, public height: number) {}
  },
}));

import {
  enterOverlayMode,
  loadWindowSettings,
  saveWindowSettings,
  setOverlayExpanded,
} from './window-settings';

describe('window settings', () => {
  beforeEach(() => {
    invoke.mockReset();
    Object.values(appWindow).forEach((mock) => mock.mockReset());
    appWindow.onMoved.mockResolvedValue(() => undefined);
    appWindow.onResized.mockResolvedValue(() => undefined);
  });

  it('falls back to a safe compact position when settings are missing', async () => {
    invoke.mockRejectedValue(new Error('settings_missing'));

    expect(await loadWindowSettings()).toEqual({
      x: 24,
      y: 24,
      width: 320,
      height: 420,
      expanded: false,
    });
  });

  it('persists only window geometry and expansion state', async () => {
    invoke.mockResolvedValue(undefined);
    const settings = { x: 80, y: 48, width: 760, height: 680, expanded: true };

    await saveWindowSettings(settings);

    expect(invoke).toHaveBeenCalledWith('save_window_settings', { settings });
  });

  it('switches the current window into overlay mode and restores its bounds', async () => {
    let moved: ((event: { payload: { x: number; y: number } }) => void) | undefined;
    appWindow.onMoved.mockImplementation(async (callback: typeof moved) => {
      moved = callback;
      return () => undefined;
    });
    invoke.mockResolvedValue({ x: 80, y: 48, width: 640, height: 560, expanded: true });

    expect(await enterOverlayMode()).toBe(true);

    expect(appWindow.setDecorations).toHaveBeenCalledWith(false);
    expect(appWindow.setAlwaysOnTop).toHaveBeenCalledWith(true);
    expect(appWindow.setResizable).toHaveBeenCalledWith(true);
    expect(appWindow.setMinSize).toHaveBeenCalledWith(expect.objectContaining({ width: 320, height: 420 }));
    expect(appWindow.setPosition).toHaveBeenCalledWith(expect.objectContaining({ x: 80, y: 48 }));
    expect(appWindow.setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 640, height: 560 }));

    invoke.mockClear();
    moved?.({ payload: { x: 96, y: 72 } });
    expect(invoke).toHaveBeenCalledWith('save_window_settings', {
      settings: { x: 96, y: 72, width: 640, height: 560, expanded: true },
    });
  });

  it('resizes the existing overlay and persists expansion state', async () => {
    invoke.mockResolvedValue({ x: 24, y: 24, width: 320, height: 420, expanded: false });
    await enterOverlayMode();
    invoke.mockClear();

    await setOverlayExpanded(true);

    expect(appWindow.setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 760, height: 680 }));
    expect(invoke).toHaveBeenCalledWith('save_window_settings', {
      settings: { x: 24, y: 24, width: 760, height: 680, expanded: true },
    });
  });
});
