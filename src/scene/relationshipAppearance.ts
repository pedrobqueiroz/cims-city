import * as THREE from 'three';

export interface RelationView {
  mode: 'none' | 'incident';
  entityId?: string;
  previewId?: string | null;
}

export interface RelationshipAppearance {
  apply(view: RelationView): void;
  dispose(): void;
}

type Emphasis = 'normal' | 'active' | 'preview' | 'receded';
type Renderable = THREE.Mesh | THREE.Line | THREE.Points;

interface MaterialState {
  original: THREE.Material;
  variants: Readonly<Record<Exclude<Emphasis, 'normal'>, THREE.Material>>;
}

function isRenderable(object: THREE.Object3D): object is Renderable {
  return object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points;
}

function materialsOf(object: Renderable): readonly THREE.Material[] {
  return Array.isArray(object.material) ? object.material : [object.material];
}

function assignMaterials(object: Renderable, materials: readonly THREE.Material[]): void {
  object.material = Array.isArray(object.material) ? [...materials] : materials[0]!;
}

function opacityFor(emphasis: Exclude<Emphasis, 'normal'>, opacity: number): number {
  if (emphasis === 'active') return opacity;
  if (emphasis === 'preview') return opacity * 0.72;
  return opacity * 0.28;
}

function createVariant(material: THREE.Material, emphasis: Exclude<Emphasis, 'normal'>): THREE.Material {
  const variant = material.clone();
  if ('opacity' in variant) variant.opacity = opacityFor(emphasis, variant.opacity);
  if ('transparent' in variant && 'opacity' in variant) variant.transparent = variant.transparent || variant.opacity < 1;
  return variant;
}

export function createRelationshipAppearance(
  routes: readonly THREE.Group[],
  visuals: ReadonlyMap<string, THREE.Object3D>,
): RelationshipAppearance {
  const states = new Map<THREE.Material, MaterialState>();
  const stateByMaterial = new Map<THREE.Material, MaterialState>();
  let disposed = false;

  function stateFor(material: THREE.Material): MaterialState {
    const existing = stateByMaterial.get(material);
    if (existing) return existing;
    const state: MaterialState = {
      original: material,
      variants: {
        active: createVariant(material, 'active'),
        preview: createVariant(material, 'preview'),
        receded: createVariant(material, 'receded'),
      },
    };
    states.set(material, state);
    stateByMaterial.set(material, state);
    for (const variant of Object.values(state.variants)) stateByMaterial.set(variant, state);
    return state;
  }

  function cacheObjectMaterials(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!isRenderable(object)) return;
      for (const material of materialsOf(object)) stateFor(material);
    });
  }

  function applyObject(root: THREE.Object3D, emphasis: Emphasis): void {
    root.traverse((object) => {
      if (!isRenderable(object)) return;
      assignMaterials(object, materialsOf(object).map((material) => {
        const state = stateFor(material);
        return emphasis === 'normal' ? state.original : state.variants[emphasis];
      }));
    });
  }

  function routeEmphasis(route: THREE.Group, view: RelationView): Emphasis {
    if (view.mode !== 'incident' || !view.entityId) return 'normal';
    const sourceId = route.userData.sourceId as string | undefined;
    const targetId = route.userData.targetId as string | undefined;
    if (sourceId === view.entityId || targetId === view.entityId) return 'active';
    if (view.previewId && (sourceId === view.previewId || targetId === view.previewId)) return 'preview';
    return 'receded';
  }

  for (const route of routes) cacheObjectMaterials(route);
  for (const visual of visuals.values()) cacheObjectMaterials(visual);

  return {
    apply(view: RelationView): void {
      if (disposed) return;
      const incident = new Set<string>();
      for (const route of routes) {
        const emphasis = routeEmphasis(route, view);
        route.userData.emphasis = emphasis;
        if (emphasis === 'active') {
          incident.add(route.userData.sourceId as string);
          incident.add(route.userData.targetId as string);
        }
        applyObject(route, emphasis);
      }
      for (const [id, visual] of visuals) {
        const emphasis: Emphasis = view.mode === 'incident' && id !== view.entityId && !incident.has(id)
          ? 'receded'
          : 'normal';
        visual.userData.emphasis = emphasis;
        applyObject(visual, emphasis);
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const route of routes) {
        applyObject(route, 'normal');
        route.userData.emphasis = 'normal';
      }
      for (const visual of visuals.values()) {
        applyObject(visual, 'normal');
        visual.userData.emphasis = 'normal';
      }
      for (const state of states.values()) {
        for (const variant of Object.values(state.variants)) variant.dispose();
      }
      states.clear();
      stateByMaterial.clear();
    },
  };
}
