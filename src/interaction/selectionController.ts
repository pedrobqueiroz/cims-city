import { Raycaster, Vector2, type Camera, type Object3D } from 'three';

export type SelectionOrigin = 'scene' | 'navigator' | 'keyboard';

export interface PointerSample {
  pointerId: number;
  clientX: number;
  clientY: number;
  setPointerCapture?(pointerId: number): void;
  releasePointerCapture?(pointerId: number): void;
}

export interface SelectionControllerOptions {
  canvas: HTMLElement;
  camera: Camera;
  proxies: readonly Object3D[];
  onSelect(id: string, origin: SelectionOrigin): void;
  onPreview?(id: string | null): void;
  requestRender(): void;
  raycaster?: Raycaster;
  coarsePointer?: boolean;
  requestFrame?(callback: FrameRequestCallback): number;
  cancelFrame?(frame: number): void;
}

export class SelectionController {
  selectedId: string | null = null;

  private readonly canvas: HTMLElement;
  private readonly camera: Camera;
  private readonly proxies: Object3D[];
  private readonly onSelect: (id: string, origin: SelectionOrigin) => void;
  private readonly onPreview: (id: string | null) => void;
  private readonly requestRender: () => void;
  private readonly raycaster: Raycaster;
  private readonly coarsePointer: boolean;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (frame: number) => void;
  private readonly pointer = new Vector2();
  private readonly activePointers = new Map<number, ActivePointer>();
  private previewId: string | null = null;
  private pendingPreview: PointerSample | undefined;
  private previewFrame: number | undefined;
  private previewGeneration = 0;
  private disposed = false;

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerDown(this.eventSample(event));
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.pointerMove(this.eventSample(event));
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.pointerUp(this.eventSample(event));
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.pointerCancel(this.eventSample(event));
  };

  private readonly handlePointerLeave = (): void => {
    this.pointerLeave();
  };

  constructor(options: SelectionControllerOptions) {
    this.canvas = options.canvas;
    this.camera = options.camera;
    this.proxies = [...options.proxies];
    this.onSelect = options.onSelect;
    this.onPreview = options.onPreview ?? (() => {});
    this.requestRender = options.requestRender;
    this.raycaster = options.raycaster ?? new Raycaster();
    this.coarsePointer = options.coarsePointer ?? false;
    this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((frame) => cancelAnimationFrame(frame));

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
  }

  select(id: string, origin: SelectionOrigin): void {
    if (this.disposed) return;
    if (id.trim().length === 0) throw new Error('Selection ID must be nonblank');
    this.selectedId = id;
    this.onSelect(id, origin);
    this.requestRender();
  }

  pointerDown(sample: PointerSample): void {
    if (this.disposed || this.activePointers.has(sample.pointerId)) return;
    const cancelled = this.activePointers.size > 0;
    if (cancelled) {
      for (const active of this.activePointers.values()) active.cancelled = true;
    }
    this.cancelPendingPreview();
    this.clearPreview();
    this.activePointers.set(sample.pointerId, {
      pointerId: sample.pointerId,
      startX: sample.clientX,
      startY: sample.clientY,
      dragged: false,
      cancelled,
      releasePointerCapture: sample.releasePointerCapture,
    });
    safelyCapture(sample.setPointerCapture, sample.pointerId);
  }

  pointerMove(sample: PointerSample): void {
    if (this.disposed) return;
    const active = this.activePointers.get(sample.pointerId);
    if (active && !active.dragged) {
      active.dragged = Math.hypot(
        sample.clientX - active.startX,
        sample.clientY - active.startY,
      ) > this.tapThreshold();
    }
    if (this.activePointers.size === 0) this.schedulePreview(sample);
  }

  pointerUp(sample: PointerSample): void {
    if (this.disposed) return;
    const active = this.activePointers.get(sample.pointerId);
    if (!active) return;
    const dragged = active.dragged || Math.hypot(
      sample.clientX - active.startX,
      sample.clientY - active.startY,
    ) > this.tapThreshold();
    this.activePointers.delete(sample.pointerId);
    safelyCapture(
      sample.releasePointerCapture ?? active.releasePointerCapture,
      active.pointerId,
    );
    this.clearPreview();
    if (!active.cancelled && !dragged) this.pick(sample.clientX, sample.clientY);
  }

  pointerCancel(sample: PointerSample): void {
    if (this.disposed) return;
    const active = this.activePointers.get(sample.pointerId);
    if (!active) return;
    this.activePointers.delete(sample.pointerId);
    safelyCapture(
      sample.releasePointerCapture ?? active.releasePointerCapture,
      active.pointerId,
    );
    this.cancelPendingPreview();
    this.clearPreview();
  }

  pointerLeave(): void {
    if (this.disposed) return;
    this.cancelPendingPreview();
    this.clearPreview();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const active of this.activePointers.values()) {
      safelyCapture(active.releasePointerCapture, active.pointerId);
    }
    this.activePointers.clear();
    this.cancelPendingPreview();
    this.clearPreview();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
  }

  private pick(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.proxies, false)[0];
    const entityId: unknown = hit?.object.userData.entityId;
    if (typeof entityId === 'string' && entityId.trim().length > 0) {
      this.select(entityId, 'scene');
    }
  }

  private schedulePreview(sample: PointerSample): void {
    this.pendingPreview = sample;
    if (this.previewFrame !== undefined) return;
    const generation = this.previewGeneration + 1;
    this.previewGeneration = generation;
    this.previewFrame = this.requestFrame(() => {
      if (generation !== this.previewGeneration) return;
      this.previewFrame = undefined;
      const pending = this.pendingPreview;
      this.pendingPreview = undefined;
      if (!pending || this.disposed) return;
      this.previewAt(pending.clientX, pending.clientY);
    });
  }

  private previewAt(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      this.setPreview(null);
      return;
    }
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.proxies, false)[0];
    const entityId: unknown = hit?.object.userData.entityId;
    this.setPreview(typeof entityId === 'string' && entityId.trim().length > 0 ? entityId : null);
  }

  private setPreview(id: string | null): void {
    if (this.previewId === id) return;
    this.previewId = id;
    this.onPreview(id);
  }

  private clearPreview(): void {
    this.setPreview(null);
  }

  private cancelPendingPreview(): void {
    this.previewGeneration += 1;
    if (this.previewFrame !== undefined) this.cancelFrame(this.previewFrame);
    this.previewFrame = undefined;
    this.pendingPreview = undefined;
  }

  private tapThreshold(): number {
    return this.coarsePointer ? 12 : 6;
  }

  private eventSample(event: PointerEvent): PointerSample {
    return {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      setPointerCapture: typeof this.canvas.setPointerCapture === 'function'
        ? (pointerId) => { this.canvas.setPointerCapture(pointerId); }
        : undefined,
      releasePointerCapture: typeof this.canvas.releasePointerCapture === 'function'
        ? (pointerId) => { this.canvas.releasePointerCapture(pointerId); }
        : undefined,
    };
  }
}

interface ActivePointer {
  pointerId: number;
  startX: number;
  startY: number;
  dragged: boolean;
  cancelled: boolean;
  releasePointerCapture?: (pointerId: number) => void;
}

function safelyCapture(
  operation: ((pointerId: number) => void) | undefined,
  pointerId: number,
): void {
  try {
    operation?.(pointerId);
  } catch {
    // Pointer capture can already be lost when the browser tears down a pointer.
  }
}
