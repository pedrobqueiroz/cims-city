import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMaterialPalette, disposeMaterialPalette } from './materials';
import { createGroundDetail, disposeGroundDetail } from './groundDetail';

const groups: THREE.Group[] = [];

afterEach(() => {
  for (const group of groups.splice(0)) disposeGroundDetail(group);
});

describe('ground detail', () => {
  it('creates sidewalks, curbs, and planted areas', () => {
    const palette = createMaterialPalette();
    const detail = createGroundDetail(palette);
    groups.push(detail);

    const names = detail.children.map(c => c.name);
    expect(names.some(n => n.startsWith('sidewalk'))).toBe(true);
    expect(names.some(n => n.startsWith('curb'))).toBe(true);
    expect(names.some(n => n.startsWith('planted'))).toBe(true);

    disposeMaterialPalette(palette);
  });

  it('creates benches and lampposts', () => {
    const palette = createMaterialPalette();
    const detail = createGroundDetail(palette);
    groups.push(detail);

    const benches = detail.children.filter(c => c.name.startsWith('bench'));
    const lampposts = detail.children.filter(c => c.name.startsWith('lamppost'));
    expect(benches.length).toBeGreaterThan(0);
    expect(lampposts.length).toBeGreaterThan(0);

    disposeMaterialPalette(palette);
  });

  it('creates sidewalks that receive shadows', () => {
    const palette = createMaterialPalette();
    const detail = createGroundDetail(palette);
    groups.push(detail);

    const sidewalks = detail.children.filter(c => c.name.startsWith('sidewalk'));
    for (const sidewalk of sidewalks) {
      if (sidewalk instanceof THREE.Mesh) {
        expect(sidewalk.receiveShadow).toBe(true);
      }
    }

    disposeMaterialPalette(palette);
  });

  it('disposes geometry on disposal', () => {
    const palette = createMaterialPalette();
    const detail = createGroundDetail(palette);
    const geometries: THREE.BufferGeometry[] = [];
    detail.traverse((child) => {
      if (child instanceof THREE.Mesh) geometries.push(child.geometry);
    });
    const spies = geometries.map(g => vi.spyOn(g, 'dispose'));

    disposeGroundDetail(detail);

    for (const spy of spies) expect(spy).toHaveBeenCalled();
    disposeMaterialPalette(palette);
  });
});
