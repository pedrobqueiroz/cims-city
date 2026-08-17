import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './styles.css';
import { createHistoryAdapter, type HistoryAdapter, type HistoryWindow, type LocationState } from './application/urlState';
import { subscribeMediaPreferences, type MediaPreferenceWindow, type MediaPreferences } from './application/mediaPreferences';
import { ENTITIES } from './data/entities';
import { SelectionController, type SelectionControllerOptions, type SelectionOrigin } from './interaction/selectionController';
import { CameraController, type CameraControllerOptions, type OrbitAdapter } from './navigation/cameraController';
import { combinedTier, selectGraphicsQuality, selectMotionPolicy, type QualityInput } from './performance/quality';
import { createCampus, type CampusVisual } from './scene/campus';
import { LAYOUT_BY_ID } from './scene/layout';
import { createDaylightRig, setLightingQuality, type DaylightRig, type LightingQualityTier } from './scene/lighting';
import { createMaterialPalette, disposeMaterialPalette, type MaterialPalette } from './scene/materials';
import { createSceneRuntime, type RuntimeOptions, type SceneRuntime } from './scene/runtime';
import { createSelectionAppearance, type SelectionAppearance, type SelectionQualityTier } from './scene/selectionAppearance';
import { createAtmosphere } from './scene/atmosphere';
import { createAppShell, type AppShell } from './ui/appShell';
import { createLabelLayer, type LabelLayer } from './ui/labels';

interface ControlsLike extends OrbitAdapter {
  enableDamping: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
  dispose(): void;
}

interface CameraControllerLike {
  readonly isTransitioning: boolean;
  focusEntity(id: string): void;
  showOverview(): void;
  update(timeMs: number): void;
  interrupt(): void;
  dispose(): void;
}

interface SelectionControllerLike {
  readonly selectedId: string | null;
  select(id: string, origin: SelectionOrigin): void;
  dispose(): void;
}

interface ResizeObserverLike {
  observe(target: Element): void;
  disconnect(): void;
}

export interface NeighborhoodFactories {
  runtime(container: HTMLElement, options: RuntimeOptions): SceneRuntime;
  palette(): MaterialPalette;
  disposePalette(palette: MaterialPalette): void;
  daylight(scene: THREE.Scene, tier: LightingQualityTier): DaylightRig;
  setLightingQuality(rig: DaylightRig, tier: LightingQualityTier): void;
  campus(args: Parameters<typeof createCampus>[0]): CampusVisual;
  controls(camera: THREE.Camera, canvas: HTMLElement): ControlsLike;
  cameraController(options: CameraControllerOptions): CameraControllerLike;
  selectionController(options: SelectionControllerOptions): SelectionControllerLike;
  selectionAppearance(
    visuals: CampusVisual['entityVisuals'],
    palette: MaterialPalette,
    tier: SelectionQualityTier,
  ): SelectionAppearance;
  labels(...args: Parameters<typeof createLabelLayer>): LabelLayer;
  resizeObserver(callback: ResizeObserverCallback): ResizeObserverLike;
  historyAdapter(window: HistoryWindow, onPopState: (state: LocationState) => void): HistoryAdapter;
  mediaPreferences(window: MediaPreferenceWindow, onChange: (preferences: MediaPreferences) => void): () => void;
}

export interface MountNeighborhoodOptions {
  environment?: QualityInput;
  factories?: Partial<NeighborhoodFactories>;
}

const DEFAULT_FACTORIES: NeighborhoodFactories = {
  runtime: createSceneRuntime,
  palette: createMaterialPalette,
  disposePalette: disposeMaterialPalette,
  daylight: createDaylightRig,
  setLightingQuality,
  campus: createCampus,
  controls: (camera, canvas) => new OrbitControls(camera, canvas) as unknown as ControlsLike,
  cameraController: (options) => new CameraController(options),
  selectionController: (options) => new SelectionController(options),
  selectionAppearance: createSelectionAppearance,
  labels: createLabelLayer,
  resizeObserver: (callback) => {
    if (typeof ResizeObserver !== 'undefined') return new ResizeObserver(callback);
    const onResize = (): void => { callback([], {} as ResizeObserver); };
    window.addEventListener('resize', onResize);
    return {
      observe: onResize,
      disconnect: () => { window.removeEventListener('resize', onResize); },
    };
  },
  historyAdapter: (historyWindow, onPopState) => createHistoryAdapter(historyWindow, onPopState),
  mediaPreferences: (mediaWindow, onChange) => {
    if (!mediaWindow.matchMedia) return () => {};
    return subscribeMediaPreferences(mediaWindow, onChange);
  },
};

