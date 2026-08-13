import { ENTITIES, ENTITY_PRESENTATION } from '../data/entities';
import { buildContainmentGraph } from '../data/hierarchy';
import type { AtlasScopeId } from '../data/schema';

export type NavigationState = 'overview' | 'guiding' | 'focused' | 'free-explore';
export type WebglStatus = 'loading' | 'ready' | 'failed';

export type RelationshipFilter =
  | { mode: 'none' }
  | { mode: 'incident'; entityId: string };

export interface NeighborhoodState {
  scopeId: AtlasScopeId;
  selectedId: string | null;
  previewId: string | null;
  navigation: NavigationState;
  relations: RelationshipFilter;
  reducedMotion: boolean;
  webgl: WebglStatus;
}

export type NeighborhoodAction =
  | { type: 'ENTER_SCOPE'; scopeId: AtlasScopeId }
  | { type: 'SELECT_ENTITY'; entityId: string }
  | { type: 'PREVIEW_ENTITY'; entityId: string | null }
  | { type: 'GUIDANCE_COMPLETED' }
  | { type: 'INTERRUPT_GUIDANCE' }
  | { type: 'SET_REDUCED_MOTION'; reducedMotion: boolean }
  | { type: 'SET_WEBGL_STATUS'; status: WebglStatus }
  | { type: 'SHOW_OVERVIEW' }
  | { type: 'CLEAR_RELATION_FILTER' }
  | { type: 'SHOW_INCIDENT_RELATIONS'; entityId: string }
  | { type: 'BACK' };

const containment = buildContainmentGraph(ENTITIES);
const rootIdByScope: Readonly<Record<AtlasScopeId, string>> = {
  sei: 'sei',
  cims: 'cims-hub',
};

export function initialNeighborhoodState(): NeighborhoodState {
  return {
    scopeId: 'sei',
    selectedId: null,
    previewId: null,
    navigation: 'overview',
    relations: { mode: 'none' },
    reducedMotion: false,
    webgl: 'loading',
  };
}

export function reduceNeighborhoodState(
  state: NeighborhoodState,
  action: NeighborhoodAction,
): NeighborhoodState {
  switch (action.type) {
    case 'ENTER_SCOPE':
      return {
        ...state,
        scopeId: action.scopeId,
        selectedId: null,
        previewId: null,
        navigation: 'overview',
        relations: { mode: 'none' },
      };
    case 'SELECT_ENTITY':
      return {
        ...state,
        selectedId: action.entityId,
        previewId: null,
        navigation: 'guiding',
        relations: { mode: 'incident', entityId: action.entityId },
      };
    case 'PREVIEW_ENTITY':
      return { ...state, previewId: action.entityId };
    case 'GUIDANCE_COMPLETED':
      return state.navigation === 'guiding' ? { ...state, navigation: 'focused' } : state;
    case 'INTERRUPT_GUIDANCE':
      return state.selectedId ? { ...state, navigation: 'free-explore' } : state;
    case 'SET_REDUCED_MOTION':
      return { ...state, reducedMotion: action.reducedMotion };
    case 'SET_WEBGL_STATUS':
      return { ...state, webgl: action.status };
    case 'SHOW_OVERVIEW':
      return {
        ...state,
        scopeId: 'sei',
        selectedId: null,
        previewId: null,
        navigation: 'overview',
        relations: { mode: 'none' },
      };
    case 'CLEAR_RELATION_FILTER':
      return { ...state, relations: { mode: 'none' } };
    case 'SHOW_INCIDENT_RELATIONS':
      return { ...state, relations: { mode: 'incident', entityId: action.entityId } };
    case 'BACK':
      if (state.selectedId) {
        return {
          ...state,
          selectedId: null,
          previewId: null,
          navigation: 'overview',
          relations: { mode: 'none' },
        };
      }
      if (state.scopeId === 'cims') {
        return {
          ...state,
          scopeId: 'sei',
          previewId: null,
          navigation: 'overview',
          relations: { mode: 'none' },
        };
      }
      return state;
  }
}

export function selectBreadcrumbIds(state: NeighborhoodState): readonly string[] {
  const currentId = state.selectedId ?? rootIdByScope[state.scopeId];
  return [...containment.ancestorsOf(currentId)].reverse().concat(currentId);
}

export function selectVisibleLabelIds(state: NeighborhoodState): readonly string[] {
  return ENTITIES
    .filter((entity) => ENTITY_PRESENTATION.get(entity.id)?.scopeId === state.scopeId)
    .map((entity) => entity.id);
}

export function selectIncidentRelationshipIds(state: NeighborhoodState): readonly string[] {
  if (state.relations.mode !== 'incident') return [];

  const entityId = state.relations.entityId;
  const relatedIds: string[] = [];
  const add = (id: string): void => {
    if (!relatedIds.includes(id)) relatedIds.push(id);
  };

  for (const entity of ENTITIES) {
    if (entity.id === entityId) {
      for (const relationship of entity.relationships) add(relationship.targetId);
    }
    if (entity.relationships.some((relationship) => relationship.targetId === entityId)) {
      add(entity.id);
    }
  }
  return relatedIds;
}
