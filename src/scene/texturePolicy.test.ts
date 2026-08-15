import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { estimateTextureBytes, TextureRegistry } from './texturePolicy';

describe('texture policy', () => {
  it('includes the complete mip chain in the exact estimated byte count', () => {
    expect(estimateTextureBytes(2048, 2048, 4, true)).toBe(22_369_622);
  });

  it('rejects malformed measurements and fails fast for invalid estimates', () => {
    const registry = new TextureRegistry('desktop');
    const invalidDescriptors = [
      { width: 0, height: 1, bytesPerPixel: 4 },
      { width: 1.5, height: 1, bytesPerPixel: 4 },
      { width: 1, height: Number.POSITIVE_INFINITY, bytesPerPixel: 4 },
      { width: 1, height: 1, bytesPerPixel: 0 },
      { width: 1, height: 1, bytesPerPixel: 2.5 },
    ];

    for (const descriptor of invalidDescriptors) expect(registry.canRegister(descriptor)).toBe(false);
    expect(() => estimateTextureBytes(1, 1, 0, false)).toThrow(RangeError);
  });

  it('rejects textures whose width or height exceeds the shared edge limit', () => {
    const registry = new TextureRegistry('desktop');

    expect(registry.canRegister({ width: 2049, height: 1, bytesPerPixel: 4 })).toBe(false);
    expect(registry.canRegister({ width: 1, height: 2049, bytesPerPixel: 4 })).toBe(false);
  });

  it('enforces the 48 MiB aggregate budget on mobile registrations', () => {
    const registry = new TextureRegistry('mobile');
    const descriptor = { width: 2048, height: 2048, bytesPerPixel: 4, mipmapped: false };

    expect(registry.register(new THREE.Texture(), descriptor, 'color')).toBe(true);
    expect(registry.register(new THREE.Texture(), descriptor, 'color')).toBe(true);
    expect(registry.register(new THREE.Texture(), descriptor, 'color')).toBe(true);
    expect(registry.activeBytes).toBe(50_331_648);
    expect(registry.register(new THREE.Texture(), descriptor, 'color')).toBe(false);
  });

  it('does not impose a cumulative cap on desktop registrations', () => {
    const registry = new TextureRegistry('desktop');
    const descriptor = { width: 2048, height: 2048, bytesPerPixel: 4, mipmapped: false };

    for (let index = 0; index < 4; index += 1) {
      expect(registry.register(new THREE.Texture(), descriptor, 'data')).toBe(true);
    }
    expect(registry.activeBytes).toBe(67_108_864);
  });

  it('applies color-space, mipmap, and bounded anisotropy settings by texture role', () => {
    const registry = new TextureRegistry('desktop', 12);
    const color = new THREE.Texture();
    const data = new THREE.Texture();

    expect(registry.register(color, { width: 32, height: 64, bytesPerPixel: 4, mipmapped: true }, 'color')).toBe(true);
    expect(registry.register(data, { width: 32, height: 64, bytesPerPixel: 1, mipmapped: false }, 'data')).toBe(true);
    expect(color.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(color.generateMipmaps).toBe(true);
    expect(color.anisotropy).toBe(8);
    expect(data.colorSpace).toBe(THREE.NoColorSpace);
    expect(data.generateMipmaps).toBe(false);
    expect(data.anisotropy).toBe(8);
  });

  it('treats a duplicate texture identity as already registered without double charging', () => {
    const registry = new TextureRegistry('mobile');
    const texture = new THREE.Texture();
    const descriptor = { width: 8, height: 8, bytesPerPixel: 4, mipmapped: false };

    expect(registry.register(texture, descriptor, 'color')).toBe(true);
    expect(registry.register(texture, descriptor, 'color')).toBe(true);
    expect(registry.activeBytes).toBe(256);
  });

  it('leaves both registry accounting and texture settings unchanged when registration is rejected', () => {
    const registry = new TextureRegistry('mobile');
    const texture = new THREE.Texture();
    texture.colorSpace = THREE.NoColorSpace;
    texture.generateMipmaps = true;
    texture.anisotropy = 3;

    expect(registry.register(texture, { width: 2049, height: 1, bytesPerPixel: 4, mipmapped: false }, 'color')).toBe(false);
    expect(registry.activeBytes).toBe(0);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(texture.generateMipmaps).toBe(true);
    expect(texture.anisotropy).toBe(3);
  });

  it('disposes each accepted texture once and makes repeated registry disposal a no-op', () => {
    const registry = new TextureRegistry('desktop');
    const first = new THREE.Texture();
    const second = new THREE.Texture();
    const firstDispose = vi.spyOn(first, 'dispose');
    const secondDispose = vi.spyOn(second, 'dispose');

    registry.register(first, { width: 1, height: 1, bytesPerPixel: 4 }, 'color');
    registry.register(second, { width: 1, height: 1, bytesPerPixel: 4 }, 'data');
    registry.dispose();
    registry.dispose();

    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(secondDispose).toHaveBeenCalledTimes(1);
  });
});
