import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSceneRuntime, type RendererLike } from './runtime';

class RecordingRenderer implements RendererLike {
  readonly domElement = document.createElement('canvas');
  readonly pixelRatios: number[] = [];
  readonly sizes: Array<readonly [number, number, boolean | undefined]> = [];
  readonly renders: Array<readonly [THREE.Scene, THREE.Camera]> = [];
  disposeCount = 0;
  outputColorSpace: THREE.ColorSpace = THREE.NoColorSpace;
  toneMapping: THREE.ToneMapping = THREE.NoToneMapping;
  readonly shadowMap = {
    enabled: false,
    type: THREE.BasicShadowMap,
  };

  setPixelRatio(value: number): void {
    this.pixelRatios.push(value);
  }

  setSize(width: number, height: number, updateStyle?: boolean): void {
    this.sizes.push([width, height, updateStyle]);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renders.push([scene, camera]);
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

class ManualRaf {
  readonly cancelled: number[] = [];
  private readonly callbacks = new Map<number, FrameRequestCallback>();
  private readonly callbackHistory = new Map<number, FrameRequestCallback>();
  private nextId = 1;

  readonly request: typeof window.requestAnimationFrame = (callback) => {
    const id = this.nextId;
    this.nextId += 1;
    this.callbacks.set(id, callback);
    this.callbackHistory.set(id, callback);
    return id;
  };

  readonly cancel: typeof window.cancelAnimationFrame = (id) => {
    this.cancelled.push(id);
    this.callbacks.delete(id);
  };

  get pendingCount(): number {
    return this.callbacks.size;
  }

  get pendingIds(): number[] {
    return [...this.callbacks.keys()];
  }

  callbackFor(id: number): FrameRequestCallback | undefined {
    return this.callbackHistory.get(id);
  }

  flushNext(time = 16): void {
    const next = this.callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
    if (!next) throw new Error('No animation frame is pending.');
    const [id, callback] = next;
    this.callbacks.delete(id);
    callback(time);
  }
}

class ManualResizeObserver {
  readonly observed: Element[] = [];
  disconnectCount = 0;
  private callback?: ResizeObserverCallback;

  readonly factory = (callback: ResizeObserverCallback): Pick<ResizeObserver, 'observe' | 'disconnect'> => {
    this.callback = callback;
    return {
      observe: this.observe,
      disconnect: this.disconnect,
    };
  };

  readonly observe = (target: Element): void => {
    this.observed.push(target);
  };

  readonly disconnect = (): void => {
    this.disconnectCount += 1;
  };

  trigger(): void {
    this.callback?.([], {} as ResizeObserver);
  }
}

function createHarness(width = 640, height = 320) {
  let rect = { width, height };
  const container = document.createElement('div');
  container.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    right: rect.width,
    bottom: rect.height,
    left: 0,
    width: rect.width,
    height: rect.height,
    toJSON: () => ({}),
  });
  const renderer = new RecordingRenderer();
  const raf = new ManualRaf();
  const resizeObserver = new ManualResizeObserver();
  const runtime = createSceneRuntime(container, {
    maxDpr: 2,
    rendererFactory: () => renderer,
    resizeObserverFactory: resizeObserver.factory,
    requestAnimationFrame: raf.request,
    cancelAnimationFrame: raf.cancel,
  });

