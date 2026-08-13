import { describe, expect, it } from 'vitest';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { LAYOUT_BY_ID, type LayoutNode } from '../scene/layout';
import { CameraController, type OrbitAdapter } from './cameraController';

const DEG = Math.PI / 180;
const LOCAL_DIRECTION = new Vector3(0.72, 0.55, 0.92).normalize();

const layout: ReadonlyMap<string, LayoutNode> = new Map([
  ['alpha', {
    entityId: 'alpha',
    position: [10, 0, -8],
    footprint: [10, 7],
    focus: { target: [10, 3, -8], distance: 15 },
  }],
  ['beta', {
    entityId: 'beta',
    position: [-12, 0, 9],
    footprint: [10, 7],
    focus: { target: [-12, 4, 9], distance: 18 },
  }],
]);

interface Harness {
  camera: PerspectiveCamera;
  orbit: OrbitAdapter;
  renders: { count: number };
  continuous: Array<readonly [string, boolean]>;
  setNow(value: number): void;
  controller: CameraController;
}

interface ClampingHarness extends Harness {
  updates: { count: number };
}

function createHarness(reducedMotion = false, aspect = 1): Harness {
  const camera = new PerspectiveCamera(45, aspect, 0.1, 260);
  const orbit: OrbitAdapter = {
    target: new Vector3(99, 99, 99),
    enabled: false,
    enablePan: true,
    minDistance: 0,
    maxDistance: 0,
    minPolarAngle: 0,
    maxPolarAngle: Math.PI,
    minAzimuthAngle: Number.NEGATIVE_INFINITY,
    maxAzimuthAngle: Number.POSITIVE_INFINITY,
    update() {},
  };
  const renders = { count: 0 };
  const continuous: Array<readonly [string, boolean]> = [];
  let currentTime = 0;
  const controller = new CameraController({
    camera,
    orbit,
    layout,
    requestRender: () => { renders.count += 1; },
    setContinuous: (reason, active) => { continuous.push([reason, active]); },
    reducedMotion,
    now: () => currentTime,
  });
  return {
    camera,
    orbit,
    renders,
    continuous,
    setNow(value) { currentTime = value; },
    controller,
  };
}

function createClampingHarness(
  reducedMotion = false,
  controllerLayout: ReadonlyMap<string, LayoutNode> = layout,
): ClampingHarness {
  const camera = new PerspectiveCamera(45, 1, 0.1, 260);
  const updates = { count: 0 };
  const orbit: OrbitAdapter = {
    target: new Vector3(99, 99, 99),
    enabled: false,
    enablePan: true,
    minDistance: 0,
    maxDistance: Number.POSITIVE_INFINITY,
    minPolarAngle: 0,
    maxPolarAngle: Math.PI,
    minAzimuthAngle: Number.NEGATIVE_INFINITY,
    maxAzimuthAngle: Number.POSITIVE_INFINITY,
    update() {
      updates.count += 1;
      const offset = camera.position.clone().sub(orbit.target);
      const distance = offset.length();
      const clampedDistance = Math.min(orbit.maxDistance, Math.max(orbit.minDistance, distance));
      if (distance > 0 && clampedDistance !== distance) {
        camera.position.copy(orbit.target).addScaledVector(offset, clampedDistance / distance);
      }
    },
  };
  const renders = { count: 0 };
  const continuous: Array<readonly [string, boolean]> = [];
  let currentTime = 0;
  const controller = new CameraController({
    camera,
    orbit,
    layout: controllerLayout,
    requestRender: () => { renders.count += 1; },
    setContinuous: (reason, active) => { continuous.push([reason, active]); },
    reducedMotion,
    now: () => currentTime,
  });
  return {
    camera,
    orbit,
    renders,
    continuous,
    updates,
    setNow(value) { currentTime = value; },
    controller,
  };
}

function expectVector(actual: Vector3, expected: readonly [number, number, number], precision = 8): void {
  expect(actual.x).toBeCloseTo(expected[0], precision);
  expect(actual.y).toBeCloseTo(expected[1], precision);
  expect(actual.z).toBeCloseTo(expected[2], precision);
}

