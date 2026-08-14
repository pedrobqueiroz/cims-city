import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENTITIES } from './data/entities';
import { mountNeighborhood, type MountNeighborhoodOptions } from './main';
import { createLabelLayer, type LabelLayer, type LabelView } from './ui/labels';

interface Harness {
  options: MountNeighborhoodOptions;
  scene: THREE.Scene;
  canvas: HTMLCanvasElement;
  cameraFocuses: string[];
  cameraOverviews: number[];
  cameraInterrupts: number[];
  cameraReducedPolicies: boolean[];
  controlsGestureTransitionStates: boolean[];
  appearanceSelections: string[];
  appearanceClears: number[];
  appearanceQualities: string[];
  labelUpdates: Array<{ selectedId: string | null; width: number; height: number }>;
  requestRenders: number[];
  runtimeMaxDprs: number[];
  campusDensities: number[];
  setCameraTransitioning(value: boolean): void;
  selectionFromScene(id: string): void;
}

interface HarnessProbes {
  onRuntimeCreate?: () => void;
}

function createHarness(overrides: Partial<MountNeighborhoodOptions> = {}, probes?: HarnessProbes): Harness {
  const canvas = document.createElement('canvas');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const cameraFocuses: string[] = [];
  const cameraOverviews: number[] = [];
  const cameraInterrupts: number[] = [];
  const cameraReducedPolicies: boolean[] = [];
  const controlsGestureTransitionStates: boolean[] = [];
  const appearanceSelections: string[] = [];
  const appearanceClears: number[] = [];
  const appearanceQualities: string[] = [];
  const labelUpdates: Harness['labelUpdates'] = [];
  const requestRenders: number[] = [];
  const runtimeMaxDprs: number[] = [];
  const campusDensities: number[] = [];
  let cameraTransitioning = false;
  let sceneSelect: ((id: string) => void) | undefined;

  const baseFactories: NonNullable<MountNeighborhoodOptions['factories']> = {
      runtime: (container, runtimeOptions) => {
        expect(container.closest('.neighborhood')?.querySelector('.organization-nav')).not.toBeNull();
        runtimeMaxDprs.push(runtimeOptions.maxDpr);
        probes?.onRuntimeCreate?.();
        container.append(canvas);
        return {
          scene,
          camera,
          renderer: {
            domElement: canvas,
            setPixelRatio: vi.fn(),
            setSize: vi.fn(),
            render: vi.fn(),
            dispose: vi.fn(),
            outputColorSpace: THREE.SRGBColorSpace,
            toneMapping: THREE.NoToneMapping,
            shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
          },
          requestRender: () => { requestRenders.push(requestRenders.length + 1); },
          setContinuous: vi.fn(),
          dispose: vi.fn(() => { canvas.remove(); }),
        };
      },
      palette: () => ({}) as never,
      disposePalette: vi.fn(),
      daylight: () => ({
        root: new THREE.Group(),
        sun: new THREE.DirectionalLight(),
        fill: new THREE.HemisphereLight(),
        lights: [],
        dispose: vi.fn(),
      }),
      setLightingQuality: vi.fn(),
      campus: ({ contextDensity }) => {
        campusDensities.push(contextDensity ?? 1);
        return { root: new THREE.Group(), entityVisuals: new Map(), selectionProxies: [], dispose: vi.fn() };
      },
      controls: (_camera, controlsCanvas) => {
        const observeGesture = (): void => {
          controlsGestureTransitionStates.push(cameraTransitioning);
        };
        controlsCanvas.addEventListener('pointerdown', observeGesture);
        controlsCanvas.addEventListener('wheel', observeGesture);
        return {
          target: new THREE.Vector3(),
          enabled: true,
          enableDamping: false,
          enablePan: true,
          minDistance: 0,
          maxDistance: 0,
          minPolarAngle: 0,
          maxPolarAngle: 0,
          minAzimuthAngle: Number.NEGATIVE_INFINITY,
          maxAzimuthAngle: Number.POSITIVE_INFINITY,
          update: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispose: vi.fn(() => {
            controlsCanvas.removeEventListener('pointerdown', observeGesture);
            controlsCanvas.removeEventListener('wheel', observeGesture);
          }),
        };
      },
      cameraController: (cameraOptions) => {
        cameraReducedPolicies.push(cameraOptions.reducedMotion);
        return {
          get isTransitioning() { return cameraTransitioning; },
          focusEntity: (id) => { cameraFocuses.push(id); },
          showOverview: () => { cameraOverviews.push(cameraOverviews.length + 1); },
          update: vi.fn(),
          interrupt: () => {
            cameraInterrupts.push(cameraInterrupts.length + 1);
            cameraTransitioning = false;
          },
          dispose: vi.fn(),
        };
      },
      selectionController: (selectionOptions) => {
        let selectedId: string | null = null;
        sceneSelect = (id) => {
          selectedId = id;
          selectionOptions.onSelect(id, 'scene');
        };
        return {
          get selectedId() { return selectedId; },
          select: (id, origin) => {
            selectedId = id;
            selectionOptions.onSelect(id, origin);
            selectionOptions.requestRender();
          },
          dispose: vi.fn(),
        };
      },
      selectionAppearance: () => ({
        get selectedId() { return appearanceSelections.at(-1) ?? null; },
        select: (id) => { appearanceSelections.push(id); },
        clear: () => { appearanceClears.push(appearanceClears.length + 1); },
        setQuality: (tier) => { appearanceQualities.push(tier); },
        dispose: vi.fn(),
      }),
      labels: () => ({
        update: ((viewOrWidth: LabelView | number, height?: number, selectedId?: string | null) => {
          const view = typeof viewOrWidth === 'number'
            ? { width: viewOrWidth, height: height!, selectedId: selectedId ?? null }
            : viewOrWidth;
          labelUpdates.push({ width: view.width, height: view.height, selectedId: view.selectedId });
        }) as LabelLayer['update'],
        dispose: vi.fn(),
      }),
      resizeObserver: (callback) => ({
        observe: () => { callback([], {} as ResizeObserver); },
        disconnect: vi.fn(),
      }),
  };

  const options: MountNeighborhoodOptions = {
    environment: { width: 1200, dpr: 2, reducedMotion: false, coarsePointer: false },
    ...overrides,
    factories: { ...baseFactories, ...overrides.factories },
  };

  return {
    options,
    scene,
    canvas,
    cameraFocuses,
    cameraOverviews,
    cameraInterrupts,
    cameraReducedPolicies,
    controlsGestureTransitionStates,
    appearanceSelections,
    appearanceClears,
    appearanceQualities,
    labelUpdates,
    requestRenders,
    runtimeMaxDprs,
    campusDensities,
    setCameraTransitioning: (value) => { cameraTransitioning = value; },
    selectionFromScene: (id) => {
      if (!sceneSelect) throw new Error('selection controller was not created');
      sceneSelect(id);
    },
  };
}

