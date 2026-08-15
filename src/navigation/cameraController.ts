import { Box3, Vector3, type PerspectiveCamera } from 'three';
import type { LayoutNode } from '../scene/layout';
import { fitPerspectiveView, type CameraPose, type PerspectiveFitInput } from './cameraFraming';

const TRANSITION_DURATION_MS = 400;
const MIN_POLAR_ANGLE = (25 * Math.PI) / 180;
const MAX_POLAR_ANGLE = (85 * Math.PI) / 180;
const MIN_AZIMUTH_ANGLE = -Math.PI;
const MAX_AZIMUTH_ANGLE = Math.PI;
const OVERVIEW_TARGET = new Vector3(0, 2, 0);
const LANDSCAPE_OVERVIEW_DIRECTION = new Vector3(52, 44, 66).normalize();
const PORTRAIT_OVERVIEW_DIRECTION = new Vector3(82, 96, 106).normalize();
const LOCAL_DIRECTION = new Vector3(0.72, 0.55, 0.92).normalize();
const WORLD_UP = new Vector3(0, 1, 0);

export interface OrbitAdapter {
  target: Vector3;
  enabled: boolean;
  enablePan: boolean;
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  update(): void;
}

export type CameraState =
  | { mode: 'overview' }
  | { mode: 'context'; entityId: 'sei' }
  | { mode: 'local'; entityId: string };

export interface CameraControllerOptions {
  camera: PerspectiveCamera;
  orbit: OrbitAdapter;
  layout: ReadonlyMap<string, LayoutNode>;
  requestRender(): void;
  setContinuous(reason: string, active: boolean): void;
  reducedMotion: boolean;
  now?: () => number;
}

export class CameraController {
  state: CameraState = { mode: 'overview' };

  private readonly camera: PerspectiveCamera;
  private readonly orbit: OrbitAdapter;
  private readonly layout: ReadonlyMap<string, LayoutNode>;
  private readonly requestRender: () => void;
  private readonly setContinuous: (reason: string, active: boolean) => void;
  private readonly reducedMotion: boolean;
  private readonly now: () => number;
  private transition: CameraTransition | undefined;
  private disposed = false;

  constructor(options: CameraControllerOptions) {
    this.camera = options.camera;
    this.orbit = options.orbit;
    this.layout = options.layout;
    this.requestRender = options.requestRender;
    this.setContinuous = options.setContinuous;
    this.reducedMotion = options.reducedMotion;
    this.now = options.now ?? (() => performance.now());

    const overview = this.overviewPose();
    this.applyPose(overview.position, overview.target);
    this.applyOverviewLimits();
    this.orbit.enabled = true;
    this.orbit.update();
  }

  get isTransitioning(): boolean {
    return this.transition !== undefined;
  }

  focusEntity(id: string, startTime = this.now()): void {
    if (this.disposed) return;
    const node = this.layout.get(id);
    if (!node) throw new Error(`Unknown camera focus entity: ${id}`);

    const pose = this.nodePose(node);
    this.state = id === 'sei'
      ? { mode: 'context', entityId: 'sei' }
      : { mode: 'local', entityId: id };
    this.startMove(pose.position, pose.target, startTime);
  }

  showOverview(startTime = this.now()): void {
    if (this.disposed) return;
    this.state = { mode: 'overview' };
    const overview = this.overviewPose();
    this.startMove(overview.position, overview.target, startTime);
  }

  update(timeMs: number): void {
    if (this.disposed || !this.transition) return;
    this.advanceTransition(timeMs);
  }

  refitCurrentTarget(
    bounds: Box3,
    viewport: PerspectiveFitInput['viewport'],
    safeInsets: PerspectiveFitInput['safeInsets'],
  ): void {
    if (this.disposed) return;
    const interrupted = this.transition !== undefined;
    if (interrupted) this.interrupt();
    const direction = this.camera.position.clone().sub(this.orbit.target).normalize();
    const pose = fitPerspectiveView({
      bounds,
      direction,
      verticalFovDegrees: this.camera.fov,
      viewport,
      safeInsets,
      padding: 24,
    });
    this.applyPose(pose.position, pose.target);
    if (interrupted) this.applyFreeExploreLimits();
    else this.applyStateLimits();
    this.orbit.enabled = true;
    this.orbit.update();
    this.requestRender();
  }

  interrupt(): void {
    if (this.disposed || !this.transition) return;
    this.advanceTransition(this.now(), false);
    this.finishTransition(false, true);
  }

  dispose(): void {
    if (this.disposed) return;
    this.interrupt();
    this.disposed = true;
  }

  private startMove(position: Vector3, target: Vector3, startTime: number): void {
    const wasTransitioning = this.transition !== undefined;
    if (wasTransitioning) this.advanceTransition(startTime, false);

    if (this.reducedMotion) {
      this.transition = undefined;
      this.applyPose(position, target);
      this.applyStateLimits();
      this.orbit.enabled = true;
      this.orbit.update();
      if (wasTransitioning) this.setContinuous('camera', false);
      this.requestRender();
      return;
    }

    this.transition = {
      startTime,
      fromPosition: this.camera.position.clone(),
      fromTarget: this.orbit.target.clone(),
      toPosition: position.clone(),
      toTarget: target.clone(),
    };
    this.orbit.enabled = false;
    if (!wasTransitioning) this.setContinuous('camera', true);
    this.requestRender();
  }

