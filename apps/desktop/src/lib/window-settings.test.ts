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
    close: vi.fn(),
    scaleFactor: vi.fn(),
    onMoved: vi.fn(),
    onResized: vi.fn(),
    availableMonitors: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => appWindow,
  LogicalPosition: class LogicalPosition {
    readonly unit = 'logical';
    constructor(public x: number, public y: number) {}
  },
  LogicalSize: class LogicalSize {
    readonly unit = 'logical';
    constructor(public width: number, public height: number) {}
  },
  PhysicalPosition: class PhysicalPosition {
    readonly unit = 'physical';
    constructor(public x: number, public y: number) {}
  },
  PhysicalSize: class PhysicalSize {
    readonly unit = 'physical';
    constructor(public width: number, public height: number) {}
  },
}));

import {
  clampWindowSettings,
  closeOverlay,
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
    appWindow.scaleFactor.mockResolvedValue(1);
    appWindow.availableMonitors.mockResolvedValue([]);
  });

  it('falls back to a safe compact position when settings are missing', async () => {
    invoke.mockRejectedValue(new Error('settings_missing'));

    expect(await loadWindowSettings()).toEqual({
      x: 24,
      y: 24,
      width: 248,
      height: 360,
      expanded: false,
    });
  });

  it('clamps malformed and off-screen persisted window bounds', () => {
    expect(clampWindowSettings(
      { x: 50_000, y: -50_000, width: 20_000, height: 10, expanded: true },
      [{ x: 0, y: 0, width: 1920, height: 1080 }],
    )).toEqual({ x: 24, y: 24, width: 1920, height: 120, expanded: true });
  });

  it('preserves negative coordinates when they intersect a secondary monitor', () => {
    expect(clampWindowSettings(
      { x: -1_280, y: 80, width: 640, height: 420, expanded: false },
      [
        { x: -1_280, y: 0, width: 1_280, height: 1_024 },
        { x: 0, y: 0, width: 1_920, height: 1_080 },
      ],
    )).toEqual({ x: -1_280, y: 80, width: 640, height: 420, expanded: false });
  });

  it('keeps 4k-sized bounds when they fit a monitor', () => {
    expect(clampWindowSettings(
      { x: 2_560, y: 120, width: 2_560, height: 1_440, expanded: true },
      [
        { x: 0, y: 0, width: 1_920, height: 1_080 },
        { x: 2_560, y: 0, width: 3_840, height: 2_160 },
      ],
    )).toEqual({ x: 2_560, y: 120, width: 2_560, height: 1_440, expanded: true });
  });

  it('persists only window geometry and expansion state', async () => {
    invoke.mockResolvedValue(undefined);
    const settings = { x: 80, y: 48, width: 760, height: 680, expanded: true };

    await saveWindowSettings(settings);

    expect(invoke).toHaveBeenCalledWith('save_window_settings', { settings });
  });

  it('switches the current window into overlay mode and restores its bounds', async () => {
    let moved: ((event: { payload: { x: number; y: number } }) => void | Promise<void>) | undefined;
    appWindow.onMoved.mockImplementation(async (callback: typeof moved) => {
      moved = callback;
      return () => undefined;
    });
    appWindow.scaleFactor.mockResolvedValue(2);
    appWindow.availableMonitors.mockResolvedValue([
      {
        name: 'primary',
        scaleFactor: 2,
        position: { x: 0, y: 0 },
        size: { width: 1_920, height: 1_080 },
        workArea: {
          position: { x: 0, y: 0 },
          size: { width: 1_920, height: 1_080 },
        },
      },
    ]);
    invoke.mockResolvedValue({ x: 80, y: 48, width: 640, height: 560, expanded: true });

    expect(await enterOverlayMode()).toBe(true);

    expect(appWindow.setDecorations).toHaveBeenCalledWith(false);
    expect(appWindow.setAlwaysOnTop).toHaveBeenCalledWith(true);
    expect(appWindow.setResizable).toHaveBeenCalledWith(false);
    expect(appWindow.setMinSize).toHaveBeenCalledWith(expect.objectContaining({ width: 240, height: 120 }));
    expect(appWindow.setPosition).toHaveBeenCalledWith(expect.objectContaining({ x: 80, y: 48, unit: 'logical' }));
    expect(appWindow.setSize).toHaveBeenCalledWith(
      expect.objectContaining({ width: 640, height: 560, unit: 'logical' }),
    );

    invoke.mockClear();
    await moved?.({ payload: { x: 192, y: 144 } });
    expect(invoke).toHaveBeenCalledWith('save_window_settings', {
      settings: { x: 96, y: 72, width: 640, height: 560, expanded: true },
    });
  });

  it('closes the native overlay window', async () => {
    appWindow.close.mockResolvedValue(undefined);

    await closeOverlay();

    expect(appWindow.close).toHaveBeenCalledTimes(1);
  });

  it('changes only the width when toggling expansion and keeps the content-driven height', async () => {
    invoke.mockResolvedValue({ x: 24, y: 24, width: 248, height: 300, expanded: false });
    await enterOverlayMode();
    invoke.mockClear();

    await setOverlayExpanded(true);

    expect(appWindow.setSize).toHaveBeenCalledWith(
      expect.objectContaining({ width: 460, height: 300, unit: 'logical' }),
    );
    expect(invoke).toHaveBeenCalledWith('save_window_settings', {
      settings: { x: 24, y: 24, width: 460, height: 300, expanded: true },
    });
  });
});
