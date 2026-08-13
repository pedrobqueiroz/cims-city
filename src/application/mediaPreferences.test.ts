import { describe, expect, it } from 'vitest';
import { subscribeMediaPreferences } from './mediaPreferences';

class FakeMediaQueryList {
  matches: boolean;
  readonly media = '';
  onchange: ((event: MediaQueryListEvent) => void) | null = null;
  private readonly listeners = new Set<(event: MediaQueryListEvent) => void>();

  constructor(matches: boolean) {
    this.matches = matches;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (type !== 'change' || typeof listener !== 'function') return;
    this.listeners.add(listener as (event: MediaQueryListEvent) => void);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (type !== 'change' || typeof listener !== 'function') return;
    this.listeners.delete(listener as (event: MediaQueryListEvent) => void);
  }

  addListener(listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.delete(listener);
  }

  dispatchEvent(): boolean {
    return true;
  }

  setMatches(value: boolean): void {
    this.matches = value;
    const event = { matches: value } as MediaQueryListEvent;
    this.onchange?.(event);
    for (const listener of this.listeners) listener(event);
  }
}

function createMediaHarness(reducedMotion: boolean, coarsePointer = false): {
  window: Parameters<typeof subscribeMediaPreferences>[0];
  setReducedMotion(value: boolean): void;
  setCoarsePointer(value: boolean): void;
} {
  const reduced = new FakeMediaQueryList(reducedMotion);
  const coarse = new FakeMediaQueryList(coarsePointer);
  const window = {
    matchMedia(query: string): MediaQueryList {
      if (query === '(prefers-reduced-motion: reduce)') return reduced as unknown as MediaQueryList;
      if (query === '(pointer: coarse)') return coarse as unknown as MediaQueryList;
      throw new Error(`Unexpected media query: ${query}`);
    },
  };

  return {
    window,
    setReducedMotion(value) { reduced.setMatches(value); },
    setCoarsePointer(value) { coarse.setMatches(value); },
  };
}

describe('media preferences', () => {
  it('reports live reduced-motion changes and removes listeners on dispose', () => {
    const media = createMediaHarness(false);
    const values: boolean[] = [];
    const dispose = subscribeMediaPreferences(media.window, (value) => values.push(value.reducedMotion));

    media.setReducedMotion(true);
    dispose();
    dispose();
    media.setReducedMotion(false);

    expect(values).toEqual([false, true]);
  });

  it('reports live coarse-pointer changes independently from reduced motion', () => {
    const media = createMediaHarness(false, false);
    const values: Array<{ reducedMotion: boolean; coarsePointer: boolean }> = [];
    const dispose = subscribeMediaPreferences(media.window, (value) => values.push(value));

    media.setCoarsePointer(true);

    expect(values).toEqual([
      { reducedMotion: false, coarsePointer: false },
      { reducedMotion: false, coarsePointer: true },
    ]);
    dispose();
  });
});
