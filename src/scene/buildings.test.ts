import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENTITY_BY_ID } from '../data/entities';
import type { NeighborhoodEntity } from '../data/schema';
import { scopeBounds } from './atlasLayout';
import { LAYOUT_BY_ID, type LayoutNode } from './layout';
import { createMaterialPalette, disposeMaterialPalette, type MaterialPalette } from './materials';
import { createEntityBuilding, disposeEntityVisual, type EntityVisual } from './buildings';

const groupMotifs: ReadonlyArray<readonly [string, string]> = [
  ['elastocalorics', 'thermal'],
  ['electroactive-polymers', 'polymer'],
  ['smart-material-electronics', 'electronics'],
  ['smart-textiles', 'textile'],
  ['shape-memory-alloys', 'sma'],
];

const createdVisuals: EntityVisual[] = [];
const createdPalettes: MaterialPalette[] = [];

function requiredEntity(id: string): NeighborhoodEntity {
  const entity = ENTITY_BY_ID.get(id);
  if (!entity) throw new Error(`Missing test entity: ${id}`);
  return entity;
}

function requiredLayout(id: string): LayoutNode {
  const layout = LAYOUT_BY_ID.get(id);
  if (!layout) throw new Error(`Missing test layout: ${id}`);
  return layout;
}

function build(id: string, palette = createMaterialPalette()): EntityVisual {
  if (!createdPalettes.includes(palette)) createdPalettes.push(palette);
  const visual = createEntityBuilding(requiredEntity(id), requiredLayout(id), palette);
  createdVisuals.push(visual);
  return visual;
}

function worldBox(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root);
}

function meshMaterial(mesh: THREE.Mesh): THREE.Material {
  if (Array.isArray(mesh.material)) throw new Error('Expected one material');
  return mesh.material;
}

afterEach(() => {
  for (const visual of createdVisuals.splice(0)) disposeEntityVisual(visual);
  for (const palette of createdPalettes.splice(0)) disposeMaterialPalette(palette);
  vi.restoreAllMocks();
});