  return {
    container,
    renderer,
    raf,
    resizeObserver,
    runtime,
    setRect(nextWidth: number, nextHeight: number): void {
      rect = { width: nextWidth, height: nextHeight };
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scene runtime', () => {
  it('creates the authored neighborhood scene and exact overview camera', () => {
    const { runtime } = createHarness(800, 400);

    expect(runtime.scene.name).toBe('scene:neighborhood');
    expect(runtime.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect([runtime.camera.fov, runtime.camera.aspect, runtime.camera.near, runtime.camera.far]).toEqual([40, 2, 0.1, 260]);
    expect(runtime.camera.up.toArray()).toEqual([0, 1, 0]);
    expect(runtime.camera.position.toArray()).toEqual([38, 34, 48]);

    const direction = runtime.camera.getWorldDirection(new THREE.Vector3());
    const expectedDirection = new THREE.Vector3(-38, -34, -48).normalize();
    expect(direction.x).toBeCloseTo(expectedDirection.x, 10);
    expect(direction.y).toBeCloseTo(expectedDirection.y, 10);
    expect(direction.z).toBeCloseTo(expectedDirection.z, 10);

    runtime.dispose();
  });

  it('caps DPR, configures and sizes the renderer, and appends its canvas', () => {
    vi.stubGlobal('devicePixelRatio', 4);
    const { container, renderer, runtime } = createHarness();

    expect(renderer.pixelRatios).toEqual([2]);
    expect(renderer.sizes).toEqual([[640, 320, false]]);
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(container.lastElementChild).toBe(renderer.domElement);

    runtime.dispose();
  });

  it('enables soft renderer shadows and the exact neutral scene atmosphere', () => {
    const { renderer, runtime } = createHarness();

    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.shadowMap.type).toBe(THREE.PCFSoftShadowMap);
    expect(runtime.scene.background).toBeInstanceOf(THREE.Color);
    expect((runtime.scene.background as THREE.Color).getStyle()).toBe('rgb(224,232,228)');
    expect(renderer.domElement.dataset.shadowMap).toBe('enabled');

    runtime.dispose();
  });

  it('adds a gradient sky sphere to the scene', () => {
    const { runtime } = createHarness();

    const sky = runtime.scene.getObjectByName('sky:gradient');
    expect(sky).toBeDefined();
    expect(sky).toBeInstanceOf(THREE.Mesh);
    expect((sky as THREE.Mesh).geometry).toBeInstanceOf(THREE.SphereGeometry);
    expect((sky as THREE.Mesh).material).toBeInstanceOf(THREE.ShaderMaterial);

    runtime.dispose();
  });

  it('retains sRGB output color space and ACES tone mapping', () => {
    const { renderer, runtime } = createHarness();

    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);

    runtime.dispose();
  });

  it('coalesces repeated static render requests into one animation frame', () => {
    const { raf, renderer, runtime } = createHarness();
    expect(raf.pendingCount).toBe(1);
    raf.flushNext();
    expect(renderer.renders).toEqual([[runtime.scene, runtime.camera]]);

    runtime.requestRender();
    runtime.requestRender();
    runtime.requestRender();

    expect(raf.pendingCount).toBe(1);
    raf.flushNext(32);
    expect(renderer.renders).toEqual([
      [runtime.scene, runtime.camera],
      [runtime.scene, runtime.camera],
    ]);
    expect(raf.pendingCount).toBe(0);

    runtime.dispose();
  });

  it('keeps one continuous loop until its final independent reason clears', () => {
    const { raf, renderer, runtime } = createHarness();
    expect(raf.pendingCount).toBe(1);
    raf.flushNext();

    runtime.setContinuous('orbit-controls', true);
    runtime.setContinuous('focus-transition', true);
    expect(raf.pendingCount).toBe(1);

    raf.flushNext(32);
    expect(renderer.renders).toHaveLength(2);
    expect(raf.pendingCount).toBe(1);

    runtime.setContinuous('orbit-controls', false);
    expect(raf.pendingCount).toBe(1);
    raf.flushNext(48);
    expect(renderer.renders).toHaveLength(3);
    expect(raf.pendingCount).toBe(1);

    runtime.setContinuous('focus-transition', false);
    expect(raf.pendingCount).toBe(0);
    expect(renderer.renders).toHaveLength(3);

    runtime.dispose();
  });

  it('responds to observed resizes with clamped dimensions, projection, and one render request', () => {
    const { container, raf, renderer, resizeObserver, runtime, setRect } = createHarness();
    expect(raf.pendingCount).toBe(1);
    raf.flushNext();
    const priorProjection = runtime.camera.projectionMatrix.clone();

    expect(resizeObserver.observed).toEqual([container]);
    setRect(0, -20);
    resizeObserver.trigger();
    resizeObserver.trigger();

    expect(renderer.sizes.at(-1)).toEqual([1, 1, false]);
    expect(runtime.camera.aspect).toBe(1);
    expect(runtime.camera.projectionMatrix.equals(priorProjection)).toBe(false);
    expect(raf.pendingCount).toBe(1);
    raf.flushNext(32);
    expect(renderer.renders).toHaveLength(2);

    runtime.dispose();
  });

  it('disposes owned resources once, cancels work, and rejects every later render path', () => {
    const { container, raf, renderer, resizeObserver, runtime } = createHarness();
    const pendingId = raf.pendingIds[0];
    expect(pendingId).toBeDefined();
    if (pendingId === undefined) return;
    const cancelledCallback = raf.callbackFor(pendingId);
    expect(cancelledCallback).toBeDefined();

    runtime.dispose();
    runtime.dispose();

    expect(raf.cancelled).toEqual([pendingId]);
    expect(raf.pendingCount).toBe(0);
    expect(resizeObserver.disconnectCount).toBe(1);
    expect(renderer.disposeCount).toBe(1);
    expect(container.contains(renderer.domElement)).toBe(false);

    cancelledCallback?.(32);
    resizeObserver.trigger();
    runtime.requestRender();
    runtime.setContinuous('late-consumer', true);

    expect(raf.pendingCount).toBe(0);
    expect(renderer.renders).toHaveLength(0);
  });
});
