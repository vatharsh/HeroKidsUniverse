export const IMAGE_GENERATION_PROVIDER = 'IMAGE_GENERATION_PROVIDER';

export interface ImageGenerationInput {
  sceneDescription: string;
  heroName: string;
  heroAge: number;
  style?: string;
  supportingCharacters?: string[]; // e.g. ["Vedant (sibling)", "Luna (friend)"]
  heroAvatarUrl?: string;          // used as reference image for visual consistency
  characterAvatarUrls?: string[];  // one per supporting character, same order
}

export interface ImageGenerationOutput {
  imageUrl: string;
  imageBase64?: string;
}

export interface AvatarGenerationInput {
  name: string;
  role?: string;
  photoBuffer?: Buffer;
  photoMimeType?: string;
  adjustmentHint?: string;
}

export interface ImageGenerationProvider {
  generateImage(input: ImageGenerationInput): Promise<ImageGenerationOutput>;
  generateAvatar(input: AvatarGenerationInput): Promise<ImageGenerationOutput>;
}
