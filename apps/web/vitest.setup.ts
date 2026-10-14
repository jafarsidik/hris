import '@testing-library/jest-dom/vitest';

/**
 * jsdom implements neither `matchMedia` nor `ResizeObserver`.
 *
 * The sidebar uses `matchMedia` to decide between an off-canvas sheet and a docked rail,
 * and the shadcn primitives use `ResizeObserver` to measure panels. Both are browser APIs
 * that jsdom leaves out entirely, so without these stubs any test touching a sidebar or a
 * dialog fails with "window.matchMedia is not a function" — a failure that says nothing
 * about the component.
 *
 * These stubs report the desktop layout. A test that needs the mobile layout should set
 * the width it needs rather than rely on the default, since which layout is under test is
 * the thing worth being explicit about.
 */

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string): MediaQueryList =>
    ({
      /*
       * Reports "not a narrow viewport" for any width query, which is what
       * `useIsMobile` asks. jsdom reports `innerWidth` as 0, so answering from that would
       * hand every test the mobile sheet and hide the docked rail entirely.
       */
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList,
});

Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1280,
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

/*
 * Base UI's checkbox dispatches an augmented click that constructs a `PointerEvent`
 * (to carry the keyboard-modifier state of the click). jsdom ships no PointerEvent
 * constructor, so the synthetic event falls over before the click is handled. MouseEvent
 * is assignable to PointerEvent for a test runtime: both expose type, target, and the
 * module flags the framework reads back off the event.
 */
if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
}
