import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { resolveEntityVisual } from './assetResolver';

describe('entity visual resolution', () => {
  it('returns a fresh procedural group synchronously when no replacement is supplied', async () => {
    const proceduralGroup = new THREE.Group();
    const procedural = vi.fn(() => proceduralGroup);
    const resolutionPromise = resolveEntityVisual({ entityId: 'finance', procedural });

    expect(procedural).toHaveBeenCalledTimes(1);
    const resolution = await resolutionPromise;

    expect(resolution).toEqual({ object: proceduralGroup, source: 'procedural' });
    expect(resolution.object.name).toBe('procedural:finance');
    expect(procedural).toHaveBeenCalledTimes(1);
  });

  it('uses a successful replacement without constructing the procedural fallback', async () => {
    const replacementGroup = new THREE.Group();
    const procedural = vi.fn(() => new THREE.Group());
    const replacement = vi.fn(async () => replacementGroup);

    const resolution = await resolveEntityVisual({ entityId: 'research', procedural, replacement });

    expect(resolution).toEqual({ object: replacementGroup, source: 'replacement' });
    expect(replacementGroup.name).toBe('replacement:research');
    expect(replacement).toHaveBeenCalledTimes(1);
    expect(procedural).not.toHaveBeenCalled();
  });

  it('falls back after a rejected replacement with its Error message in the warning', async () => {
    const proceduralGroup = new THREE.Group();
    const procedural = vi.fn(() => proceduralGroup);
    const replacement = vi.fn(async () => Promise.reject(new Error('network unavailable')));

    const resolution = await resolveEntityVisual({ entityId: 'design', procedural, replacement });

    expect(resolution).toEqual({
      object: proceduralGroup,
      source: 'procedural',
      warning: 'Visual replacement unavailable for design: network unavailable',
    });
    expect(proceduralGroup.name).toBe('procedural:design');
    expect(replacement).toHaveBeenCalledTimes(1);
    expect(procedural).toHaveBeenCalledTimes(1);
  });

  it('uses a string rejection as the fallback warning reason', async () => {
    const proceduralGroup = new THREE.Group();

    const resolution = await resolveEntityVisual({
      entityId: 'operations',
      procedural: () => proceduralGroup,
      replacement: async () => Promise.reject('offline'),
    });

    expect(resolution.warning).toBe('Visual replacement unavailable for operations: offline');
  });

  it('falls back when replacement resolves to a non-Object3D value', async () => {
    const proceduralGroup = new THREE.Group();

    const resolution = await resolveEntityVisual({
      entityId: 'people',
      procedural: () => proceduralGroup,
      replacement: async () => ({}) as unknown as THREE.Object3D,
    });

    expect(resolution).toEqual({
      object: proceduralGroup,
      source: 'procedural',
      warning: 'Visual replacement unavailable for people: replacement did not return an Object3D',
    });
  });

  it('throws when the procedural factory returns a non-Object3D fallback', async () => {
    await expect(resolveEntityVisual({
      entityId: 'strategy',
      procedural: () => ({}) as unknown as THREE.Object3D,
    })).rejects.toThrow(TypeError);
  });

  it('rejects blank entity IDs before either factory is called', async () => {
    const procedural = vi.fn(() => new THREE.Group());
    const replacement = vi.fn(async () => new THREE.Group());

    await expect(resolveEntityVisual({ entityId: '  ', procedural, replacement })).rejects.toThrow(TypeError);

    expect(procedural).not.toHaveBeenCalled();
    expect(replacement).not.toHaveBeenCalled();
  });

  it('preserves names already assigned by either source', async () => {
    const replacementGroup = new THREE.Group();
    replacementGroup.name = 'authored:replacement';
    const replacementResolution = await resolveEntityVisual({
      entityId: 'legal',
      procedural: () => new THREE.Group(),
      replacement: async () => replacementGroup,
    });
    const proceduralGroup = new THREE.Group();
    proceduralGroup.name = 'authored:procedural';
    const fallbackResolution = await resolveEntityVisual({
      entityId: 'legal',
      procedural: () => proceduralGroup,
      replacement: async () => Promise.reject('unavailable'),
    });

    expect(replacementResolution.object.name).toBe('authored:replacement');
    expect(fallbackResolution.object.name).toBe('authored:procedural');
  });
});
