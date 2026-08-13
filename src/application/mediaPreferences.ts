export interface MediaPreferences {
  reducedMotion: boolean;
  coarsePointer: boolean;
}

export interface MediaPreferenceWindow {
  matchMedia(query: string): Pick<MediaQueryList,
    'matches' | 'addEventListener' | 'removeEventListener'>;
}

export function subscribeMediaPreferences(
  window: MediaPreferenceWindow,
  onChange: (preferences: MediaPreferences) => void,
): () => void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const notify = (): void => {
    onChange({
      reducedMotion: reducedMotion.matches,
      coarsePointer: coarsePointer.matches,
    });
  };
  let disposed = false;

  reducedMotion.addEventListener('change', notify);
  coarsePointer.addEventListener('change', notify);
  notify();

  return () => {
    if (disposed) return;
    disposed = true;
    reducedMotion.removeEventListener('change', notify);
    coarsePointer.removeEventListener('change', notify);
  };
}
