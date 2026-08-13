import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fitPerspectiveView } from './cameraFraming';

const bounds = new THREE.Box3(
  new THREE.Vector3(-10, 0, -6),
  new THREE.Vector3(10, 8, 6),
);
const direction = new THREE.Vector3(1, 0.8, 1).normalize();

describe('fitPerspectiveView', () => {
  it('centers symmetric bounds in an unobstructed viewport', () => {
    const pose = fitPerspectiveView({
      bounds,
      direction,
      verticalFovDegrees: 40,
      viewport: { width: 1440, height: 900 },
      safeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: 0,
    });

    expect(pose.target.toArray()).toEqual([0, 4, 0]);
    expect(pose.screenOffset.length()).toBeLessThan(0.000001);
    expect(pose.distance).toBeGreaterThan(0);
  });

  it('shifts framing into the unobstructed viewport rectangle', () => {
    const pose = fitPerspectiveView({
      bounds,
      direction,
      verticalFovDegrees: 40,
      viewport: { width: 1440, height: 900 },
      safeInsets: { top: 72, right: 360, bottom: 48, left: 96 },
      padding: 24,
    });

    expect(pose.screenOffset.x).toBeLessThan(0);
    expect(pose.distance).toBeGreaterThan(0);
  });

  it('increases framing distance for the same bounds in a portrait viewport', () => {
    const landscape = fitPerspectiveView({
      bounds,
      direction,
      verticalFovDegrees: 40,
      viewport: { width: 1440, height: 900 },
      safeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: 24,
    });
    const portrait = fitPerspectiveView({
      bounds,
      direction,
      verticalFovDegrees: 40,
      viewport: { width: 900, height: 1440 },
      safeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: 24,
    });

    expect(portrait.distance).toBeGreaterThan(landscape.distance);
  });

  it('adds minimum padding to the fitted distance', () => {
    const withoutPadding = fitPerspectiveView({
      bounds,
      direction,
      verticalFovDegrees: 40,
      viewport: { width: 1440, height: 900 },
      safeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: 0,
    });
    const withPadding = fitPerspectiveView({
      bounds,
      direction,
      verticalFovDegrees: 40,
      viewport: { width: 1440, height: 900 },
      safeInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: 24,
    });

    expect(withPadding.distance).toBeGreaterThan(withoutPadding.distance);
  });
});
