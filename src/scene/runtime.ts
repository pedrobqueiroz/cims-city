import * as THREE from 'three';

export interface RendererLike {
  domElement: HTMLCanvasElement;
  setPixelRatio(value: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
  outputColorSpace: THREE.ColorSpace;
  toneMapping: THREE.ToneMapping;
  shadowMap: {
    enabled: boolean;
    type: number;
    needsUpdate?: boolean;
  };
}

export interface RuntimeOptions {
  maxDpr: number;
  rendererFactory?: () => RendererLike;
  resizeObserverFactory?: (callback: ResizeObserverCallback) => Pick<ResizeObserver, 'observe' | 'disconnect'>;
  requestAnimationFrame?: typeof window.requestAnimationFrame;
  cancelAnimationFrame?: typeof window.cancelAnimationFrame;
}

export interface SceneRuntime {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: RendererLike;
  requestRender(): void;
  setContinuous(reason: string, active: boolean): void;
  dispose(): void;
}

export function createSceneRuntime(container: HTMLElement, options: RuntimeOptions): SceneRuntime {
  const scene = new THREE.Scene();
  scene.name = 'scene:neighborhood';
  const sceneBackground = new THREE.Color('#dce3df');
  scene.background = sceneBackground;

  const initialRect = container.getBoundingClientRect();
  const initialWidth = Math.max(1, initialRect.width);
  const initialHeight = Math.max(1, initialRect.height);
  const camera = new THREE.PerspectiveCamera(40, initialWidth / initialHeight, 0.1, 260);
  camera.up.set(0, 1, 0);
  camera.position.set(38, 34, 48);
  camera.lookAt(0, 0, 0);

  const renderer: RendererLike = options.rendererFactory?.() ?? (
    new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    }) as unknown as RendererLike
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.dataset.shadowMap = renderer.shadowMap.enabled ? 'enabled' : 'disabled';
  renderer.domElement.dataset.sceneBackground = `#${sceneBackground.getHexString()}`;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.maxDpr));
  container.appendChild(renderer.domElement);

  const requestFrame = options.requestAnimationFrame ?? window.requestAnimationFrame.bind(window);
  const cancelFrame = options.cancelAnimationFrame ?? window.cancelAnimationFrame.bind(window);
  const continuousReasons = new Set<string>();
  let disposed = false;
  let frameId: number | undefined;
  let staticRenderRequested = false;

  function scheduleFrame(): void {
    if (disposed || frameId !== undefined) return;
    frameId = requestFrame(renderFrame);
  }

  function renderFrame(): void {
    frameId = undefined;
    if (disposed) return;
    staticRenderRequested = false;
    renderer.render(scene, camera);
    if (continuousReasons.size > 0) scheduleFrame();
  }

  function requestRender(): void {
    if (disposed) return;
    staticRenderRequested = true;
    scheduleFrame();
  }

  function setContinuous(reason: string, active: boolean): void {
    if (disposed) return;
    if (active) {
      continuousReasons.add(reason);
      scheduleFrame();
      return;
    }

    continuousReasons.delete(reason);
    if (continuousReasons.size === 0 && !staticRenderRequested && frameId !== undefined) {
      cancelFrame(frameId);
      frameId = undefined;
    }
  }

  function resize(): void {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  }

  const resizeObserverFactory = options.resizeObserverFactory
    ?? ((callback: ResizeObserverCallback) => new ResizeObserver(callback));
  const resizeObserver = resizeObserverFactory(resize);
  resizeObserver.observe(container);
  resize();

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    continuousReasons.clear();
    staticRenderRequested = false;
    if (frameId !== undefined) {
      cancelFrame(frameId);
      frameId = undefined;
    }
    resizeObserver.disconnect();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
    renderer.dispose();
  }

  return {
    scene,
    camera,
    renderer,
    requestRender,
    setContinuous,
    dispose,
  };
}
