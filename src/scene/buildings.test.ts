import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENTITY_BY_ID } from '../data/entities';
import type { Motif, NeighborhoodEntity } from '../data/schema';
import { LAYOUT_BY_ID, type LayoutNode } from './layout';
import { createMaterialPalette, disposeMaterialPalette, type MaterialPalette } from './materials';
import { createEntityBuilding, disposeEntityVisual, type EntityVisual } from './buildings';

const groupMotifs: ReadonlyArray<readonly [string, Exclude<Motif, 'soft-robotics'>]> = [
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

function namedGroup(root: THREE.Object3D, name: string): THREE.Group | undefined {
  const object = root.getObjectByName(name);
  return object instanceof THREE.Group ? object : undefined;
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

  it('gives all five groups the same exact 10x7 shell and 4.8 wall envelope', () => {
    const boxes = groupMotifs.map(([id]) => {
      const visual = build(id);
      const shell = namedGroup(visual.visible, `shell:${id}`);

      expect(shell).toBeDefined();
      expect(shell?.userData).toMatchObject({ footprint: '10x7', wallHeight: 4.8 });
      expect(visual.visible.userData).toMatchObject({ footprint: '10x7' });

      if (!shell) return 'missing';
      const size = worldBox(shell).getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(10);
      expect(size.y).toBeCloseTo(4.8);
      expect(size.z).toBeCloseTo(7);
      return size.toArray().map((value) => value.toFixed(5)).join(',');
    });

    expect(new Set(boxes).size).toBe(1);
  });

  it('keeps every research motif inside the common 10x7 horizontal envelope', () => {
    for (const [id] of groupMotifs) {
      const size = worldBox(build(id).visible).getSize(new THREE.Vector3());
      expect(size.x, id).toBeCloseTo(10);
      expect(size.z, id).toBeCloseTo(7);
    }
  });

  it.each(groupMotifs)('adds the named %s research motif without exceeding roof plus 2.2', (id, motif) => {
    const visual = build(id);
    const motifGroup = namedGroup(visual.visible, `motif:${motif}`);

    expect(motifGroup).toBeDefined();
    expect(motifGroup?.userData).toMatchObject({ motif });
    expect(visual.visible.userData).toMatchObject({ motif });
    expect(worldBox(motifGroup!).max.y).toBeLessThanOrEqual(7);
  });

  it('models the thermal motif as exactly six shared-geometry warm/cool fins', () => {
    const visual = build('elastocalorics');
    const motif = namedGroup(visual.visible, 'motif:thermal')!;
    expect(motif).toBeDefined();
    if (!motif) return;
    const fins = motif.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);

    expect(fins).toHaveLength(6);
    expect(new Set(fins.map((fin) => fin.geometry)).size).toBe(1);
    expect(new Set(fins.map((fin) => meshMaterial(fin))).size).toBe(2);
  });

  it('models the polymer motif as three restrained low-segment canopy ribs', () => {
    const visual = build('electroactive-polymers');
    const motif = namedGroup(visual.visible, 'motif:polymer')!;
    expect(motif).toBeDefined();
    if (!motif) return;
    const ribs = motif.children.filter((child): child is THREE.Mesh =>
      child instanceof THREE.Mesh && child.geometry instanceof THREE.TubeGeometry,
    );

    expect(ribs).toHaveLength(3);
    for (const rib of ribs) {
      const parameters = (rib.geometry as THREE.TubeGeometry).parameters;
      expect(parameters.tubularSegments).toBeLessThanOrEqual(12);
      expect(parameters.radialSegments).toBeLessThanOrEqual(4);
    }
  });

  it('models electronics with an instanced facade grid and one rooftop box', () => {
    const visual = build('smart-material-electronics');
    const motif = namedGroup(visual.visible, 'motif:electronics')!;
    expect(motif).toBeDefined();
    if (!motif) return;
    const grid = motif.getObjectByName('electronics:facade-grid');
    const rooftopBoxes = motif.children.filter((child) => child.name === 'electronics:rooftop-box');

    expect(grid).toBeInstanceOf(THREE.InstancedMesh);
    expect((grid as THREE.InstancedMesh).count).toBeGreaterThanOrEqual(9);
    expect(rooftopBoxes).toHaveLength(1);
    expect(rooftopBoxes[0]).toBeInstanceOf(THREE.Mesh);
  });

  it('models textile as two crossed instanced slat arrays', () => {
    const visual = build('smart-textiles');
    const motif = namedGroup(visual.visible, 'motif:textile')!;
    expect(motif).toBeDefined();
    if (!motif) return;
    const arrays = motif.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);

    expect(arrays).toHaveLength(2);
    expect(arrays.map((array) => array.count)).toEqual([5, 5]);
    expect(arrays[0]?.rotation.y).toBeCloseTo(Math.PI / 4);
    expect(arrays[1]?.rotation.y).toBeCloseTo(-Math.PI / 4);
  });

  it('models SMA with a folded roof strip and exactly two low-segment loops', () => {
    const visual = build('shape-memory-alloys');
    const motif = namedGroup(visual.visible, 'motif:sma')!;
    expect(motif).toBeDefined();
    if (!motif) return;
    const foldedRoof = motif.getObjectByName('sma:folded-roof');
    const loops = motif.children.filter((child): child is THREE.Mesh =>
      child instanceof THREE.Mesh && child.geometry instanceof THREE.TorusGeometry,
    );

    expect(foldedRoof).toBeInstanceOf(THREE.Mesh);
    const normals = (foldedRoof as THREE.Mesh).geometry.getAttribute('normal');
    for (let index = 0; index < normals.count; index += 1) {
      expect(normals.getY(index)).toBeGreaterThan(0);
    }
    expect(loops).toHaveLength(2);
    for (const loop of loops) {
      const parameters = (loop.geometry as THREE.TorusGeometry).parameters;
      expect(parameters.radialSegments).toBeLessThanOrEqual(5);
      expect(parameters.tubularSegments).toBeLessThanOrEqual(12);
    }
  });

  it.each(groupMotifs)('provides the prescribed invisible 12x7x9 interaction proxy for %s', (id) => {
    const visual = build(id);
    const geometry = visual.proxy.geometry;

    expect(geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect((geometry as THREE.BoxGeometry).parameters).toMatchObject({ width: 12, height: 7, depth: 9 });
    expect(visual.proxy.position.y).toBe(3.5);
    expect(visual.proxy.visible).toBe(false);
    expect(meshMaterial(visual.proxy).visible).toBe(false);
    expect(visual.proxy.userData).toMatchObject({ entityId: id });
  });

  it('keeps the civic hub lower than the research-group wall envelope', () => {
    const hub = build('cims-hub');

    expect(hub.visible.userData).toMatchObject({ visualFamily: 'civic-atrium' });
    expect(worldBox(hub.visible).max.y).toBeLessThan(4.8);
  });

  it('constructs a restrained curved soft-lab canopy', () => {
    const lab = build('soft-robotics-lab');
    const canopy = namedGroup(lab.visible, 'motif:soft-robotics');
    const canopyRibs: THREE.Mesh[] = [];
    canopy?.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.TubeGeometry) canopyRibs.push(child);
    });

    expect(lab.visible.userData).toMatchObject({ visualFamily: 'soft-lab', motif: 'soft-robotics' });
    expect(canopy).toBeDefined();
    expect(canopyRibs.length).toBeGreaterThan(0);
    expect(worldBox(lab.visible).max.y).toBeLessThanOrEqual(5);
  });

  it('uses one semantic SEi land visual with stable anchors and no peer entity block', () => {
    const palette = createMaterialPalette();
    const land = build('sei', palette);
    const surface = land.visible.getObjectByName('land:sei:surface') as THREE.Mesh;
    const clearings = land.visible.children.filter((child) => child.name.startsWith('clearing:')) as THREE.Mesh[];

    expect(land.root.name).toBe('land:sei');
    expect(land.visible.userData).toMatchObject({ visualFamily: 'institutional-land' });
    expect(surface.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(clearings).toHaveLength(5);
    expect(land.labelAnchor.name).toBe('label:sei');
    expect(land.focusAnchor.name).toBe('focus:sei');
    expect((land.proxy.geometry as THREE.BoxGeometry).parameters).toMatchObject({ width: 113, height: 1, depth: 89 });
  });

  it.each([
    ['hycatt', 41, 31],
    ['new-zema', 38, 27],
    ['uds', 24, 17],
    ['htw-saar', 29, 19],
  ] as const)('derives the %s interaction proxy from its district bounds', (id, width, depth) => {
    const visual = build(id);

    expect(visual.proxy.geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect((visual.proxy.geometry as THREE.BoxGeometry).parameters).toMatchObject({ width, depth });
    expect(visual.proxy.userData).toMatchObject({ entityId: id });
  });

  it('gives every overview partner a distinct lightweight institutional silhouette', () => {
    const hycatt = build('hycatt');
    expect(hycatt.visible.userData).toMatchObject({ visualFamily: 'hycatt-campus' });
    expect(hycatt.visible.getObjectByName('hycatt:mass:0')).toBeInstanceOf(THREE.Mesh);
    expect(hycatt.visible.getObjectByName('hycatt:mass:1')).toBeInstanceOf(THREE.Mesh);
    expect(hycatt.visible.getObjectByName('hycatt:link')).toBeInstanceOf(THREE.Mesh);
    expect(hycatt.visible.getObjectByName('hycatt:landmark')).toBeInstanceOf(THREE.Mesh);

    const zema = build('new-zema');
    expect(zema.visible.userData).toMatchObject({ visualFamily: 'new-zema-campus' });
    expect(zema.visible.getObjectByName('new-zema:volume:0')).toBeInstanceOf(THREE.Mesh);
    expect(zema.visible.getObjectByName('new-zema:volume:1')).toBeInstanceOf(THREE.Mesh);
    expect(zema.visible.getObjectByName('new-zema:volume:2')).toBeInstanceOf(THREE.Mesh);
    expect(zema.visible.getObjectByName('new-zema:folded-roof')).toBeInstanceOf(THREE.Mesh);

    const uds = build('uds');
    expect(uds.visible.userData).toMatchObject({ visualFamily: 'academic-pair' });
    expect(uds.visible.getObjectByName('uds:academic:0')).toBeInstanceOf(THREE.Mesh);
    expect(uds.visible.getObjectByName('uds:academic:1')).toBeInstanceOf(THREE.Mesh);

    const htw = build('htw-saar');
    expect(htw.visible.userData).toMatchObject({ visualFamily: 'workshop-tower-pair' });
    expect(htw.visible.getObjectByName('htw-saar:workshop')).toBeInstanceOf(THREE.Mesh);
    expect(htw.visible.getObjectByName('htw-saar:tower')).toBeInstanceOf(THREE.Mesh);
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
    const firstVisible = visual.visible.getObjectByName('hub:plinth') as THREE.Mesh;
    const visibleDispose = vi.spyOn(firstVisible.geometry, 'dispose');
    const proxyDispose = vi.spyOn(visual.proxy.geometry, 'dispose');

    disposeEntityVisual(visual);

    expect(proxyDispose.mock.invocationCallOrder[0]).toBeLessThan(visibleDispose.mock.invocationCallOrder[0]!);
  });
});
