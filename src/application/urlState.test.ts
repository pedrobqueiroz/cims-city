import { describe, expect, it } from 'vitest';
import {
  createHistoryAdapter,
  readLocationState,
  writeLocationState,
} from './urlState';

function createHistoryHarness(path = '/'): {
  window: Parameters<typeof createHistoryAdapter>[0];
  paths: string[];
  pop(path: string): void;
} {
  const listeners = new Set<(event: Event) => void>();
  const paths: string[] = [];
  const location = { href: new URL(path, 'https://example.test').href };
  const navigate = (url: string | URL | null | undefined): void => {
    const next = url?.toString() ?? '/';
    paths.push(next);
    location.href = new URL(next, location.href).href;
  };

  return {
    window: {
      location,
      history: {
        pushState: (_state, _unused, url) => { navigate(url); },
        replaceState: (_state, _unused, url) => { navigate(url); },
      },
      addEventListener: (_type, listener) => { listeners.add(listener); },
      removeEventListener: (_type, listener) => { listeners.delete(listener); },
    },
    paths,
    pop(nextPath) {
      location.href = new URL(nextPath, location.href).href;
      for (const listener of listeners) listener(new Event('popstate'));
    },
  };
}

describe('location state', () => {
  it('round-trips scope and entity through a stable URL', () => {
    const url = writeLocationState({ scopeId: 'cims', selectedId: 'smart-textiles' });

    expect(url).toBe('/?scope=cims&entity=smart-textiles');
    expect(readLocationState(new URL(url, 'https://example.test'))).toEqual({
      scopeId: 'cims',
      selectedId: 'smart-textiles',
    });
  });

  it('rejects unknown or out-of-scope URL ids at the adapter boundary', () => {
    expect(readLocationState(new URL('/?scope=unknown&entity=missing', 'https://example.test')))
      .toEqual({ scopeId: 'sei', selectedId: null });
    expect(readLocationState(new URL('/?scope=sei&entity=smart-textiles', 'https://example.test')))
      .toEqual({ scopeId: 'sei', selectedId: null });
  });
});

describe('history adapter', () => {
  it('writes history entries, observes Back and Forward navigation, and disposes idempotently', () => {
    const history = createHistoryHarness('/?scope=sei');
    const changes: string[] = [];
    const adapter = createHistoryAdapter(history.window, (state) => {
      changes.push(`${state.scopeId}:${state.selectedId ?? 'none'}`);
    });

    adapter.push({ scopeId: 'cims', selectedId: 'smart-textiles' });
    adapter.replace({ scopeId: 'cims', selectedId: null });
    history.pop('/?scope=cims&entity=smart-textiles');
    adapter.dispose();
    adapter.dispose();
    history.pop('/?scope=sei');

    expect(history.paths).toEqual([
      '/?scope=cims&entity=smart-textiles',
      '/?scope=cims',
    ]);
    expect(changes).toEqual(['cims:smart-textiles']);
  });
});