describe('procedural entity buildings', () => {
  it.each(groupMotifs)('builds the semantic object contract and local anchors for %s', (id) => {
    const layout = requiredLayout(id);
    const visual = build(id);

    expect(visual.root.name).toBe(`entity:${id}`);
    expect(visual.visible.name).toBe(`visible:${id}`);
    expect(visual.proxy.name).toBe(`proxy:${id}`);
    expect(visual.labelAnchor.name).toBe(`label:${id}`);
    expect(visual.focusAnchor.name).toBe(`focus:${id}`);
    expect(visual.root.children).toEqual(expect.arrayContaining([
      visual.visible,
      visual.proxy,
      visual.labelAnchor,
      visual.focusAnchor,
    ]));
    expect(visual.root.position.toArray()).toEqual([...layout.position]);

    visual.root.updateMatrixWorld(true);
    expect(visual.focusAnchor.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([...layout.focus.target]);
    expect(visual.focusAnchor.position.toArray()).toEqual([
      layout.focus.target[0] - layout.position[0],
      layout.focus.target[1] - layout.position[1],
      layout.focus.target[2] - layout.position[2],
    ]);
    expect(visual.labelAnchor.position.x).toBe(0);
    expect(visual.labelAnchor.position.z).toBe(0);
    expect(visual.labelAnchor.getWorldPosition(new THREE.Vector3()).x).toBe(layout.position[0]);
    expect(visual.labelAnchor.getWorldPosition(new THREE.Vector3()).z).toBe(layout.position[2]);
  });

  it('creates multi-building districts for all research groups', () => {
    for (const [id] of groupMotifs) {
      const visual = build(id);
      expect(visual.visible.userData).toMatchObject({ visualFamily: 'research-group' });
      const buildings = visual.visible.children.filter(c => c.name.startsWith('district:') || c.name.startsWith('building:'));
      expect(buildings.length).toBeGreaterThan(0);
    }
  });

  it('keeps every research district within reasonable bounds', () => {
    for (const [id] of groupMotifs) {
      const size = worldBox(build(id).visible).getSize(new THREE.Vector3());
      expect(size.x, id).toBeGreaterThan(5);
      expect(size.z, id).toBeGreaterThan(5);
    }
  });

  it('creates the civic hub as a multi-building district', () => {
    const hub = build('cims-hub');
    expect(hub.visible.userData).toMatchObject({ visualFamily: 'civic-atrium' });
    expect(hub.visible.children.length).toBeGreaterThan(0);
  });

  it('creates HyCATT as a multi-building district', () => {
    const hycatt = build('hycatt');
    expect(hycatt.visible.userData).toMatchObject({ visualFamily: 'hycatt-campus' });
    expect(hycatt.visible.children.length).toBeGreaterThan(0);
  });

  it('creates New ZeMA as a multi-building district', () => {
    const zema = build('new-zema');
    expect(zema.visible.userData).toMatchObject({ visualFamily: 'new-zema-campus' });
    expect(zema.visible.children.length).toBeGreaterThan(0);
  });

  it('creates UdS as a multi-building district', () => {
    const uds = build('uds');
    expect(uds.visible.userData).toMatchObject({ visualFamily: 'academic-pair' });
    expect(uds.visible.children.length).toBeGreaterThan(0);
  });

  it('creates htw saar as a multi-building district', () => {
    const htw = build('htw-saar');
    expect(htw.visible.userData).toMatchObject({ visualFamily: 'workshop-tower-pair' });
    expect(htw.visible.children.length).toBeGreaterThan(0);
  });

  it('creates SEi land with flowing terrain and district clearings', () => {
    const palette = createMaterialPalette();
    const land = build('sei', palette);
    const surface = land.visible.getObjectByName('land:sei:surface') as THREE.Mesh;
    const clearings = land.visible.children.filter((child) => child.name.startsWith('clearing:')) as THREE.Mesh[];

    expect(land.root.name).toBe('land:sei');
    expect(land.visible.userData).toMatchObject({ visualFamily: 'institutional-land' });
    expect(surface.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    expect(surface.material).toBe(palette.ground);
    expect(clearings).toHaveLength(5);
    expect(land.labelAnchor.name).toBe('label:sei');
    expect(land.focusAnchor.name).toBe('focus:sei');
  });

  it('aligns the SEi selection proxy with the authored land bounds in world space', () => {
    const land = build('sei');
    land.root.updateMatrixWorld(true);
    const proxyBounds = new THREE.Box3().setFromObject(land.proxy);
    const landBounds = scopeBounds('sei');

    expect(proxyBounds.min.x).toBeCloseTo(landBounds.min.x, 0);
    expect(proxyBounds.min.z).toBeCloseTo(landBounds.min.z, 0);
    expect(proxyBounds.max.x).toBeCloseTo(landBounds.max.x, 0);
    expect(proxyBounds.max.z).toBeCloseTo(landBounds.max.z, 0);
  });

  it('allocates a basic proxy centered on the visual bounds for non-land entities', () => {
    const proxyIds = ['elastocalorics', 'hycatt', 'uds'];
    for (const id of proxyIds) {
      const visual = build(id);
      const proxyBounds = worldBox(visual.proxy);
      const visualBounds = worldBox(visual.visible);

      expect(proxyBounds.isEmpty()).toBe(false);
      expect(visual.proxy.userData).toMatchObject({ entityId: id });
      expect(visual.proxy.geometry).toBeInstanceOf(THREE.BoxGeometry);
      expect(visualBounds.containsPoint(proxyBounds.getCenter(new THREE.Vector3()))).toBe(true);
    }
  });

  it('disposes every owned geometry and proxy material once without disposing palette materials', () => {
    const palette = createMaterialPalette();
    const visual = build('elastocalorics', palette);
    const geometries = new Set<THREE.BufferGeometry>();
    visual.root.traverse((child) => {
      if (child instanceof THREE.Mesh) geometries.add(child.geometry);
    });
    const geometrySpies = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const proxyMaterialDispose = vi.spyOn(meshMaterial(visual.proxy), 'dispose');
    const paletteDisposes = Object.values(palette).map((material) => vi.spyOn(material, 'dispose'));

    disposeEntityVisual(visual);
    disposeEntityVisual(visual);

    for (const dispose of geometrySpies) expect(dispose).toHaveBeenCalledTimes(1);
    expect(proxyMaterialDispose).toHaveBeenCalledTimes(1);
    for (const dispose of paletteDisposes) expect(dispose).not.toHaveBeenCalled();
  });

  it('disposes a visual\'s owned geometries in reverse collection order', () => {
    const visual = build('cims-hub');
    // Find any mesh in the visible group
    let firstMesh: THREE.Mesh | undefined;
    visual.visible.traverse((child) => {
      if (child instanceof THREE.Mesh && !firstMesh) firstMesh = child;
    });
    expect(firstMesh).toBeDefined();
    const visibleDispose = vi.spyOn(firstMesh!.geometry, 'dispose');
    const proxyDispose = vi.spyOn(visual.proxy.geometry, 'dispose');

    disposeEntityVisual(visual);

    expect(proxyDispose.mock.invocationCallOrder[0]).toBeLessThan(visibleDispose.mock.invocationCallOrder[0]!);
  });
});
