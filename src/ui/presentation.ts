import { selectBreadcrumbIds, type NeighborhoodState } from '../application/state';
import type {
  AtlasScopeId,
  EntityCategory,
  EntityPresentation,
  NeighborhoodEntity,
  RelationshipKind,
} from '../data/schema';

export const CATEGORY_LABELS: Readonly<Record<EntityCategory, string>> = {
  umbrella: 'Institutional Umbrella',
  hub: 'CiMS Hub',
  'research-group': 'Research Groups',
  'adjacent-lab': 'Adjacent Labs',
  'sei-pillar': 'SEi Pillars',
  'external-partner': 'External Partners',
};

export const SHORT_LABELS: Readonly<Record<string, string>> = {
  sei: 'SEi',
  'cims-hub': 'CiMS',
  hycatt: 'HyCATT',
  'new-zema': 'New ZeMA',
  uds: 'UdS',
  'htw-saar': 'htw saar',
};

export const BREADCRUMB_NAMES: Readonly<Record<string, string>> = {
  sei: 'SEi',
  'cims-hub': 'CiMS',
};

export const ROUTE_LEGEND_COPY: readonly { kind: RelationshipKind; label: string }[] = [
  { kind: 'contains', label: 'Institutional Containment' },
  { kind: 'coordinates', label: 'Scientific Coordination' },
  { kind: 'adjacent', label: 'Spatial Adjacency' },
  { kind: 'collaborates', label: 'Research Collaboration' },
];

const RELATIONSHIP_LABELS: Readonly<Record<RelationshipKind, string>> = {
  contains: 'Contains',
  coordinates: 'Coordinates',
  adjacent: 'Adjacent to',
  collaborates: 'Collaborates with',
};

const INVERSE_RELATIONSHIP_LABELS: Readonly<Record<RelationshipKind, string>> = {
  contains: 'Contained by',
  coordinates: 'Coordinated by',
  adjacent: 'Adjacent to',
  collaborates: 'Collaborates with',
};

const CATEGORY_ORDER: readonly EntityCategory[] = [
  'umbrella', 'hub', 'research-group', 'adjacent-lab', 'sei-pillar', 'external-partner',
];

export interface BreadcrumbItem { id: string; label: string; current: boolean }
export interface NavigationItem {
  id: string;
  label: string;
  fullName: string;
  selected: boolean;
  scopeAction: AtlasScopeId | null;
}
export interface NavigationCategory { id: EntityCategory; label: string; items: readonly NavigationItem[] }
export interface RelationshipItem {
  id: string;
  kind: RelationshipKind;
  sourceId: string;
  targetId: string;
  relatedId: string;
  text: string;
  fullText: string;
}
export interface RelationshipGroup {
  kind: RelationshipKind;
  label: string;
  items: readonly RelationshipItem[];
}
export interface SelectedEntityView {
  id: string;
  name: string;
  leader?: string;
  description: string;
  example?: string;
  relationshipGroups: readonly RelationshipGroup[];
}
export interface AtlasViewModel {
  scopeId: AtlasScopeId;
  breadcrumbs: readonly BreadcrumbItem[];
  categories: readonly NavigationCategory[];
  relationships: readonly RelationshipItem[];
  selected: SelectedEntityView | null;
}

function canonicalRelationships(entities: readonly NeighborhoodEntity[]): RelationshipItem[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const symmetric = new Set<string>();
  const result: RelationshipItem[] = [];
  for (const source of entities) {
    for (const [index, relationship] of source.relationships.entries()) {
      const target = byId.get(relationship.targetId);
      if (!target) continue;
      if (relationship.kind === 'adjacent' || relationship.kind === 'collaborates') {
        const pair = [source.id, target.id].sort().join('\u0000');
        const key = `${relationship.kind}\u0000${pair}`;
        if (symmetric.has(key)) continue;
        symmetric.add(key);
      }
      const label = RELATIONSHIP_LABELS[relationship.kind];
      result.push({
        id: `${source.id}:${relationship.kind}:${target.id}:${index}`,
        kind: relationship.kind,
        sourceId: source.id,
        targetId: target.id,
        relatedId: target.id,
        text: `${label} — ${target.name}`,
        fullText: `${source.name} ${label.toLocaleLowerCase()} ${target.name}`,
      });
    }
  }
  return result;
}

function relationshipGroups(
  entityId: string,
  relationships: readonly RelationshipItem[],
  entitiesById: ReadonlyMap<string, NeighborhoodEntity>,
): RelationshipGroup[] {
  return ROUTE_LEGEND_COPY.flatMap(({ kind, label }) => {
    const items = relationships
      .filter((relationship) => relationship.kind === kind
        && (relationship.sourceId === entityId || relationship.targetId === entityId))
      .map((relationship) => {
        const outgoing = relationship.sourceId === entityId;
        const relatedId = outgoing ? relationship.targetId : relationship.sourceId;
        const relatedName = entitiesById.get(relatedId)?.name ?? relatedId;
        return {
          ...relationship,
          relatedId,
          text: `${outgoing ? RELATIONSHIP_LABELS[kind] : INVERSE_RELATIONSHIP_LABELS[kind]} — ${relatedName}`,
        };
      });
    return items.length > 0 ? [{ kind, label, items }] : [];
  });
}

export function createAtlasViewModel(
  state: NeighborhoodState,
  entities: readonly NeighborhoodEntity[],
  presentation: ReadonlyMap<string, EntityPresentation>,
): AtlasViewModel {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const relationships = canonicalRelationships(entities);
  const categories = CATEGORY_ORDER.flatMap((category) => {
    const items = entities
      .filter((entity) => entity.category === category)
      .filter((entity) => {
        if (state.scopeId === 'cims') return presentation.get(entity.id)?.scopeId === 'cims';
        return entity.id === 'sei'
          || entity.id === 'cims-hub'
          || presentation.get(entity.id)?.scopeId === 'sei';
      })
      .map((entity): NavigationItem => ({
        id: entity.id,
        label: SHORT_LABELS[entity.id] ?? entity.abbreviation ?? entity.name,
        fullName: entity.name,
        selected: state.selectedId === entity.id || (!state.selectedId && entity.id === (state.scopeId === 'sei' ? 'sei' : 'cims-hub')),
        scopeAction: entity.id === 'cims-hub' && state.scopeId === 'sei' ? 'cims' : null,
      }));
    return items.length > 0 ? [{ id: category, label: CATEGORY_LABELS[category], items }] : [];
  });
  const breadcrumbIds = selectBreadcrumbIds(state).filter((id) => byId.has(id));
  const breadcrumbs = breadcrumbIds.map((id, index): BreadcrumbItem => ({
    id,
    label: BREADCRUMB_NAMES[id] ?? byId.get(id)?.name ?? id,
    current: index === breadcrumbIds.length - 1,
  }));
  const selectedEntity = state.selectedId ? byId.get(state.selectedId) : undefined;
  return {
    scopeId: state.scopeId,
    breadcrumbs,
    categories,
    relationships,
    selected: selectedEntity ? {
      id: selectedEntity.id,
      name: selectedEntity.name,
      leader: selectedEntity.leader,
      description: selectedEntity.description,
      example: selectedEntity.example,
      relationshipGroups: relationshipGroups(selectedEntity.id, relationships, byId),
    } : null,
  };
}