const PORTRAIT_LABELS: Readonly<Record<string, string | undefined>> = {
  sei: 'SEi',
  'cims-hub': 'CiMS Hub',
  'electroactive-polymers': 'EAP group',
  'smart-material-electronics': 'SME group',
  'smart-textiles': 'Textiles',
  'shape-memory-alloys': 'SMA group',
  'soft-robotics-lab': 'APS Lab',
  hycatt: 'HyCATT',
  'new-zema': 'New ZeMA',
  uds: 'UdS',
  'htw-saar': 'htw saar',
};

function readEnvironment(): QualityInput {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return {
    width: window.innerWidth,
    dpr: window.devicePixelRatio || 1,
    reducedMotion,
    coarsePointer,
  };
}

export function mountNeighborhood(root: HTMLElement, options: MountNeighborhoodOptions = {}): () => void {
  const factories: NeighborhoodFactories = { ...DEFAULT_FACTORIES, ...options.factories };
  const environment = options.environment ?? readEnvironment();
  const quality = selectGraphicsQuality(environment);
  let motionPolicy = selectMotionPolicy(environment.reducedMotion);
  let reducedMotion = environment.reducedMotion;
  let disposed = false;
  let runtime: SceneRuntime | undefined;
  let lighting: DaylightRig | undefined;
  let disposeLightingResource: (() => void) | undefined;
  let appearance: SelectionAppearance | undefined;
  let disposeAppearanceResource: (() => void) | undefined;
  let labels: LabelLayer | undefined;
  let disposeLabelsResource: (() => void) | undefined;
  let cameraController: CameraControllerLike | undefined;
  let selectionController: SelectionControllerLike | undefined;
  let selectedId: string | null = null;
  let controls: ControlsLike | undefined;
  let cameraFrame: number | undefined;
  const cleanup: Array<() => void> = [];
  const warnedOptionalComponents = new Set<string>();

  const warnOptional = (component: string, reason: unknown): void => {
    if (warnedOptionalComponents.has(component)) return;
    warnedOptionalComponents.add(component);
    console.warn(`CiMS optional ${component} unavailable.`, reason);
  };

  const region = document.createElement('section');
  region.className = 'neighborhood';
  region.setAttribute('aria-label', 'CiMS organizational neighborhood');
  const canvasHost = document.createElement('div');
  canvasHost.className = 'neighborhood__canvas-host';
  canvasHost.dataset.canvasHost = 'true';
  region.append(canvasHost);
  root.append(region);

  const updateLabels = (): void => {
    const activeLabels = labels;
    if (!activeLabels) return;
    try {
      const rect = canvasHost.getBoundingClientRect();
      activeLabels.update(rect.width, rect.height, selectedId);
    } catch (reason) {
      try {
        disposeLabelsResource?.();
      } catch {
        // The update error remains the single optional-component warning.
      }
      labels = undefined;
      disposeLabelsResource = undefined;
      warnOptional('label layer', reason);
    }
  };

  const updateAppearance = (operation: (active: SelectionAppearance) => void): void => {
    const activeAppearance = appearance;
    if (!activeAppearance) return;
    try {
      operation(activeAppearance);
    } catch (reason) {
      try {
        disposeAppearanceResource?.();
      } catch {
        // The operation error remains the single optional-component warning.
      }
      appearance = undefined;
      disposeAppearanceResource = undefined;
      warnOptional('selection appearance', reason);
    }
  };

  const applySelection = (id: string): void => {
    if (disposed) return;
    selectedId = id;
    shell.setSelected(id);
    updateAppearance((active) => { active.select(id); });
    cameraController?.focusEntity(id);
    updateLabels();
    pushUrlState();
    runtime?.requestRender();
  };

  const routeSelection = (id: string, origin: SelectionOrigin): void => {
    if (disposed) return;
    if (selectionController) selectionController.select(id, origin);
    else applySelection(id);
  };

  const showOverview = (): void => {
    if (disposed) return;
    selectedId = null;
    shell.setSelected(null);
    updateAppearance((active) => { active.clear(); });
    cameraController?.showOverview();
    updateLabels();
    pushUrlState();
    runtime?.requestRender();
  };

  const stopCameraFrame = (): void => {
    if (cameraFrame === undefined) return;
    window.cancelAnimationFrame(cameraFrame);
    cameraFrame = undefined;
  };

  const cameraTick = (timeMs: number): void => {
    cameraFrame = undefined;
    if (disposed || !cameraController) return;
    cameraController.update(timeMs);
    updateLabels();
    if (cameraController.isTransitioning) cameraFrame = window.requestAnimationFrame(cameraTick);
  };

  const setCameraContinuous = (reason: string, active: boolean): void => {
    runtime?.setContinuous(reason, active);
    if (reason !== 'camera') return;
    if (!active) {
      stopCameraFrame();
      return;
    }
    if (cameraFrame === undefined) cameraFrame = window.requestAnimationFrame(cameraTick);
  };

  const createCameraController = (): CameraControllerLike => factories.cameraController({
    camera: runtime!.camera,
    orbit: controls!,
    layout: LAYOUT_BY_ID,
    requestRender: () => { runtime?.requestRender(); },
    setContinuous: setCameraContinuous,
    reducedMotion,
  });

  const updateReducedMotion = (reduced: boolean): void => {
    if (disposed || !runtime || !controls) return;
    reducedMotion = reduced;
    motionPolicy = selectMotionPolicy(reduced);
    const combined = combinedTier(quality, motionPolicy);
    if (lighting) {
      try {
        factories.setLightingQuality(lighting, combined);
      } catch (reason) {
        try {
          disposeLightingResource?.();
        } catch {
          // The original optional-component warning remains the single report.
        }
        lighting = undefined;
        disposeLightingResource = undefined;
        warnOptional('lighting', reason);
      }
    }
    updateAppearance((active) => { active.setQuality(combined); });
    cameraController?.dispose();
    cameraController = createCameraController();
    if (selectedId) cameraController.focusEntity(selectedId);
    else cameraController.showOverview();
    updateLabels();
    runtime.requestRender();
  };

  const shell: AppShell = createAppShell(region, ENTITIES, {
    onSelect: (id) => { routeSelection(id, 'navigator'); },
    onOverview: showOverview,
    onBack: showOverview,
    onReducedMotionChange: updateReducedMotion,
  });
  shell.setReducedMotion(reducedMotion);

  const history = factories.historyAdapter(window, (state) => {
    if (disposed) return;
    if (state.selectedId) {
      applySelection(state.selectedId);
    } else {
      showOverview();
    }
  });
  cleanup.push(() => { history.dispose(); });

  const initialUrlState = history.read();
  if (initialUrlState.selectedId) {
    selectedId = initialUrlState.selectedId;
    shell.setSelected(selectedId);
  } else {
    shell.setSelected(null);
  }

  const disposeMedia = factories.mediaPreferences(window, (prefs) => {
    if (disposed) return;
    updateReducedMotion(prefs.reducedMotion);
  });
  cleanup.push(disposeMedia);

  const pushUrlState = (): void => {
    if (disposed) return;
    history.push({ scopeId: 'sei', selectedId });
  };

  try {
    runtime = factories.runtime(canvasHost, {
      maxDpr: quality.maxDpr,
      beforeRender: () => { controls?.update(); },
    });
    cleanup.push(() => { runtime?.dispose(); });

    const atmosphere = createAtmosphere(runtime.scene);
    cleanup.push(() => { atmosphere.dispose(); });

    const palette = factories.palette();
    cleanup.push(() => { factories.disposePalette(palette); });

    try {
      const createdLighting = factories.daylight(runtime.scene, combinedTier(quality, motionPolicy));
      let lightingDisposed = false;
      const disposeCreatedLighting = (): void => {
        if (lightingDisposed) return;
        lightingDisposed = true;
        createdLighting.dispose();
      };
      try {
        if (createdLighting.root.parent !== runtime.scene) runtime.scene.add(createdLighting.root);
      } catch (reason) {
        try {
          disposeCreatedLighting();
        } catch {
          // The attachment error is the actionable optional-component failure.
        }
        throw reason;
      }
      lighting = createdLighting;
      disposeLightingResource = disposeCreatedLighting;
      cleanup.push(disposeCreatedLighting);
    } catch (reason) {
      lighting = undefined;
      warnOptional('lighting', reason);
    }

    let campus: CampusVisual;
    try {
      campus = factories.campus({
        entities: ENTITIES,
        layout: LAYOUT_BY_ID,
        palette,
        contextDensity: quality.contextDensity,
      });
      try {
        runtime.scene.add(campus.root);
      } catch (reason) {
        try {
          campus.dispose();
        } catch {
          // The attachment error remains the core failure reason.
        }
        throw reason;
      }
    } catch (reason) {
      if (quality.contextDensity <= 0) throw reason;
      warnOptional('context', reason);
      campus = factories.campus({
        entities: ENTITIES,
        layout: LAYOUT_BY_ID,
        palette,
        contextDensity: 0,
      });
      try {
        runtime.scene.add(campus.root);
      } catch (retryReason) {
        try {
          campus.dispose();
        } catch {
          // The retry attachment error remains the core failure reason.
        }
        throw retryReason;
      }
    }
    cleanup.push(() => { campus.dispose(); });

    controls = factories.controls(runtime.camera, runtime.renderer.domElement);
    const canvas = runtime.renderer.domElement;
    const interruptGuidedTravel = (): void => {
      if (cameraController?.isTransitioning) cameraController.interrupt();
    };
    canvas.addEventListener('pointerdown', interruptGuidedTravel, { capture: true });
    canvas.addEventListener('wheel', interruptGuidedTravel, { capture: true });
    const onControlsChange = (): void => {
      updateLabels();
      runtime?.requestRender();
    };
    cleanup.push(() => {
      canvas.removeEventListener('pointerdown', interruptGuidedTravel, { capture: true });
      canvas.removeEventListener('wheel', interruptGuidedTravel, { capture: true });
      controls?.removeEventListener('change', onControlsChange);
      controls?.dispose();
    });
    controls.enableDamping = true;
    controls.addEventListener('change', onControlsChange);

    cameraController = createCameraController();
    cleanup.push(() => {
      stopCameraFrame();
      cameraController?.dispose();
    });

    selectionController = factories.selectionController({
      canvas: runtime.renderer.domElement,
      camera: runtime.camera,
      proxies: campus.selectionProxies,
      onSelect: (id) => { applySelection(id); },
      requestRender: () => { runtime?.requestRender(); },
    });
    cleanup.push(() => { selectionController?.dispose(); });

    try {
      const createdAppearance = factories.selectionAppearance(campus.entityVisuals, palette, combinedTier(quality, motionPolicy));
      let appearanceDisposed = false;
      const disposeCreatedAppearance = (): void => {
        if (appearanceDisposed) return;
        appearanceDisposed = true;
        createdAppearance.dispose();
      };
      appearance = createdAppearance;
      disposeAppearanceResource = disposeCreatedAppearance;
      cleanup.push(disposeCreatedAppearance);
    } catch (reason) {
      appearance = undefined;
      warnOptional('selection appearance', reason);
    }

    try {
      const createdLabels = factories.labels(canvasHost, ENTITIES, new Map(
        [...campus.entityVisuals].map(([id, visual]) => [id, visual.labelAnchor]),
      ), runtime.camera, {
        onSelect: (id) => { routeSelection(id, 'navigator'); },
        portraitText: PORTRAIT_LABELS,
      });
      let labelsDisposed = false;
      const disposeCreatedLabels = (): void => {
        if (labelsDisposed) return;
        labelsDisposed = true;
        createdLabels.dispose();
      };
      labels = createdLabels;
      disposeLabelsResource = disposeCreatedLabels;
      cleanup.push(disposeCreatedLabels);
    } catch (reason) {
      labels = undefined;
      warnOptional('label layer', reason);
    }

    try {
      const resizeObserver = factories.resizeObserver(updateLabels);
      try {
        resizeObserver.observe(canvasHost);
      } catch (reason) {
        try {
          resizeObserver.disconnect();
        } catch {
          // The observe error remains the single optional-component warning.
        }
        throw reason;
      }
      cleanup.push(() => { resizeObserver.disconnect(); });
    } catch (reason) {
      warnOptional('resize observer', reason);
    }

    shell.setWebGLStatus('ready');
    cameraController.showOverview();
    updateLabels();
    runtime.requestRender();
  } catch {
    while (cleanup.length > 0) cleanup.pop()?.();
    runtime = undefined;
    lighting = undefined;
    appearance = undefined;
    labels = undefined;
    cameraController = undefined;
    selectionController = undefined;
    controls = undefined;
    shell.setWebGLStatus('failed');
  }

  return () => {
    if (disposed) return;
    disposed = true;
    while (cleanup.length > 0) cleanup.pop()?.();
    shell.dispose();
    region.remove();
  };
}

if (typeof document !== 'undefined' && import.meta.env.MODE !== 'test') {
  const app = document.querySelector('#app');
  if (app instanceof HTMLElement) mountNeighborhood(app);
}
