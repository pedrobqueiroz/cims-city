import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DISTRICT_LAYOUT, scopeBounds, worldPositionFor } from './atlasLayout';
import { GROUP_IDS } from './layout';

function horizontalArea(bounds: THREE.Box3): number {
  const size = bounds.getSize(new THREE.Vector3());
  return size.x * size.z;
}

describe('multi-district atlas layout', () => {
  it('separates five overview regions and nests CiMS entities inside the CiMS extent', () => {
    expect([...DISTRICT_LAYOUT.keys()]).toEqual(['cims', 'new-zema', 'hycatt', 'uds', 'htw-saar']);
    const cims = DISTRICT_LAYOUT.get('cims')!;
    for (const id of ['cims-hub', ...GROUP_IDS]) {
      expect(cims.bounds.containsPoint(worldPositionFor(id)), id).toBe(true);
    }

    const districts = [...DISTRICT_LAYOUT.values()];
    for (let left = 0; left < districts.length; left += 1) {
      for (let right = left + 1; right < districts.length; right += 1) {
        const overlap = districts[left]!.bounds.clone().intersect(districts[right]!.bounds);
        const pair = districts[left]!.id + '/' + districts[right]!.id;
        expect(overlap.isEmpty(), pair).toBe(true);
      }
    }
  });

  it('keeps CiMS at no more than forty percent of overview land area', () => {
    const cimsArea = horizontalArea(DISTRICT_LAYOUT.get('cims')!.bounds);
    const overviewArea = horizontalArea(scopeBounds('sei'));

    expect(cimsArea / overviewArea).toBeLessThanOrEqual(0.4);
  });

  it('gives every overview region a distinct center inside the SEi scope', () => {
    const overview = scopeBounds('sei');
    const centers = [...DISTRICT_LAYOUT.values()].map((district) => district.center);

    expect(new Set(centers.map((center) => center.toArray().join(','))).size).toBe(5);
    for (const center of centers) expect(overview.containsPoint(center)).toBe(true);
  });

  it('returns defensive scope bounds and stable world positions', () => {
    const first = scopeBounds('cims');
    const second = scopeBounds('cims');
    first.min.set(-999, -999, -999);

    expect(second.equals(DISTRICT_LAYOUT.get('cims')!.bounds)).toBe(true);
    expect(worldPositionFor('cims-hub').toArray()).toEqual([-60, 0, -20]);
    expect(() => worldPositionFor('missing')).toThrowError('Missing atlas position: missing');
  });
});