  private advanceTransition(timeMs: number, completeAtEnd = true): void {
    const transition = this.transition;
    if (!transition) return;
    const progress = Math.min(Math.max((timeMs - transition.startTime) / TRANSITION_DURATION_MS, 0), 1);
    const eased = cubicInOut(progress);
    this.applyPose(
      transition.fromPosition.clone().lerp(transition.toPosition, eased),
      transition.fromTarget.clone().lerp(transition.toTarget, eased),
    );
    this.requestRender();
    if (completeAtEnd && progress === 1) this.finishTransition();
  }

  private finishTransition(updateOrbit = true, interrupted = false): void {
    if (!this.transition) return;
    this.transition = undefined;
    if (interrupted) this.applyFreeExploreLimits();
    else this.applyStateLimits();
    this.orbit.enabled = true;
    if (updateOrbit) this.orbit.update();
    this.setContinuous('camera', false);
  }

  private applyPose(position: Vector3, target: Vector3): void {
    this.camera.up.copy(WORLD_UP);
    this.camera.position.copy(position);
    this.orbit.target.copy(target);
    this.camera.lookAt(target);
  }

  private applyStateLimits(): void {
    if (this.state.mode === 'overview') this.applyOverviewLimits();
    else if (this.state.mode === 'context') this.applyContextLimits();
    else this.applyLocalLimits();
  }

  private applyOverviewLimits(): void {
    this.applyManualLimits();
    this.orbit.minDistance = 24;
    const authoredDistance = this.camera.position.distanceTo(this.orbit.target);
    this.orbit.maxDistance = Math.min(
      Math.max(150, Math.ceil(authoredDistance)),
      this.camera.far - 1,
    );
  }

  private applyContextLimits(): void {
    this.applyManualLimits();
    this.orbit.minDistance = 24;
    this.orbit.maxDistance = 120;
  }

  private applyLocalLimits(): void {
    this.applyManualLimits();
    this.orbit.minDistance = 7;
    this.orbit.maxDistance = 45;
  }

  private applyFreeExploreLimits(): void {
    this.applyManualLimits();
    const currentDistance = this.camera.position.distanceTo(this.orbit.target);
    this.orbit.minDistance = Math.min(this.orbit.minDistance, currentDistance);
    this.orbit.maxDistance = Math.ceil(currentDistance);
  }

  private applyManualLimits(): void {
    this.orbit.enablePan = false;
    this.orbit.minPolarAngle = MIN_POLAR_ANGLE;
    this.orbit.maxPolarAngle = MAX_POLAR_ANGLE;
    this.orbit.minAzimuthAngle = MIN_AZIMUTH_ANGLE;
    this.orbit.maxAzimuthAngle = MAX_AZIMUTH_ANGLE;
  }

  private overviewPose(): CameraPose {
    return this.fitBounds(
      this.overviewBounds(),
      this.camera.aspect < 0.75 ? PORTRAIT_OVERVIEW_DIRECTION : LANDSCAPE_OVERVIEW_DIRECTION,
    );
  }

  private nodePose(node: LayoutNode): CameraPose {
    return this.fitBounds(this.nodeBounds(node), LOCAL_DIRECTION, node.focus.distance);
  }

  private fitBounds(bounds: Box3, direction: Vector3, minimumDistance = 0): CameraPose {
    const pose = fitPerspectiveView({
      bounds,
      direction,
      verticalFovDegrees: this.camera.fov,
      viewport: { width: Math.max(1, this.camera.aspect * 900), height: 900 },
      safeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: 24,
    });
    if (pose.distance >= minimumDistance) return pose;
    pose.distance = minimumDistance;
    pose.position.copy(pose.target).addScaledVector(direction, minimumDistance);
    return pose;
  }

  private overviewBounds(): Box3 {
    const bounds = new Box3();
    for (const node of this.layout.values()) bounds.union(this.nodeBounds(node));
    return bounds.isEmpty()
      ? new Box3(OVERVIEW_TARGET.clone(), OVERVIEW_TARGET.clone())
      : bounds;
  }

  private nodeBounds(node: LayoutNode): Box3 {
    const [width, depth] = node.footprint;
    const [targetX, targetY, targetZ] = node.focus.target;
    return new Box3(
      new Vector3(targetX - width / 2, targetY - 3, targetZ - depth / 2),
      new Vector3(targetX + width / 2, targetY + 3, targetZ + depth / 2),
    );
  }
}

interface CameraTransition {
  startTime: number;
  fromPosition: Vector3;
  fromTarget: Vector3;
  toPosition: Vector3;
  toTarget: Vector3;
}

function cubicInOut(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - ((-2 * value + 2) ** 3) / 2;
}
