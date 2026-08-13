import { describe, expect, it } from 'vitest';
import {
  initialNeighborhoodState,
  reduceNeighborhoodState,
  selectBreadcrumbIds,
  selectIncidentRelationshipIds,
  selectVisibleLabelIds,
} from './state';

describe('neighborhood state', () => {
  it('enters CiMS, selects an entity, and returns one semantic level', () => {
    let state = initialNeighborhoodState();
    state = reduceNeighborhoodState(state, { type: 'ENTER_SCOPE', scopeId: 'cims' });
    state = reduceNeighborhoodState(state, { type: 'SELECT_ENTITY', entityId: 'smart-textiles' });

    expect(state.scopeId).toBe('cims');
    expect(state.selectedId).toBe('smart-textiles');
    expect(state.relations).toEqual({ mode: 'incident', entityId: 'smart-textiles' });

    state = reduceNeighborhoodState(state, { type: 'BACK' });

    expect(state.selectedId).toBeNull();
    expect(state.scopeId).toBe('cims');
  });

  it('previews without changing semantic navigation intent', () => {
    const state = reduceNeighborhoodState(initialNeighborhoodState(), {
      type: 'PREVIEW_ENTITY',
      entityId: 'cims-hub',
    });

    expect(state.previewId).toBe('cims-hub');
    expect(state.selectedId).toBeNull();
    expect(state.navigation).toBe('overview');
  });

  it('moves an entity selection from guiding to focused and then free exploration', () => {
    let state = reduceNeighborhoodState(initialNeighborhoodState(), {
      type: 'SELECT_ENTITY',
      entityId: 'smart-textiles',
    });
    expect(state.navigation).toBe('guiding');

    state = reduceNeighborhoodState(state, { type: 'GUIDANCE_COMPLETED' });
    expect(state.navigation).toBe('focused');

    state = reduceNeighborhoodState(state, { type: 'INTERRUPT_GUIDANCE' });
    expect(state.navigation).toBe('free-explore');
  });

  it('keeps reduced motion separate from graphics quality', () => {
    const state = reduceNeighborhoodState(initialNeighborhoodState(), {
      type: 'SET_REDUCED_MOTION',
      reducedMotion: true,
    });

    expect(state.reducedMotion).toBe(true);
    expect(state).not.toHaveProperty('quality');
  });

  it('tracks loading, ready, and failed WebGL states', () => {
    let state = initialNeighborhoodState();
    expect(state.webgl).toBe('loading');

    state = reduceNeighborhoodState(state, { type: 'SET_WEBGL_STATUS', status: 'ready' });
    expect(state.webgl).toBe('ready');

    state = reduceNeighborhoodState(state, { type: 'SET_WEBGL_STATUS', status: 'failed' });
    expect(state.webgl).toBe('failed');
  });

  it('returns to the SEi overview and clears local state', () => {
    let state = initialNeighborhoodState();
    state = reduceNeighborhoodState(state, { type: 'ENTER_SCOPE', scopeId: 'cims' });
    state = reduceNeighborhoodState(state, { type: 'SELECT_ENTITY', entityId: 'smart-textiles' });
    state = reduceNeighborhoodState(state, { type: 'SHOW_OVERVIEW' });

    expect(state.scopeId).toBe('sei');
    expect(state.selectedId).toBeNull();
    expect(state.previewId).toBeNull();
    expect(state.navigation).toBe('overview');
    expect(state.relations).toEqual({ mode: 'none' });
  });

  it('switches relationship filters without changing the selection', () => {
    let state = reduceNeighborhoodState(initialNeighborhoodState(), {
      type: 'SELECT_ENTITY',
      entityId: 'smart-textiles',
    });
    state = reduceNeighborhoodState(state, { type: 'CLEAR_RELATION_FILTER' });

    expect(state.selectedId).toBe('smart-textiles');
    expect(state.relations).toEqual({ mode: 'none' });

    state = reduceNeighborhoodState(state, {
      type: 'SHOW_INCIDENT_RELATIONS',
      entityId: 'smart-textiles',
    });
    expect(state.relations).toEqual({ mode: 'incident', entityId: 'smart-textiles' });
  });
});

describe('neighborhood state selectors', () => {
  it('derives the hierarchy breadcrumb for the active scope and selected entity', () => {
    let state = initialNeighborhoodState();
    state = reduceNeighborhoodState(state, { type: 'ENTER_SCOPE', scopeId: 'cims' });
    state = reduceNeighborhoodState(state, { type: 'SELECT_ENTITY', entityId: 'smart-textiles' });

    expect(selectBreadcrumbIds(state)).toEqual(['sei', 'cims-hub', 'smart-textiles']);
  });

  it('shows labels belonging to the active CiMS scope', () => {
    const state = reduceNeighborhoodState(initialNeighborhoodState(), {
      type: 'ENTER_SCOPE',
      scopeId: 'cims',
    });

    expect(selectVisibleLabelIds(state)).toEqual([
      'cims-hub',
      'elastocalorics',
      'electroactive-polymers',
      'smart-material-electronics',
      'smart-textiles',
      'shape-memory-alloys',
      'soft-robotics-lab',
    ]);
  });

  it('returns distinct entity ids connected by the selected incident relationship filter', () => {
    const state = reduceNeighborhoodState(initialNeighborhoodState(), {
      type: 'SELECT_ENTITY',
      entityId: 'smart-textiles',
    });

    expect(selectIncidentRelationshipIds(state)).toEqual(['cims-hub']);
  });
});
