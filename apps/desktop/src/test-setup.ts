import '@testing-library/jest-dom/vitest';

// Radix UI primitives (ScrollArea, ToggleGroup, Tooltip) rely on browser APIs
// that jsdom does not implement. Provide inert shims so component tests run.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (!('matchMedia' in globalThis)) {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof globalThis.matchMedia;
}

for (const method of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture', 'scrollIntoView'] as const) {
  if (!(method in Element.prototype)) {
    Object.defineProperty(Element.prototype, method, { configurable: true, value: () => undefined });
  }
}