function localPosition(target: readonly [number, number, number], distance: number): Vector3 {
  return new Vector3(...target).addScaledVector(LOCAL_DIRECTION, distance);
}

describe('CameraController', () => {
  it('starts with a bounds-fitted overview and overview orbit limits', () => {
    const { camera, orbit, controller } = createHarness();

    expect(controller.state).toEqual({ mode: 'overview' });
    expect(controller.isTransitioning).toBe(false);
    expectVector(orbit.target, [-1, 3.5, 0.5]);
    expect(camera.position.distanceTo(orbit.target)).toBeGreaterThan(0);
    expectVector(camera.up, [0, 1, 0]);
    expect(orbit.enabled).toBe(true);
    expect(orbit.minDistance).toBe(24);
    expect(orbit.maxDistance).toBeGreaterThanOrEqual(camera.position.distanceTo(orbit.target));
    expect(orbit.minPolarAngle).toBeCloseTo(35 * DEG, 10);
    expect(orbit.maxPolarAngle).toBeCloseTo(72 * DEG, 10);
  });

  it('bounds manual exploration without panning', () => {
    const { orbit } = createHarness();

    expect(orbit.enablePan).toBe(false);
    expect(orbit.minAzimuthAngle).toBe(-Math.PI / 2);
    expect(orbit.maxAzimuthAngle).toBe(Math.PI / 2);
    expect(orbit.minPolarAngle).toBeCloseTo(35 * DEG, 10);
    expect(orbit.maxPolarAngle).toBeCloseTo(72 * DEG, 10);
  });

  it('authors a complete portrait overview and reevaluates aspect on the next Overview action', () => {
    const portrait = createHarness(false, 0.5);
    const landscape = createHarness();
    expectVector(portrait.orbit.target, [-1, 3.5, 0.5]);
    expect(portrait.camera.position.distanceTo(portrait.orbit.target)).toBeGreaterThan(
      landscape.camera.position.distanceTo(landscape.orbit.target),
    );
    expect(portrait.orbit.maxDistance).toBeGreaterThanOrEqual(
      portrait.camera.position.distanceTo(portrait.orbit.target),
    );
    expect(portrait.orbit.maxDistance).toBeLessThan(portrait.camera.far);

    const resized = createHarness(true, 1);
    resized.controller.focusEntity('alpha');
    resized.camera.aspect = 0.5;
    resized.controller.showOverview();
    expectVector(resized.orbit.target, [-1, 3.5, 0.5]);
    expect(resized.orbit.maxDistance).toBeGreaterThanOrEqual(
      resized.camera.position.distanceTo(resized.orbit.target),
    );
    expect(resized.orbit.maxDistance).toBeLessThan(resized.camera.far);
  });

  it('finishes a bounds-fitted focus move at the entity focus and local limits', () => {
    const { camera, orbit, controller } = createHarness();

    controller.focusEntity('alpha', 100);
    expect(controller.state).toEqual({ mode: 'local', entityId: 'alpha' });
    expect(controller.isTransitioning).toBe(true);
    expect(orbit.enabled).toBe(false);

    controller.update(1500);

    expect(controller.isTransitioning).toBe(false);
    expectVector(orbit.target, [10, 3, -8]);
    expect(camera.position.distanceTo(orbit.target)).toBeGreaterThanOrEqual(15);
    expect(camera.position.distanceTo(orbit.target)).toBeLessThanOrEqual(22);
    expect(orbit.enabled).toBe(true);
    expect(orbit.minDistance).toBe(7);
    expect(orbit.maxDistance).toBe(22);
  });

  it('finishes guided focus travel in 400ms', () => {
    const { camera, orbit, controller } = createHarness();

    controller.focusEntity('alpha', 0);
    controller.update(400);

    expect(controller.isTransitioning).toBe(false);
    expectVector(orbit.target, [10, 3, -8]);
    expect(camera.position.distanceTo(orbit.target)).toBeGreaterThanOrEqual(15);
    expect(camera.position.distanceTo(orbit.target)).toBeLessThanOrEqual(22);
  });

  it('refits the current target into an asymmetric safe rectangle', () => {
    const { camera, orbit, controller } = createHarness();

    controller.refitCurrentTarget(
      new Box3(new Vector3(-10, 0, -6), new Vector3(10, 8, 6)),
      { width: 1440, height: 900 },
      { top: 72, right: 360, bottom: 48, left: 96 },
    );

    expect(controller.isTransitioning).toBe(false);
    expect(orbit.enabled).toBe(true);
    expect(orbit.target.x).toBeGreaterThan(0);
    expect(camera.position.distanceTo(orbit.target)).toBeGreaterThan(0);
    expect(orbit.maxDistance).toBeGreaterThanOrEqual(camera.position.distanceTo(orbit.target));
  });

  it('keeps a safe-rectangle refit unclamped when it interrupts overview-to-local travel', () => {
    const { camera, controller, orbit, setNow } = createClampingHarness();
    controller.focusEntity('alpha', 0);
    setNow(100);
    controller.update(100);

    controller.refitCurrentTarget(
      new Box3(new Vector3(-60, 0, -30), new Vector3(60, 8, 30)),
      { width: 1440, height: 900 },
      { top: 72, right: 360, bottom: 48, left: 96 },
    );

    expect(controller.isTransitioning).toBe(false);
    expect(camera.position.distanceTo(orbit.target)).toBeGreaterThan(22);
    expect(orbit.maxDistance).toBeGreaterThanOrEqual(camera.position.distanceTo(orbit.target));
  });

  it('finishes an SEi focus move at its authored context distance and limits', () => {
    const { camera, orbit, controller, updates } = createClampingHarness(false, LAYOUT_BY_ID);
    const constructorUpdates = updates.count;
    const seiFocus = LAYOUT_BY_ID.get('sei')!.focus;

    controller.focusEntity('sei', 0);
    controller.update(1400);

    expect(controller.state).toEqual({ mode: 'context', entityId: 'sei' });
    expect(controller.isTransitioning).toBe(false);
    expectVector(orbit.target, seiFocus.target);
    expectVector(camera.position, localPosition(seiFocus.target, 58).toArray());
    expect(camera.position.distanceTo(orbit.target)).toBeCloseTo(58, 10);
    expect(orbit.minDistance).toBe(24);
    expect(orbit.maxDistance).toBe(100);
    expect(updates.count).toBe(constructorUpdates + 1);
  });

  it('uses cubic-in-out interpolation at an intermediate timestamp', () => {
    const { orbit, controller } = createHarness();

    controller.focusEntity('alpha', 0);
    const initialTarget = orbit.target.clone();
    controller.update(100);

    // At one quarter of the duration, cubic-in-out progress is exactly 1/16.
    expectVector(orbit.target, initialTarget.lerp(new Vector3(10, 3, -8), 1 / 16).toArray(), 8);
    expect(controller.isTransitioning).toBe(true);
  });

  it('defers clamping controls until guided moves reach their exact destinations', () => {
    const { camera, orbit, controller, updates } = createClampingHarness();
    const constructorUpdates = updates.count;

    controller.focusEntity('alpha', 0);
    controller.update(100);

    expect(updates.count).toBe(constructorUpdates);
    expect(controller.isTransitioning).toBe(true);
    expect(orbit.maxDistance).toBe(100);

    controller.update(400);
    expect(updates.count).toBe(constructorUpdates + 1);
    expect(camera.position.distanceTo(orbit.target)).toBeGreaterThanOrEqual(15);
    expect(orbit.maxDistance).toBe(22);

    controller.showOverview(500);
    controller.update(900);
    expect(updates.count).toBe(constructorUpdates + 2);
    expectVector(orbit.target, [-1, 3.5, 0.5]);
    expect(orbit.maxDistance).toBeGreaterThanOrEqual(camera.position.distanceTo(orbit.target));
  });

  it('retargets from the current interpolated pose and ends at the newest focus', () => {
    const { camera, orbit, controller, continuous } = createHarness();

    controller.focusEntity('alpha', 0);
    controller.update(100);
    const retargetPosition = camera.position.clone();
    const retargetTarget = orbit.target.clone();

    controller.focusEntity('beta', 100);
    expect(camera.position.toArray()).toEqual(retargetPosition.toArray());
    expect(orbit.target.toArray()).toEqual(retargetTarget.toArray());

    controller.update(300);
    expectVector(orbit.target, retargetTarget.clone().lerp(new Vector3(-12, 4, 9), 0.5).toArray());

    controller.update(500);
    expect(controller.state).toEqual({ mode: 'local', entityId: 'beta' });
    expect(controller.isTransitioning).toBe(false);
    expectVector(orbit.target, [-12, 4, 9]);
    expect(camera.position.distanceTo(orbit.target)).toBeGreaterThanOrEqual(18);
    expect(continuous).toEqual([['camera', true], ['camera', false]]);
  });

  it('retargets at the 400ms end time without clamping or cycling continuous rendering', () => {
    const { camera, orbit, controller, continuous, updates } = createClampingHarness();
    const constructorUpdates = updates.count;
    controller.focusEntity('alpha', 0);
    controller.showOverview(400);
    const alphaPosition = camera.position.clone();

    expectVector(camera.position, alphaPosition.toArray());
    expectVector(orbit.target, [10, 3, -8]);
    expect(updates.count).toBe(constructorUpdates);
    expect(continuous).toEqual([['camera', true]]);
    expect(controller.isTransitioning).toBe(true);

    controller.update(600);
    expect(controller.isTransitioning).toBe(true);
    controller.update(800);
    expectVector(orbit.target, [-1, 3.5, 0.5]);
    expect(continuous).toEqual([['camera', true], ['camera', false]]);
  });

  it('resolves focus and overview synchronously with reduced motion', () => {
    const { camera, orbit, controller, continuous } = createHarness(true);

    controller.focusEntity('beta', 0);
    expect(controller.isTransitioning).toBe(false);
    expect(controller.state).toEqual({ mode: 'local', entityId: 'beta' });
    expect(camera.position.distanceTo(orbit.target)).toBeGreaterThanOrEqual(18);
    expectVector(orbit.target, [-12, 4, 9]);

    controller.showOverview(20);
    expect(controller.state).toEqual({ mode: 'overview' });
    expectVector(orbit.target, [-1, 3.5, 0.5]);
    expect(continuous).toEqual([]);
  });

  it('resolves reduced-motion SEi focus synchronously in context mode', () => {
    const { camera, orbit, controller, continuous, updates } = createClampingHarness(true, LAYOUT_BY_ID);
    const constructorUpdates = updates.count;
    const seiFocus = LAYOUT_BY_ID.get('sei')!.focus;

    controller.focusEntity('sei', 500);

    expect(controller.state).toEqual({ mode: 'context', entityId: 'sei' });
    expect(controller.isTransitioning).toBe(false);
    expectVector(orbit.target, seiFocus.target);
    expectVector(camera.position, localPosition(seiFocus.target, 58).toArray());
    expect(camera.position.distanceTo(orbit.target)).toBeCloseTo(58, 10);
    expect(orbit.minDistance).toBe(24);
    expect(orbit.maxDistance).toBe(100);
    expect(updates.count).toBe(constructorUpdates + 1);
    expect(continuous).toEqual([]);
  });

  it('throws for an unknown entity without changing state, pose, or scheduling', () => {
    const { camera, orbit, controller, continuous, renders } = createHarness();
    const beforePosition = camera.position.clone();
    const beforeTarget = orbit.target.clone();
    const beforeState = controller.state;
    const beforeRenders = renders.count;

    expect(() => controller.focusEntity('missing', 500)).toThrowError('Unknown camera focus entity: missing');
    expect(controller.state).toBe(beforeState);
    expect(controller.isTransitioning).toBe(false);
    expect(camera.position.toArray()).toEqual(beforePosition.toArray());
    expect(orbit.target.toArray()).toEqual(beforeTarget.toArray());
    expect(continuous).toEqual([]);
    expect(renders.count).toBe(beforeRenders);
  });

  it('interrupts at the current time and leaves manual orbit enabled on that pose', () => {
    const { camera, orbit, controller, continuous, setNow, updates } = createClampingHarness();
    const constructorUpdates = updates.count;
    controller.focusEntity('alpha', 0);
    setNow(100);

    controller.interrupt();
    const settledPosition = camera.position.clone();
    const settledTarget = orbit.target.clone();

    expect(settledPosition.distanceTo(settledTarget)).toBeGreaterThan(22);
    expect(controller.isTransitioning).toBe(false);
    expect(orbit.enabled).toBe(true);
    expect(updates.count).toBe(constructorUpdates);
    expect(orbit.minDistance).toBeLessThanOrEqual(camera.position.distanceTo(orbit.target));
    expect(orbit.maxDistance).toBeGreaterThanOrEqual(camera.position.distanceTo(orbit.target));
    expect(continuous).toEqual([['camera', true], ['camera', false]]);
    controller.update(400);
    expect(camera.position.toArray()).toEqual(settledPosition.toArray());
    expect(orbit.target.toArray()).toEqual(settledTarget.toArray());
  });

  it('keeps the first manual orbit update continuous after interrupted travel', () => {
    const { controller, camera, orbit, setNow } = createClampingHarness();
    controller.focusEntity('alpha', 0);
    setNow(280);
    controller.update(280);
    const before = camera.position.clone();

    controller.interrupt();
    orbit.update();

    expect(camera.position.distanceTo(before)).toBeLessThan(0.001);
    expect(orbit.maxDistance).toBeGreaterThanOrEqual(camera.position.distanceTo(orbit.target));
  });

  it('disposes idempotently, settles an active move, and prevents later operations', () => {
    const { camera, orbit, controller, continuous, renders, setNow } = createHarness();
    controller.focusEntity('alpha', 0);
    setNow(100);
    controller.dispose();
    const settledPosition = camera.position.clone();
    const settledTarget = orbit.target.clone();
    const settledState = controller.state;
    const renderCount = renders.count;

    controller.dispose();
    controller.focusEntity('beta', 800);
    controller.showOverview(800);
    controller.update(400);
    controller.interrupt();

    expect(controller.isTransitioning).toBe(false);
    expect(orbit.enabled).toBe(true);
    expect(camera.position.toArray()).toEqual(settledPosition.toArray());
    expect(orbit.target.toArray()).toEqual(settledTarget.toArray());
    expect(controller.state).toBe(settledState);
    expect(continuous).toEqual([['camera', true], ['camera', false]]);
    expect(renders.count).toBe(renderCount);
  });

  it('owns continuous rendering only while a transition is active', () => {
    const { orbit, controller, continuous, renders } = createHarness();
    const initialRenders = renders.count;

    controller.focusEntity('alpha', 50);
    expect(continuous).toEqual([['camera', true]]);
    expect(orbit.enabled).toBe(false);
    expect(renders.count).toBeGreaterThan(initialRenders);

    controller.update(249);
    expect(continuous).toEqual([['camera', true]]);
    controller.update(450);
    expect(continuous).toEqual([['camera', true], ['camera', false]]);
    expect(orbit.enabled).toBe(true);
  });

  it('keeps a level world-up horizon and restores mode-specific clamps', () => {
    const { camera, orbit, controller } = createHarness(true);
    camera.up.set(1, 0, 0);

    controller.focusEntity('alpha');
    const cameraRight = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    expectVector(camera.up, [0, 1, 0]);
    expect(cameraRight.y).toBeCloseTo(0, 10);
    expect(orbit.minDistance).toBe(7);
    expect(orbit.maxDistance).toBe(22);
    expect(orbit.minPolarAngle).toBeCloseTo(35 * DEG, 10);
    expect(orbit.maxPolarAngle).toBeCloseTo(72 * DEG, 10);

    controller.showOverview();
    expect(orbit.minDistance).toBe(24);
    expect(orbit.maxDistance).toBe(100);
    expect(orbit.minPolarAngle).toBeCloseTo(35 * DEG, 10);
    expect(orbit.maxPolarAngle).toBeCloseTo(72 * DEG, 10);
  });
});
