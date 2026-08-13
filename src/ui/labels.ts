import * as THREE from 'three';
import type { AtlasScopeId, EntityPresentation, NeighborhoodEntity } from '../data/schema';

export interface LabelLayerOptions {
  onSelect?: (id: string) => void;
  measureLabel?: (element: HTMLButtonElement) => { width: number; height: number };
  portraitText?: Readonly<Record<string, string | undefined>>;
  presentation?: ReadonlyMap<string, EntityPresentation>;
}

export interface LabelView {
  width: number;
  height: number;
  scopeId: AtlasScopeId;
  selectedId: string | null;
  previewId: string | null;
  safeRectangles: readonly ScreenRectangle[];
  maxVisible: number;
}

export interface LabelLayer {
  update: {
    (view: LabelView): void;
    (width: number, height: number, selectedId: string | null): void;
  };
  dispose: () => void;
}

interface LabelEntry {
  button: HTMLButtonElement;
  entity: NeighborhoodEntity;
  anchor: THREE.Object3D;
  inputOrder: number;
}

interface ScreenRectangle {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const COLLISION_PADDING = 12;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function categoryPriority(category: NeighborhoodEntity['category']): number {
  if (category === 'research-group' || category === 'hub') return 3;
  if (category === 'adjacent-lab' || category === 'sei-pillar') return 2;
  return 1;
}

function overlaps(left: ScreenRectangle, right: ScreenRectangle): boolean {
  return left.left < right.right && left.right > right.left
    && left.top < right.bottom && left.bottom > right.top;
}

function measuredSize(button: HTMLButtonElement, measureLabel?: LabelLayerOptions['measureLabel']): { width: number; height: number } {
  const injected = measureLabel?.(button);
  if (injected && injected.width > 0 && injected.height > 0) return injected;
  const rect = button.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) return { width: rect.width, height: rect.height };
  return { width: Math.max(64, (button.textContent?.length ?? 0) * 7.5 + 24), height: 44 };
}

export function createLabelLayer(
  container: HTMLElement,
  entities: readonly NeighborhoodEntity[],
  anchors: ReadonlyMap<string, THREE.Object3D>,
  camera: THREE.Camera,
  options: LabelLayerOptions = {},
): LabelLayer {
  const entries: LabelEntry[] = [];
  for (const [inputOrder, entity] of entities.entries()) {
    const anchor = anchors.get(entity.id);
    if (!anchor) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'entity-label';
    button.dataset.labelId = entity.id;
    button.dataset.selected = 'false';
    button.textContent = entity.abbreviation ?? entity.name;
    button.setAttribute('aria-label', `View ${entity.name}`);
    button.hidden = true;
    button.addEventListener('click', () => options.onSelect?.(entity.id));
    container.append(button);
    entries.push({ button, entity, anchor, inputOrder });
  }

  container.classList.add('entity-label-layer');
  const worldPosition = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const measurements = new Map<string, { width: number; height: number }>();

  function normalizeView(
    viewOrWidth: LabelView | number,
    legacyHeight?: number,
    legacySelectedId?: string | null,
  ): LabelView {
    if (typeof viewOrWidth !== 'number') return viewOrWidth;
    return {
      width: viewOrWidth,
      height: legacyHeight ?? 0,
      scopeId: 'cims',
      selectedId: legacySelectedId ?? null,
      previewId: null,
      safeRectangles: [],
      maxVisible: Number.POSITIVE_INFINITY,
    };
  }

  const update = (viewOrWidth: LabelView | number, legacyHeight?: number, legacySelectedId?: string | null): void => {
    const view = normalizeView(viewOrWidth, legacyHeight, legacySelectedId);
    const { width, height, selectedId, previewId } = view;
    const portrait = height > 0 && width / height < 0.75;
    const viewportClass = portrait ? 'portrait' : 'landscape';
    for (const entry of entries) {
      const normalText = entry.entity.abbreviation ?? entry.entity.name;
      const visibleText = portrait ? options.portraitText?.[entry.entity.id] ?? normalText : normalText;
      if (entry.button.textContent !== visibleText) entry.button.textContent = visibleText;
      entry.button.dataset.selected = String(entry.entity.id === selectedId);
    }
    const candidates = entries.filter((entry) => {
      if (entry.entity.id === selectedId || entry.entity.id === previewId) return true;
      const presentation = options.presentation?.get(entry.entity.id);
      if (!presentation) return !options.presentation;
      if (view.scopeId === 'sei') {
        return entry.entity.category === 'hub'
          || entry.entity.category === 'sei-pillar'
          || entry.entity.category === 'external-partner';
      }
      return presentation.scopeId === 'cims';
    });
    const sizes = new Map<LabelEntry, { width: number; height: number }>();
    for (const entry of candidates) {
      const key = `${viewportClass}\u0000${entry.button.textContent ?? ''}`;
      let size = measurements.get(key);
      if (!size) {
        size = measuredSize(entry.button, options.measureLabel);
        measurements.set(key, size);
      }
      sizes.set(entry, size);
    }
    camera.updateMatrixWorld(true);
    const projected = candidates.map((entry) => {
      entry.anchor.getWorldPosition(worldPosition);
      cameraPosition.copy(worldPosition).applyMatrix4(camera.matrixWorldInverse);
      const ndc = worldPosition.clone().project(camera);
      const inFrustum = cameraPosition.z < 0
        && ndc.x >= -1 && ndc.x <= 1
        && ndc.y >= -1 && ndc.y <= 1
        && ndc.z >= -1 && ndc.z <= 1;
      if (!inFrustum || width <= 0 || height <= 0) {
        entry.button.hidden = true;
        return undefined;
      }
      const size = sizes.get(entry)!;
      const x = clamp(((ndc.x + 1) / 2) * width, size.width / 2, width - size.width / 2);
      const y = clamp(((1 - ndc.y) / 2) * height, size.height, height);
      const rectangle: ScreenRectangle = {
        left: x - size.width / 2 - COLLISION_PADDING,
        right: x + size.width / 2 + COLLISION_PADDING,
        top: y - size.height - COLLISION_PADDING,
        bottom: y + COLLISION_PADDING,
      };
      return {
        ...entry,
        x,
        y,
        rectangle,
        priority: entry.entity.id === selectedId ? 6
          : entry.entity.id === previewId ? 5
            : options.presentation && view.scopeId === 'cims' && entry.entity.category === 'research-group' ? 4
              : categoryPriority(entry.entity.category),
      };
    }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    projected.sort((left, right) => right.priority - left.priority || left.inputOrder - right.inputOrder);
    const accepted: ScreenRectangle[] = [];
    const acceptedIds = new Set<string>();
    for (const entry of projected) {
      const collides = accepted.some((rectangle) => overlaps(entry.rectangle, rectangle))
        || view.safeRectangles.some((rectangle) => overlaps(entry.rectangle, rectangle));
      const overBudget = acceptedIds.size >= view.maxVisible;
      entry.button.hidden = collides || overBudget;
      if (collides) continue;
      if (overBudget) continue;
      entry.button.style.transform = `translate3d(${entry.x}px, ${entry.y}px, 0) translate(-50%, -100%)`;
      accepted.push(entry.rectangle);
      acceptedIds.add(entry.entity.id);
    }
    for (const entry of entries) {
      if (!acceptedIds.has(entry.entity.id)) entry.button.hidden = true;
    }
  };

  return {
    update,
    dispose: () => {
      for (const entry of entries) entry.button.remove();
      container.classList.remove('entity-label-layer');
    },
  };
}
