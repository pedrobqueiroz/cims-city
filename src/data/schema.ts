export type EntityCategory = 'umbrella' | 'hub' | 'research-group'
  | 'adjacent-lab' | 'sei-pillar' | 'external-partner';

export type RelationshipKind = 'contains' | 'coordinates' | 'adjacent' | 'collaborates';

export type Motif = 'thermal' | 'polymer' | 'electronics' | 'textile' | 'sma' | 'soft-robotics';

export type AtlasScopeId = 'sei' | 'cims';

export type VisualRole = 'land' | 'city' | 'neighborhood' | 'satellite';

export interface EntityPresentation {
  slug: string;
  scopeId: AtlasScopeId;
  visualRole: VisualRole;
  shortLabel?: string;
}

export interface Relationship {
  targetId: string;
  kind: RelationshipKind;
}

export interface NeighborhoodEntity {
  id: string;
  category: EntityCategory;
  name: string;
  abbreviation?: string;
  leader?: string;
  description: string;
  example?: string;
  relationships: Relationship[];
  motif?: Motif;
  detailLevel: 'primary' | 'secondary' | 'context';
  visualWeight: 1 | 0.6 | 0.35;
}