function mountRoot(): HTMLElement {
  document.body.innerHTML = '<main id="app"></main>';
  return document.querySelector<HTMLElement>('#app')!;
}

describe('mountNeighborhood', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('creates the semantic shell before attempting WebGL composition', () => {
    const harness = createHarness();
    const dispose = mountNeighborhood(mountRoot(), harness.options);

    expect(document.querySelector('[aria-label="CiMS organizational neighborhood"]')).not.toBeNull();
    expect(document.querySelector('.app-shell')?.getAttribute('data-webgl-status')).toBe('ready');
    dispose();
  });

  it('synchronizes navigator selection across the real card and 3D collaborators', () => {
    const harness = createHarness();
    const dispose = mountNeighborhood(mountRoot(), harness.options);
    const entity = ENTITIES.find(({ id }) => id === 'elastocalorics')!;

    document.querySelector<HTMLButtonElement>('[data-entity-id="elastocalorics"]')!.click();

    expect(document.querySelector('.entity-card')?.textContent).toContain(entity.name);
    expect(harness.cameraFocuses).toEqual(['elastocalorics']);
    expect(harness.appearanceSelections).toEqual(['elastocalorics']);
    expect(harness.labelUpdates.at(-1)?.selectedId).toBe('elastocalorics');
    expect(harness.requestRenders.length).toBeGreaterThan(0);
    dispose();
  });

  it('routes scene selection through the same synchronized state', () => {
    const harness = createHarness();
    const dispose = mountNeighborhood(mountRoot(), harness.options);

    harness.selectionFromScene('smart-textiles');

    expect(document.querySelector('[data-entity-id="smart-textiles"]')?.getAttribute('aria-current')).toBe('true');
    expect(harness.cameraFocuses).toEqual(['smart-textiles']);
    expect(harness.appearanceSelections).toEqual(['smart-textiles']);
    expect(harness.labelUpdates.at(-1)?.selectedId).toBe('smart-textiles');
    dispose();
  });

  it.each(['Enter', ' '])('synchronizes a focused navigator button activated with %j', (key) => {
    const harness = createHarness();
    const dispose = mountNeighborhood(mountRoot(), harness.options);
    const button = document.querySelector<HTMLButtonElement>('[data-entity-id="smart-material-electronics"]')!;
    button.focus();

    button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    button.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    // jsdom does not synthesize a button's default click; detail 0 is the browser keyboard-activation click.
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

    expect(document.activeElement).toBe(button);
    expect(document.querySelector('.entity-card h2')?.textContent).toBe('Smart Material Electronics');
    expect(harness.cameraFocuses).toEqual(['smart-material-electronics']);
    expect(harness.appearanceSelections).toEqual(['smart-material-electronics']);
    expect(harness.labelUpdates.at(-1)?.selectedId).toBe('smart-material-electronics');
    dispose();
  });

  it('initializes overview and restores it from the overview control', () => {
    const harness = createHarness();
    const dispose = mountNeighborhood(mountRoot(), harness.options);
    expect(document.querySelector('[data-overview]')?.getAttribute('aria-current')).toBe('true');
    expect(harness.cameraOverviews).toHaveLength(1);

    document.querySelector<HTMLButtonElement>('[data-entity-id="shape-memory-alloys"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-overview]')!.click();

    expect(document.querySelector('.entity-card h2')?.textContent).toBe('Overview');
    expect(harness.appearanceClears).toHaveLength(1);
    expect(harness.cameraOverviews).toHaveLength(2);
    expect(harness.labelUpdates.at(-1)?.selectedId).toBeNull();
    dispose();
  });

  it('updates an existing projected label across landscape and portrait resize boundaries', () => {
    const harness = createHarness();
    const base = harness.options.factories!;
    let viewport = { width: 800, height: 600 };
    let notifyResize = (): void => undefined;
    const labelAnchor = new THREE.Object3D();
    labelAnchor.position.set(0, 0, -10);
    labelAnchor.updateMatrixWorld(true);
    const entityVisual = {
      root: new THREE.Group(),
      visible: new THREE.Group(),
      proxy: new THREE.Mesh(),
      labelAnchor,
      focusAnchor: new THREE.Object3D(),
    };
    harness.options.factories = {
      ...base,
      runtime: (container, runtimeOptions) => {
        container.getBoundingClientRect = () => ({
          width: viewport.width,
          height: viewport.height,
          left: 0,
          right: viewport.width,
          top: 0,
          bottom: viewport.height,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        });
        return base.runtime!(container, runtimeOptions);
      },
      campus: () => ({
        root: new THREE.Group(),
        entityVisuals: new Map([['smart-textiles', entityVisual]]),
        selectionProxies: [],
        dispose: vi.fn(),
      }),
      labels: createLabelLayer,
      resizeObserver: (callback) => {
        notifyResize = () => { callback([], {} as ResizeObserver); };
        return { observe: vi.fn(), disconnect: vi.fn() };
      },
    };

    const dispose = mountNeighborhood(mountRoot(), harness.options);
    const mountedButton = document.querySelector<HTMLButtonElement>('[data-label-id="smart-textiles"]')!;
    expect(mountedButton.textContent).toBe('Smart Textiles');

    viewport = { width: 390, height: 844 };
    notifyResize();
    expect(document.querySelector('[data-label-id="smart-textiles"]')).toBe(mountedButton);
    expect(mountedButton.textContent).toBe('Textiles');
    expect(mountedButton.getAttribute('aria-label')).toBe('View Smart Textiles');
    mountedButton.click();
    expect(mountedButton.dataset.selected).toBe('true');
    expect(document.querySelector('.entity-card h2')?.textContent).toBe('Smart Textiles');

    viewport = { width: 800, height: 600 };
    notifyResize();
    expect(document.querySelector('[data-label-id="smart-textiles"]')).toBe(mountedButton);
    expect(mountedButton.textContent).toBe('Smart Textiles');
    dispose();
  });

  it('interrupts guided travel before pointer and wheel gestures reach controls, then removes both listeners', () => {
    const harness = createHarness();
    const dispose = mountNeighborhood(mountRoot(), harness.options);

    harness.setCameraTransitioning(true);
    harness.canvas.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    harness.setCameraTransitioning(true);
    harness.canvas.dispatchEvent(new Event('wheel', { bubbles: true }));

    expect(harness.cameraInterrupts).toHaveLength(2);
    expect(harness.controlsGestureTransitionStates).toEqual([false, false]);

    dispose();
    harness.setCameraTransitioning(true);
    harness.canvas.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    harness.canvas.dispatchEvent(new Event('wheel', { bubbles: true }));
    expect(harness.cameraInterrupts).toHaveLength(2);
    expect(harness.controlsGestureTransitionStates).toEqual([false, false]);
  });

  it('retains the navigator and card when runtime creation fails', () => {
    const harness = createHarness({
      factories: { runtime: () => { throw new Error('WebGL unavailable'); } },
    });
    const dispose = mountNeighborhood(mountRoot(), harness.options);

    expect(document.querySelector('.app-shell')?.getAttribute('data-webgl-status')).toBe('failed');
    document.querySelector<HTMLButtonElement>('[data-entity-id="cims-hub"]')!.click();
    expect(document.querySelector('.entity-card h2')?.textContent).toContain('CiMS');
    expect(document.querySelector('.app-shell__fallback')?.textContent).toContain('3D view is unavailable');
    dispose();
  });

  it('keeps core WebGL selection ready when optional lighting fails and warns once by name', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const harness = createHarness({
      factories: { daylight: () => { throw new Error('lighting unavailable'); } },
    });
    const dispose = mountNeighborhood(mountRoot(), harness.options);

    expect(document.querySelector('.app-shell')?.getAttribute('data-webgl-status')).toBe('ready');
    document.querySelector<HTMLButtonElement>('[data-entity-id="smart-textiles"]')!.click();
    expect(document.querySelector('.entity-card h2')?.textContent).toBe('Smart Textiles');
    expect(harness.cameraFocuses).toEqual(['smart-textiles']);
    expect(warning).toHaveBeenCalledOnce();
    expect(String(warning.mock.calls[0]?.[0])).toContain('lighting');
    dispose();
  });

  it('disposes a partially created lighting rig when optional scene attachment fails', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const harness = createHarness();
    const lightingDispose = vi.fn();
    const lightingRoot = new THREE.Group();
    lightingRoot.name = 'lighting:attach-failure';
    const originalAdd = harness.scene.add.bind(harness.scene);
    harness.scene.add = ((...objects: THREE.Object3D[]) => {
      if (objects.includes(lightingRoot)) throw new Error('lighting add failed');
      return originalAdd(...objects);
    }) as typeof harness.scene.add;
    harness.options.factories!.daylight = () => ({
      root: lightingRoot,
      sun: new THREE.DirectionalLight(),
      fill: new THREE.HemisphereLight(),
      lights: [],
      dispose: lightingDispose,
    });

    const dispose = mountNeighborhood(mountRoot(), harness.options);

    expect(lightingDispose).toHaveBeenCalledOnce();
    expect(document.querySelector('.app-shell')?.getAttribute('data-webgl-status')).toBe('ready');
    expect(warning).toHaveBeenCalledOnce();
    expect(String(warning.mock.calls[0]?.[0])).toContain('lighting');
    dispose();
    expect(lightingDispose).toHaveBeenCalledOnce();
  });

  it('retries a failed context campus exactly once at density zero and keeps core selection ready', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const harness = createHarness();
    const base = harness.options.factories!;
    const requestedDensities: number[] = [];
    harness.options.factories = {
      ...base,
      campus: (args) => {
        requestedDensities.push(args.contextDensity ?? 1);
        if (requestedDensities.length === 1) throw new Error('context failed');
        return base.campus!(args);
      },
    };

    const dispose = mountNeighborhood(mountRoot(), harness.options);

    expect(requestedDensities).toEqual([1, 0]);
    expect(document.querySelector('.app-shell')?.getAttribute('data-webgl-status')).toBe('ready');
    document.querySelector<HTMLButtonElement>('[data-entity-id="shape-memory-alloys"]')!.click();
    expect(document.querySelector('.entity-card h2')?.textContent).toBe('Shape-Memory Alloys');
    expect(harness.cameraFocuses).toEqual(['shape-memory-alloys']);
    expect(warning).toHaveBeenCalledOnce();
    expect(String(warning.mock.calls[0]?.[0])).toContain('context');
    dispose();
  });

  it('treats a failed density-zero campus retry as a core failure', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const harness = createHarness();
    const base = harness.options.factories!;
    const requestedDensities: number[] = [];
    harness.options.factories = {
      ...base,
      campus: (args) => {
        requestedDensities.push(args.contextDensity ?? 1);
        throw new Error('campus failed');
      },
    };

    const dispose = mountNeighborhood(mountRoot(), harness.options);

    expect(requestedDensities).toEqual([1, 0]);
    expect(document.querySelector('.app-shell')?.getAttribute('data-webgl-status')).toBe('failed');
    expect(warning).toHaveBeenCalledOnce();
    expect(String(warning.mock.calls[0]?.[0])).toContain('context');
    dispose();
  });

  it('keeps selection and camera behavior when optional selection appearance fails', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const harness = createHarness({
      factories: { selectionAppearance: () => { throw new Error('appearance failed'); } },
    });
    const dispose = mountNeighborhood(mountRoot(), harness.options);

    expect(document.querySelector('.app-shell')?.getAttribute('data-webgl-status')).toBe('ready');
    document.querySelector<HTMLButtonElement>('[data-entity-id="elastocalorics"]')!.click();
    expect(document.querySelector('.entity-card h2')?.textContent).toBe('Elastocalorics');
    expect(harness.cameraFocuses).toEqual(['elastocalorics']);
    expect(warning).toHaveBeenCalledOnce();
    expect(String(warning.mock.calls[0]?.[0])).toContain('selection appearance');
    dispose();
  });

  it('keeps selection and camera behavior when the optional label layer fails', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const harness = createHarness({
      factories: { labels: () => { throw new Error('labels failed'); } },
    });
    const dispose = mountNeighborhood(mountRoot(), harness.options);

    expect(document.querySelector('.app-shell')?.getAttribute('data-webgl-status')).toBe('ready');
    document.querySelector<HTMLButtonElement>('[data-entity-id="smart-material-electronics"]')!.click();
    expect(document.querySelector('.entity-card h2')?.textContent).toBe('Smart Material Electronics');
    expect(harness.cameraFocuses).toEqual(['smart-material-electronics']);
    expect(warning).toHaveBeenCalledOnce();
    expect(String(warning.mock.calls[0]?.[0])).toContain('label layer');
    dispose();
  });

  it('disposes both failed campus attempts and earlier core resources when attachment keeps throwing', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const harness = createHarness();
    const disposed: string[] = [];
    const base = harness.options.factories!;
    const wrap = <T extends { dispose(): void }>(name: string, value: T): T => ({
      ...value,
      dispose: () => { disposed.push(name); value.dispose(); },
    });
    harness.options.factories = {
      ...base,
      runtime: (...args) => wrap('runtime', base.runtime!(...args)),
      disposePalette: () => { disposed.push('palette'); },
      daylight: (...args) => wrap('daylight', base.daylight!(...args)),
      campus: (...args) => {
        const campus = wrap('campus', base.campus!(...args));
        campus.root.name = 'campus:late-failure';
        return campus;
      },
    };
    const originalAdd = harness.scene.add.bind(harness.scene);
    harness.scene.add = ((...objects: THREE.Object3D[]) => {
      if (objects.some(({ name }) => name === 'campus:late-failure')) throw new Error('campus add failed');
      return originalAdd(...objects);
    }) as typeof harness.scene.add;

    const dispose = mountNeighborhood(mountRoot(), harness.options);

    expect(disposed).toEqual(['campus', 'campus', 'daylight', 'palette', 'runtime']);
    expect(document.querySelector('.app-shell')?.getAttribute('data-webgl-status')).toBe('failed');
    expect(warning).toHaveBeenCalledOnce();
    expect(String(warning.mock.calls[0]?.[0])).toContain('context');
    document.querySelector<HTMLButtonElement>('[data-entity-id="smart-textiles"]')!.click();
    expect(document.querySelector('.entity-card h2')?.textContent).toBe('Smart Textiles');
    dispose();
    expect(disposed).toEqual(['campus', 'campus', 'daylight', 'palette', 'runtime']);
  });

  it('disconnects a partially created optional resize observer, warns once, and keeps core ready', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const harness = createHarness();
    const base = harness.options.factories!;
    const disconnect = vi.fn();
    harness.options.factories = {
      ...base,
      resizeObserver: () => ({
        observe: () => { throw new Error('observe failed'); },
        disconnect,
      }),
    };

    const dispose = mountNeighborhood(mountRoot(), harness.options);

    expect(disconnect).toHaveBeenCalledOnce();
    expect(document.querySelector('.app-shell')?.getAttribute('data-webgl-status')).toBe('ready');
    document.querySelector<HTMLButtonElement>('[data-entity-id="smart-textiles"]')!.click();
    expect(document.querySelector('.entity-card h2')?.textContent).toBe('Smart Textiles');
    expect(harness.cameraFocuses).toEqual(['smart-textiles']);
    expect(warning).toHaveBeenCalledOnce();
    expect(String(warning.mock.calls[0]?.[0])).toContain('resize observer');
    dispose();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('rebuilds camera motion policy when reduced motion is toggled', () => {
    const harness = createHarness();
    const dispose = mountNeighborhood(mountRoot(), harness.options);
    document.querySelector<HTMLButtonElement>('[data-entity-id="smart-textiles"]')!.click();

    document.querySelector<HTMLButtonElement>('button[data-reduced-motion]')!.click();

    expect(harness.cameraReducedPolicies).toEqual([false, true]);
    expect(harness.cameraFocuses).toEqual(['smart-textiles', 'smart-textiles']);
    expect(harness.appearanceQualities).toEqual(['reduced']);
    harness.setCameraTransitioning(true);
    harness.canvas.dispatchEvent(new Event('wheel', { bubbles: true }));
    expect(harness.cameraInterrupts).toHaveLength(1);
    dispose();
  });

  it('uses the initial reduced preference for quality and camera behavior', () => {
    const harness = createHarness({
      environment: { width: 1200, dpr: 3, reducedMotion: true, coarsePointer: false },
    });
    const dispose = mountNeighborhood(mountRoot(), harness.options);

    expect(harness.runtimeMaxDprs).toEqual([1.5]);
    expect(harness.campusDensities).toEqual([1]);
    expect(harness.cameraReducedPolicies).toEqual([true]);
    expect(document.querySelector('button[data-reduced-motion]')?.getAttribute('aria-pressed')).toBe('true');
    dispose();
  });

  it('disposes created modules in reverse order and remains inert', () => {
    const order: string[] = [];
    const harness = createHarness();
    const wrap = <T extends { dispose(): void }>(name: string, value: T): T => ({
      ...value,
      dispose: () => { order.push(name); value.dispose(); },
    });
    const base = harness.options.factories!;
    harness.options.factories = {
      ...base,
      runtime: (...args) => wrap('runtime', base.runtime!(...args)),
      daylight: (...args) => wrap('daylight', base.daylight!(...args)),
      campus: (...args) => wrap('campus', base.campus!(...args)),
      controls: (...args) => wrap('controls', base.controls!(...args)),
      cameraController: (...args) => wrap('camera', base.cameraController!(...args)),
      selectionController: (...args) => wrap('selection', base.selectionController!(...args)),
      selectionAppearance: (...args) => wrap('appearance', base.selectionAppearance!(...args)),
      labels: (...args) => wrap('labels', base.labels!(...args)),
      disposePalette: () => { order.push('palette'); },
    };
    const root = mountRoot();
    const dispose = mountNeighborhood(root, harness.options);

    dispose();
    dispose();

    expect(order).toEqual([
      'labels', 'appearance', 'selection', 'camera', 'controls',
      'campus', 'daylight', 'palette', 'runtime',
    ]);
    expect(root.children).toHaveLength(0);
  });

  it('keeps the semantic shell usable while WebGL initializes', () => {
    let statusDuringRuntime = '';
    const harness = createHarness({}, {
      onRuntimeCreate: () => {
        statusDuringRuntime = document.querySelector('[role="status"]')?.textContent ?? '';
        expect(document.querySelector('nav[aria-label="Organization"]')).not.toBeNull();
      },
    });
    mountNeighborhood(mountRoot(), harness.options);
    expect(document.querySelector('nav[aria-label="Organization"]')).not.toBeNull();
    expect(statusDuringRuntime).toContain('Loading');
  });

  it('synchronizes URL state when an entity is selected', () => {
    const pushedUrls: string[] = [];
    const harness = createHarness({
      factories: {
        historyAdapter: () => ({
          read: () => ({ scopeId: 'sei', selectedId: null }),
          push: (state) => { pushedUrls.push(`/?scope=${state.scopeId}&entity=${state.selectedId ?? ''}`); },
          replace: vi.fn(),
          dispose: vi.fn(),
        }),
      },
    });
    const dispose = mountNeighborhood(mountRoot(), harness.options);

    document.querySelector<HTMLButtonElement>('[data-entity-id="elastocalorics"]')!.click();

    expect(pushedUrls).toContain('/?scope=sei&entity=elastocalorics');
    dispose();
  });

  it('restores scope and selection from URL on Back/Forward navigation', () => {
    let popstateHandler: ((event: Event) => void) | undefined;
    const harness = createHarness({
      factories: {
        historyAdapter: (window, onPopState) => {
          popstateHandler = (event) => onPopState(event as never);
          window.addEventListener('popstate', popstateHandler);
          return {
            read: () => ({ scopeId: 'sei', selectedId: null }),
            push: vi.fn(),
            replace: vi.fn(),
            dispose: () => { window.removeEventListener('popstate', popstateHandler!); },
          };
        },
      },
    });
    const dispose = mountNeighborhood(mountRoot(), harness.options);

    expect(document.querySelector('[data-overview]')?.getAttribute('aria-current')).toBe('true');

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(document.querySelector('[data-overview]')?.getAttribute('aria-current')).toBe('true');
    dispose();
  });

  it('subscribes to live media preference changes and disposes the subscription', () => {
    const listeners = new Set<() => void>();
    const fakeMediaQueryList = {
      matches: false,
      addEventListener: (_type: string, listener: () => void) => { listeners.add(listener); },
      removeEventListener: (_type: string, listener: () => void) => { listeners.delete(listener); },
    };
    const harness = createHarness({
      factories: {
        mediaPreferences: (_window, onChange) => {
          const reducedMotion = fakeMediaQueryList;
          const coarsePointer = { ...fakeMediaQueryList };
          const notify = (): void => {
            onChange({ reducedMotion: reducedMotion.matches, coarsePointer: coarsePointer.matches });
          };
          reducedMotion.addEventListener('change', notify);
          coarsePointer.addEventListener('change', notify);
          notify();
          return () => {
            reducedMotion.removeEventListener('change', notify);
            coarsePointer.removeEventListener('change', notify);
          };
        },
      },
    });
    const dispose = mountNeighborhood(mountRoot(), harness.options);

    expect(harness.cameraReducedPolicies).toEqual([false]);
    dispose();
    expect(listeners.size).toBe(0);
  });

  it('rebuilds motion behavior without changing graphics tier when reduced motion is toggled', () => {
    const harness = createHarness();
    const dispose = mountNeighborhood(mountRoot(), harness.options);
    const initialDprs = [...harness.runtimeMaxDprs];
    const initialDensities = [...harness.campusDensities];

    document.querySelector<HTMLButtonElement>('button[data-reduced-motion]')!.click();

    expect(harness.appearanceQualities).toContain('reduced');
    expect(harness.runtimeMaxDprs).toEqual(initialDprs);
    expect(harness.campusDensities).toEqual(initialDensities);
    dispose();
  });
});
