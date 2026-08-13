import * as THREE from 'three';
import type { EntityVisual } from './buildings';
import type { MaterialPalette } from './materials';

export type SelectionQualityTier = 'desktop' | 'mobile' | 'reduced';

export interface SelectionAppearance {
  readonly selectedId: string | null;
  select(id: string): void;
  clear(): void;
  setQuality(tier: SelectionQualityTier): void;
  dispose(): void;
}

interface TemporaryCue {
  root: THREE.Object3D;
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
}

export function createSelectionAppearance(
  visuals: ReadonlyMap<string, EntityVisual>,
  palette: MaterialPalette,
  initialTier: SelectionQualityTier,
): SelectionAppearance {
  let selectedId: string | null = null;
  let quality = initialTier;
  let cue: TemporaryCue | undefined;
  let disposed = false;

  function removeCue(): void {
    if (!cue) return;
    cue.root.removeFromParent();
    for (const geometry of cue.geometries) geometry.dispose();
    for (const material of cue.materials) material.dispose();
    cue = undefined;
  }

  function clearSelection(): void {
    removeCue();
    for (const visual of visuals.values()) visual.root.userData.selected = false;
    selectedId = null;
  }

  function addDesktopEdges(visual: EntityVisual): TemporaryCue {
    const root = new THREE.Group();
    root.name = 'selection-edges';
    const material = new THREE.LineBasicMaterial({ color: palette.selectionEdge.color.clone() });
    const geometries = new Set<THREE.BufferGeometry>();
    const meshes: THREE.Mesh[] = [];
    visual.visible.traverse((child) => {
      if (child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh) && child.visible) meshes.push(child);
    });
    visual.visible.add(root);
    visual.visible.updateMatrixWorld(true);
    root.updateMatrixWorld(true);
    const inverseRootMatrix = root.matrixWorld.clone().invert();
    for (const mesh of meshes) {
      const geometry = new THREE.EdgesGeometry(mesh.geometry);
      geometries.add(geometry);
      const edge = new THREE.LineSegments(geometry, material);
      edge.matrix.copy(inverseRootMatrix).multiply(mesh.matrixWorld);
      edge.matrix.decompose(edge.position, edge.quaternion, edge.scale);
      root.add(edge);
    }
    return { root, geometries, materials: new Set([material]) };
  }

  function addMarker(visual: EntityVisual): TemporaryCue {
    const geometry = new THREE.CylinderGeometry(6, 6, 0.08, 48);
    const marker = new THREE.Mesh(geometry, palette.selectionEdge);
    marker.name = 'selection-marker';
    marker.position.y = 0.05;
    visual.visible.add(marker);
    return { root: marker, geometries: new Set([geometry]), materials: new Set() };
  }

  function createCue(visual: EntityVisual): TemporaryCue {
    return quality === 'desktop' ? addDesktopEdges(visual) : addMarker(visual);
  }

  return {
    get selectedId(): string | null {
      return selectedId;
    },
    select(id: string): void {
      if (disposed) return;
      const visual = visuals.get(id);
      if (!visual) throw new TypeError(`Unknown selection id: ${id}`);
      if (selectedId === id && cue) return;
      clearSelection();
      selectedId = id;
      visual.root.userData.selected = true;
      cue = createCue(visual);
    },
    clear(): void {
      if (disposed) return;
      clearSelection();
    },
    setQuality(tier: SelectionQualityTier): void {
      if (disposed) return;
      quality = tier;
      if (selectedId) {
        const id = selectedId;
        clearSelection();
        this.select(id);
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearSelection();
    },
  };
}
