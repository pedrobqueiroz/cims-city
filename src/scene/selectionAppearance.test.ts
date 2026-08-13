import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENTITY_BY_ID } from '../data/entities';
import { LAYOUT_BY_ID } from './layout';
import { createEntityBuilding, disposeEntityVisual, type EntityVisual } from './buildings';
import { createMaterialPalette, disposeMaterialPalette, type MaterialPalette } from './materials';
import { createSelectionAppearance } from './selectionAppearance';

const visuals = new Map<string, EntityVisual>();
const palettes: MaterialPalette[] = [];
const appearances: Array<ReturnType<typeof createSelectionAppearance>> = [];
const syntheticResources: Array<THREE.BufferGeometry | THREE.Material> = [];

function createVisual(id: string, palette: MaterialPalette): EntityVisual {
  const entity = ENTITY_BY_ID.get(id);
  const layout = LAYOUT_BY_ID.get(id);
  if (!entity || !layout) throw new Error(`Missing fixture: ${id}`);
  const visual = createEntityBuilding(entity, layout, palette);
  visuals.set(id, visual);
  return visual;
}

function createFixture(tier: 'desktop' | 'mobile' | 'reduced' = 'desktop') {
  const palette = createMaterialPalette();
  palettes.push(palette);
  const fixtureVisuals = new Map([
    ['elastocalorics', createVisual('elastocalorics', palette)],
    ['cims-hub', createVisual('cims-hub', palette)],
  ]);
  const appearance = createSelectionAppearance(fixtureVisuals, palette, tier);
  appearances.push(appearance);
  return { appearance, palette, fixtureVisuals };
}

function selectedCue(visual: EntityVisual): THREE.Object3D | undefined {
  return visual.visible.children.find((child) =>
    child.name === 'selection-edges' || child.name === 'selection-marker',
  );
}

function createSyntheticVisual(): EntityVisual {
  const root = new THREE.Group();
  const visible = new THREE.Group();
  const material = new THREE.MeshBasicMaterial();
  const ordinary = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, 1);
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  hidden.visible = false;
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  proxy.visible = false;
  visible.add(ordinary, instanced, hidden);
  root.add(visible, proxy);
  syntheticResources.push(
    material, ordinary.geometry, instanced.geometry, hidden.geometry, proxy.geometry,
  );
  return {
    root,
    visible,
    proxy,
    labelAnchor: new THREE.Object3D(),
    focusAnchor: new THREE.Object3D(),
  };
}

afterEach(() => {
  for (const appearance of appearances.splice(0)) appearance.dispose();
  for (const visual of visuals.values()) disposeEntityVisual(visual);
  visuals.clear();
  for (const palette of palettes.splice(0)) disposeMaterialPalette(palette);
  for (const resource of syntheticResources.splice(0)) resource.dispose();
  vi.restoreAllMocks();
});

