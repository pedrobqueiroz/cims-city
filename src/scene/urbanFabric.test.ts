import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMaterialPalette, disposeMaterialPalette } from './materials';
import { createUrbanFabric, disposeUrbanFabric } from './urbanFabric';

const groups: THREE.Group[] = [];

afterEach(() => {
  for (const group of groups.splice(0)) disposeUrbanFabric(group);
});

describe('urban fabric', () => {
  it('creates context buildings and streets', () => {
    const palette = createMaterialPalette();
    const fabric = createUrbanFabric(palette, 1);
    groups.push(fabric);

    const buildings = fabric.children.filter(c => c.name.startsWith('context-building'));
    const streets = fabric.children.filter(c => c.name.startsWith('street'));
    expect(buildings.length).toBeGreaterThan(0);
    expect(streets.length).toBeGreaterThan(0);

    disposeMaterialPalette(palette);
  });

  it('creates buildings with shadow casting enabled', () => {
    const palette = createMaterialPalette();
    const fabric = createUrbanFabric(palette, 1);
    groups.push(fabric);

    fabric.traverse((child) => {
      if (child instanceof THREE.Mesh && !child.name.startsWith('street')) {
        expect(child.castShadow).toBe(true);
      }
    });

    disposeMaterialPalette(palette);
  });

  it('creates fewer buildings at lower density', () => {
    const palette = createMaterialPalette();
    const full = createUrbanFabric(palette, 1);
    const half = createUrbanFabric(palette, 0.5);
    groups.push(full, half);

    const fullBuildings = full.children.filter(c => c.name.startsWith('context-building'));
    const halfBuildings = half.children.filter(c => c.name.startsWith('context-building'));
    expect(halfBuildings.length).toBeLessThanOrEqual(fullBuildings.length);

    disposeMaterialPalette(palette);
  });

  it('returns empty group at zero density', () => {
    const palette = createMaterialPalette();
    const fabric = createUrbanFabric(palette, 0);
    groups.push(fabric);

    expect(fabric.children.length).toBe(0);

    disposeMaterialPalette(palette);
  });

  it('disposes geometry on disposal', () => {
    const palette = createMaterialPalette();
    const fabric = createUrbanFabric(palette, 1);
    const geometries: THREE.BufferGeometry[] = [];
    fabric.traverse((child) => {
      if (child instanceof THREE.Mesh) geometries.push(child.geometry);
    });
    const spies = geometries.map(g => vi.spyOn(g, 'dispose'));

    disposeUrbanFabric(fabric);

    for (const spy of spies) expect(spy).toHaveBeenCalled();
    disposeMaterialPalette(palette);
  });
});
