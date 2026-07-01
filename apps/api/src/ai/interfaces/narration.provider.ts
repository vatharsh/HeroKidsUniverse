export const NARRATION_PROVIDER = 'NARRATION_PROVIDER';

export interface NarrationInput {
  text: string;
  voice?: string;
  speed?: number;
  language?: string;
  accent?: string;
  tone?: string;
  audience?: string;
}

export interface NarrationOutput {
  audioUrl: string;
  audioBuffer?: Buffer;
}

export interface NarrationProvider {
  generateNarration(input: NarrationInput): Promise<NarrationOutput>;
}
