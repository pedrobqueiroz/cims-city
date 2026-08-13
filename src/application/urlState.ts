import { ENTITY_PRESENTATION } from '../data/entities';
import type { AtlasScopeId } from '../data/schema';

export interface LocationState {
  scopeId: AtlasScopeId;
  selectedId: string | null;
}

export interface HistoryWindow {
  readonly location: { href: string };
  readonly history: {
    pushState(data: unknown, unused: string, url?: string | URL | null): void;
    replaceState(data: unknown, unused: string, url?: string | URL | null): void;
  };
  addEventListener(type: 'popstate', listener: (event: Event) => void): void;
  removeEventListener(type: 'popstate', listener: (event: Event) => void): void;
}

export interface HistoryAdapter {
  read(): LocationState;
  push(state: LocationState): void;
  replace(state: LocationState): void;
  dispose(): void;
}

function isScopeId(value: string | null): value is AtlasScopeId {
  return value === 'sei' || value === 'cims';
}

function normalizeLocationState(state: { scopeId: string | null; selectedId: string | null }): LocationState {
  const scopeId = isScopeId(state.scopeId) ? state.scopeId : 'sei';
  const presentation = state.selectedId ? ENTITY_PRESENTATION.get(state.selectedId) : undefined;
  const selectedId = presentation?.scopeId === scopeId ? state.selectedId : null;
  return { scopeId, selectedId };
}

export function readLocationState(url: URL): LocationState {
  return normalizeLocationState({
    scopeId: url.searchParams.get('scope'),
    selectedId: url.searchParams.get('entity'),
  });
}

export function writeLocationState(state: LocationState): string {
  const normalized = normalizeLocationState(state);
  const parameters = new URLSearchParams({ scope: normalized.scopeId });
  if (normalized.selectedId) parameters.set('entity', normalized.selectedId);
  return `/?${parameters.toString()}`;
}

export function createHistoryAdapter(
  window: HistoryWindow,
  onPopState: (state: LocationState) => void,
): HistoryAdapter {
  const read = (): LocationState => readLocationState(new URL(window.location.href));
  const onNavigation = (): void => { onPopState(read()); };
  let disposed = false;

  window.addEventListener('popstate', onNavigation);

  return {
    read,
    push(state) {
      window.history.pushState(null, '', writeLocationState(state));
    },
    replace(state) {
      window.history.replaceState(null, '', writeLocationState(state));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('popstate', onNavigation);
    },
  };
}
