import * as THREE from 'three';

export type TextureQualityTier = 'desktop' | 'mobile';

export interface TextureDescriptor {
  width: number;
  height: number;
  bytesPerPixel: number;
  mipmapped?: boolean;
}

export const MAX_TEXTURE_EDGE = 2048;
export const MOBILE_TEXTURE_BUDGET = 48 * 1024 * 1024;

export function estimateTextureBytes(
  width: number,
  height: number,
  bytesPerPixel: number,
  mipmapped: boolean,
): number {
  if (!isPositiveInteger(width) || !isPositiveInteger(height) || !isPositiveInteger(bytesPerPixel)) {
    throw new RangeError('Texture dimensions and bytes per pixel must be positive finite integers.');
  }

  return Math.ceil(width * height * bytesPerPixel * (mipmapped ? 4 / 3 : 1));
}

function isPositiveInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

export class TextureRegistry {
  private readonly textures = new Set<THREE.Texture>();
  private bytes = 0;
  private disposed = false;
  private readonly anisotropy: number;

  constructor(
    private readonly tier: TextureQualityTier,
    maxAnisotropy = 1,
  ) {
    this.anisotropy = Number.isFinite(maxAnisotropy)
      ? Math.max(1, Math.min(maxAnisotropy, 8))
      : 1;
  }

  get activeBytes(): number {
    return this.bytes;
  }

  canRegister(descriptor: TextureDescriptor): boolean {
    if (
      !isPositiveInteger(descriptor.width)
      || !isPositiveInteger(descriptor.height)
      || !isPositiveInteger(descriptor.bytesPerPixel)
      || descriptor.width > MAX_TEXTURE_EDGE
      || descriptor.height > MAX_TEXTURE_EDGE
    ) {
      return false;
    }

    const bytes = estimateTextureBytes(
      descriptor.width,
      descriptor.height,
      descriptor.bytesPerPixel,
      descriptor.mipmapped ?? false,
    );
    return this.tier === 'desktop' || this.bytes + bytes <= MOBILE_TEXTURE_BUDGET;
  }

  register(texture: THREE.Texture, descriptor: TextureDescriptor, role: 'color' | 'data'): boolean {
    if (this.disposed) return false;
    if (this.textures.has(texture)) return true;
    if (!this.canRegister(descriptor)) return false;

    texture.colorSpace = role === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.generateMipmaps = descriptor.mipmapped ?? false;
    texture.anisotropy = this.anisotropy;
    this.textures.add(texture);
    this.bytes += estimateTextureBytes(
      descriptor.width,
      descriptor.height,
      descriptor.bytesPerPixel,
      descriptor.mipmapped ?? false,
    );
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const texture of this.textures) texture.dispose();
    this.textures.clear();
    this.bytes = 0;
  }
}