describe('selection appearance', () => {
  it('marks exactly the selected root and provides desktop edge cues for its visible meshes', () => {
    const { appearance, palette, fixtureVisuals } = createFixture();
    const selected = fixtureVisuals.get('elastocalorics')!;
    const unselected = fixtureVisuals.get('cims-hub')!;

    appearance.select('elastocalorics');

    expect(appearance.selectedId).toBe('elastocalorics');
    expect(selected.root.userData.selected).toBe(true);
    expect(unselected.root.userData.selected).toBe(false);
    const edges = selectedCue(selected);
    expect(edges).toBeInstanceOf(THREE.Group);
    expect(edges?.name).toBe('selection-edges');
    const lineSegments: THREE.LineSegments[] = [];
    edges?.traverse((child) => { if (child instanceof THREE.LineSegments) lineSegments.push(child); });
    const visibleMeshes: THREE.Mesh[] = [];
    selected.visible.traverse((child) => {
      if (child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh)) visibleMeshes.push(child);
    });
    expect(lineSegments).toHaveLength(visibleMeshes.length);
    for (const line of lineSegments) {
      expect(line.geometry).toBeInstanceOf(THREE.EdgesGeometry);
      expect(line.material).toBeInstanceOf(THREE.LineBasicMaterial);
      const material = line.material as THREE.LineBasicMaterial;
      expect(material).not.toBe(palette.selectionEdge);
      expect(material.color.getHex()).toBe(palette.selectionEdge.color.getHex());
    }
  });

  it.each(['mobile', 'reduced'] as const)('uses a structural marker on %s quality', (tier) => {
    const { appearance, palette, fixtureVisuals } = createFixture(tier);
    const visual = fixtureVisuals.get('elastocalorics')!;

    appearance.select('elastocalorics');

    const marker = selectedCue(visual);
    expect(marker).toBeInstanceOf(THREE.Mesh);
    expect(marker?.name).toBe('selection-marker');
    if (!(marker instanceof THREE.Mesh)) return;
    expect(marker.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    expect((marker.geometry as THREE.CylinderGeometry).parameters).toMatchObject({
      radiusTop: 6, radiusBottom: 6, height: 0.08, radialSegments: 48,
    });
    expect(marker.position.y).toBe(0.05);
    expect(marker.material).toBe(palette.selectionEdge);
  });

  it('expands desktop edges only for visible ordinary meshes and never attaches a cue to the proxy', () => {
    const palette = createMaterialPalette();
    palettes.push(palette);
    const visual = createSyntheticVisual();
    const appearance = createSelectionAppearance(new Map([['synthetic', visual]]), palette, 'desktop');
    appearances.push(appearance);

    appearance.select('synthetic');

    const edges = selectedCue(visual);
    expect(edges).toBeInstanceOf(THREE.Group);
    expect(edges?.children).toHaveLength(1);
    expect(edges?.children[0]).toBeInstanceOf(THREE.LineSegments);
    expect(visual.proxy.children).toHaveLength(0);
    expect(visual.proxy.getObjectByName('selection-edges')).toBeUndefined();
  });

  it('replaces and disposes temporary desktop cues when changing quality', () => {
    const { appearance, fixtureVisuals } = createFixture();
    const visual = fixtureVisuals.get('elastocalorics')!;
    appearance.select('elastocalorics');
    const edges = selectedCue(visual) as THREE.Group;
    const disposable = edges.children.flatMap((child) => child instanceof THREE.LineSegments
      ? [vi.spyOn(child.geometry, 'dispose'), vi.spyOn(child.material as THREE.Material, 'dispose')]
      : []);

    appearance.setQuality('mobile');

    expect(selectedCue(visual)?.name).toBe('selection-marker');
    for (const dispose of disposable) expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('clears selected flags and removes temporary cues', () => {
    const { appearance, fixtureVisuals } = createFixture();
    const selected = fixtureVisuals.get('elastocalorics')!;
    appearance.select('elastocalorics');

    appearance.clear();

    expect(appearance.selectedId).toBeNull();
    expect(selected.root.userData.selected).toBe(false);
    expect(selectedCue(selected)).toBeUndefined();
  });

  it('rejects unknown ids without changing its current selection', () => {
    const { appearance, fixtureVisuals } = createFixture();
    appearance.select('elastocalorics');

    expect(() => appearance.select('not-an-entity')).toThrow(TypeError);
    expect(appearance.selectedId).toBe('elastocalorics');
    expect(fixtureVisuals.get('elastocalorics')!.root.userData.selected).toBe(true);
  });

  it('reuses the existing temporary cue for a repeated selection', () => {
    const { appearance, fixtureVisuals } = createFixture();
    const visual = fixtureVisuals.get('elastocalorics')!;
    appearance.select('elastocalorics');
    const first = selectedCue(visual) as THREE.Group;
    const dispose = vi.spyOn((first.children[0] as THREE.LineSegments).geometry, 'dispose');

    appearance.select('elastocalorics');

    expect(dispose).not.toHaveBeenCalled();
    expect(selectedCue(visual)).toBe(first);
    expect(visual.visible.children.filter((child) => child.name === 'selection-edges')).toHaveLength(1);
  });

  it('does not dispose palette materials and disables later actions after idempotent disposal', () => {
    const { appearance, palette, fixtureVisuals } = createFixture();
    const visual = fixtureVisuals.get('elastocalorics')!;
    const paletteDispose = vi.spyOn(palette.selectionEdge, 'dispose');
    appearance.select('elastocalorics');

    appearance.dispose();
    appearance.dispose();
    appearance.select('cims-hub');
    appearance.setQuality('mobile');
    appearance.clear();

    expect(paletteDispose).not.toHaveBeenCalled();
    expect(appearance.selectedId).toBeNull();
    expect(visual.root.userData.selected).toBe(false);
    expect(selectedCue(visual)).toBeUndefined();
  });

  it('avoids prohibited post-processing and shader techniques', async () => {
    const source = await import('./selectionAppearance?raw');
    expect(source.default).not.toMatch(/EffectComposer|(?:Unreal)?Bloom|SSAO|Bokeh|ShaderMaterial|requestAnimationFrame/);
  });
});
