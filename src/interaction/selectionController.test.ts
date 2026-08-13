import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  type Object3D,
} from 'three';
import {
  SelectionController,
  type PointerSample,
  type SelectionOrigin,
} from './selectionController';

interface Harness {
  canvas: HTMLElement;
  camera: PerspectiveCamera;
  proxy: Mesh;
  selections: Array<readonly [string, SelectionOrigin]>;
  renders: { count: number };
  previews: Array<string | null>;
  frames: { queued: Array<FrameRequestCallback>; cancelled: number[] };
  controller: SelectionController;
}

function createHarness(options: {
  readonly proxies?: readonly Object3D[];
  readonly coarsePointer?: boolean;
} = {}): Harness {
  const canvas = document.createElement('div');
  canvas.getBoundingClientRect = () => ({
    left: 100,
    top: 50,
    width: 200,
    height: 100,
    right: 300,
    bottom: 150,
    x: 100,
    y: 50,
    toJSON() { return {}; },
  });
  const camera = new PerspectiveCamera(50, 2, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const proxy = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  proxy.userData.entityId = 'alpha';
  proxy.updateMatrixWorld();
  const selections: Array<readonly [string, SelectionOrigin]> = [];
  const renders = { count: 0 };
  const previews: Array<string | null> = [];
  const frames = { queued: [] as FrameRequestCallback[], cancelled: [] as number[] };
  const controller = new SelectionController({
    canvas,
    camera,
    proxies: options.proxies ?? [proxy],
    onSelect: (id, origin) => { selections.push([id, origin]); },
    onPreview: (id) => { previews.push(id); },
    requestRender: () => { renders.count += 1; },
    coarsePointer: options.coarsePointer,
    requestFrame: (callback) => {
      frames.queued.push(callback);
      return frames.queued.length - 1;
    },
    cancelFrame: (frame) => { frames.cancelled.push(frame); },
  });
  return { canvas, camera, proxy, selections, renders, previews, frames, controller };
}

function sample(
  pointerId: number,
  clientX: number,
  clientY: number,
  capture?: { captured: number[]; released: number[] },
): PointerSample {
  return {
    pointerId,
    clientX,
    clientY,
    setPointerCapture: capture
      ? (id) => { capture.captured.push(id); }
      : undefined,
    releasePointerCapture: capture
      ? (id) => { capture.released.push(id); }
      : undefined,
  };
}

function dispatchPointer(
  canvas: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | 'pointerleave',
  pointerId: number,
  clientX: number,
  clientY: number,
): void {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  canvas.dispatchEvent(event);
}

describe('SelectionController', () => {
  it('reports every explicit nonblank selection with its origin, including repeated IDs', () => {
    const { controller, selections, renders } = createHarness();

    controller.select('alpha', 'navigator');
    controller.select('alpha', 'keyboard');
    controller.select('beta', 'scene');

    expect(controller.selectedId).toBe('beta');
    expect(selections).toEqual([
      ['alpha', 'navigator'],
      ['alpha', 'keyboard'],
      ['beta', 'scene'],
    ]);
    expect(renders.count).toBe(3);
  });

  it('rejects a blank explicit ID before changing state or notifying collaborators', () => {
    const { controller, selections, renders } = createHarness();
    controller.select('alpha', 'navigator');
    const renderCount = renders.count;

    expect(() => controller.select('   ', 'keyboard')).toThrowError('Selection ID must be nonblank');
    expect(controller.selectedId).toBe('alpha');
    expect(selections).toEqual([['alpha', 'navigator']]);
    expect(renders.count).toBe(renderCount);
  });

  it('raycasts a center release against the real proxy list and selects its entity', () => {
    const { controller, selections, renders } = createHarness();

    controller.pointerDown(sample(1, 200, 100));
    controller.pointerUp(sample(1, 200, 100));

    expect(controller.selectedId).toBe('alpha');
    expect(selections).toEqual([['alpha', 'scene']]);
    expect(renders.count).toBe(1);
  });

  it('raycasts only top-level proxies, non-recursively', () => {
    const group = new Group();
    const nested = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    nested.userData.entityId = 'nested';
    group.add(nested);
    group.updateMatrixWorld(true);
    const { controller, selections } = createHarness({ proxies: [group] });

    controller.pointerDown(sample(1, 200, 100));
    controller.pointerUp(sample(1, 200, 100));

    expect(controller.selectedId).toBeNull();
    expect(selections).toEqual([]);
  });

  it('does not select an empty hit or a hit without a nonblank entity ID', () => {
    const { controller, proxy, selections } = createHarness();

    controller.pointerDown(sample(1, 100, 50));
    controller.pointerUp(sample(1, 100, 50));
    proxy.userData.entityId = '  ';
    controller.pointerDown(sample(2, 200, 100));
    controller.pointerUp(sample(2, 200, 100));

    expect(controller.selectedId).toBeNull();
    expect(selections).toEqual([]);
  });

  it('treats movement beyond six CSS pixels as a drag even after returning to the start', () => {
    const { controller, selections } = createHarness();

    controller.pointerDown(sample(1, 200, 100));
    controller.pointerMove(sample(1, 207, 100));
    controller.pointerMove(sample(1, 200, 100));
    controller.pointerUp(sample(1, 200, 100));

    expect(controller.selectedId).toBeNull();
    expect(selections).toEqual([]);
  });

  it('rejects a release beyond six CSS pixels when no intermediate move event arrived', () => {
    const { controller, selections } = createHarness();

    controller.pointerDown(sample(1, 170, 100));
    controller.pointerUp(sample(1, 200, 100));

    expect(controller.selectedId).toBeNull();
    expect(selections).toEqual([]);
  });

  it('keeps exactly six CSS pixels within the click threshold', () => {
    const { controller, selections } = createHarness();

    controller.pointerDown(sample(1, 194, 100));
    controller.pointerMove(sample(1, 200, 100));
    controller.pointerUp(sample(1, 200, 100));

    expect(controller.selectedId).toBe('alpha');
    expect(selections).toEqual([['alpha', 'scene']]);
  });

  it('cancels selection when a second pointer joins the gesture', () => {
    const { controller, selections } = createHarness();
    const first = { captured: [] as number[], released: [] as number[] };
    const second = { captured: [] as number[], released: [] as number[] };

    controller.pointerDown(sample(1, 200, 100, first));
    controller.pointerDown(sample(2, 200, 100, second));
    controller.pointerMove(sample(2, 250, 100));
    controller.pointerUp(sample(2, 250, 100, second));
    controller.pointerUp(sample(1, 200, 100, first));

    expect(selections).toEqual([]);
    expect(first).toEqual({ captured: [1], released: [1] });
    expect(second).toEqual({ captured: [2], released: [2] });
  });

  it('accepts ten CSS pixels as a coarse-pointer tap but rejects it for a fine pointer', () => {
    const fine = createHarness();
    const coarse = createHarness({ coarsePointer: true });

    fine.controller.pointerDown(sample(1, 190, 100));
    fine.controller.pointerUp(sample(1, 200, 100));
    coarse.controller.pointerDown(sample(1, 190, 100));
    coarse.controller.pointerUp(sample(1, 200, 100));

    expect(fine.selections).toEqual([]);
    expect(coarse.selections).toEqual([['alpha', 'scene']]);
  });

  it('coalesces hover raycasts to the latest pointer sample in one frame', () => {
    const { controller, frames, previews } = createHarness();

    controller.pointerMove(sample(1, 100, 50));
    controller.pointerMove(sample(1, 200, 100));

    expect(frames.queued).toHaveLength(1);
    frames.queued[0]?.(0);

    expect(previews).toEqual(['alpha']);
  });

  it('clears preview when the pointer leaves without committing selection', () => {
    const { canvas, frames, previews, selections } = createHarness();

    dispatchPointer(canvas, 'pointermove', 1, 200, 100);
    frames.queued[0]?.(0);
    dispatchPointer(canvas, 'pointerleave', 1, 200, 100);

    expect(previews).toEqual(['alpha', null]);
    expect(selections).toEqual([]);
  });

  it('cancels pending hover work and clears preview during cancellation and disposal', () => {
    const { controller, frames, previews } = createHarness();

    controller.pointerMove(sample(1, 200, 100));
    frames.queued[0]?.(0);
    controller.pointerMove(sample(1, 200, 100));
    controller.pointerDown(sample(1, 200, 100));
    controller.pointerCancel(sample(1, 200, 100));
    controller.dispose();

    expect(frames.cancelled).toEqual([1]);
    expect(previews).toEqual(['alpha', null]);
  });

  it('ignores a zero-sized canvas after releasing capture', () => {
    const { canvas, controller, selections } = createHarness();
    const capture = { captured: [] as number[], released: [] as number[] };
    canvas.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      width: 0,
      height: 100,
      right: 100,
      bottom: 150,
      x: 100,
      y: 50,
      toJSON() { return {}; },
    });

    controller.pointerDown(sample(1, 100, 100, capture));
    controller.pointerUp(sample(1, 100, 100, capture));

    expect(controller.selectedId).toBeNull();
    expect(selections).toEqual([]);
    expect(capture).toEqual({ captured: [1], released: [1] });
  });

  it('cancels an active pointer with cleanup and no selection', () => {
    const { controller, selections } = createHarness();
    const capture = { captured: [] as number[], released: [] as number[] };

    controller.pointerDown(sample(4, 200, 100, capture));
    controller.pointerCancel(sample(4, 200, 100, capture));
    controller.pointerUp(sample(4, 200, 100, capture));

    expect(controller.selectedId).toBeNull();
    expect(selections).toEqual([]);
    expect(capture).toEqual({ captured: [4], released: [4] });
  });

  it('wires canvas pointer listeners through capture, picking, and cancel cleanup', () => {
    const { canvas, controller, selections } = createHarness();
    const captured: number[] = [];
    const released: number[] = [];
    canvas.setPointerCapture = (id) => { captured.push(id); };
    canvas.releasePointerCapture = (id) => { released.push(id); };

    dispatchPointer(canvas, 'pointerdown', 3, 200, 100);
    dispatchPointer(canvas, 'pointerup', 3, 200, 100);
    dispatchPointer(canvas, 'pointerdown', 4, 200, 100);
    dispatchPointer(canvas, 'pointercancel', 4, 200, 100);

    expect(controller.selectedId).toBe('alpha');
    expect(selections).toEqual([['alpha', 'scene']]);
    expect(captured).toEqual([3, 4]);
    expect(released).toEqual([3, 4]);
  });

  it('disposes idempotently, releases an active capture, removes listeners, and ignores later methods', () => {
    const { canvas, controller, selections, renders } = createHarness();
    const capture = { captured: [] as number[], released: [] as number[] };
    controller.pointerDown(sample(9, 200, 100, capture));

    controller.dispose();
    controller.dispose();
    controller.pointerMove(sample(9, 220, 100));
    controller.pointerUp(sample(9, 200, 100, capture));
    controller.pointerCancel(sample(9, 200, 100, capture));
    controller.pointerDown(sample(10, 200, 100, capture));
    controller.select('alpha', 'navigator');
    dispatchPointer(canvas, 'pointerdown', 11, 200, 100);
    dispatchPointer(canvas, 'pointerup', 11, 200, 100);

    expect(controller.selectedId).toBeNull();
    expect(selections).toEqual([]);
    expect(renders.count).toBe(0);
    expect(capture).toEqual({ captured: [9], released: [9] });
  });

  it('supports an injected raycaster while asserting only controller outcomes', () => {
    const { canvas, camera, proxy } = createHarness();
    const selections: Array<readonly [string, SelectionOrigin]> = [];
    proxy.userData.entityId = 'injected';
    const controller = new SelectionController({
      canvas,
      camera,
      proxies: [proxy],
      onSelect: (id, origin) => { selections.push([id, origin]); },
      requestRender() {},
      raycaster: new Raycaster(),
    });

    controller.pointerDown(sample(1, 200, 100));
    controller.pointerUp(sample(1, 200, 100));

    expect(controller.selectedId).toBe('injected');
    expect(selections).toEqual([['injected', 'scene']]);
  });
});
