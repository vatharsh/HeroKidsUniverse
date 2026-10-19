export const NARRATION_PROVIDER = 'NARRATION_PROVIDER';

export interface NarrationInput {
  text: string;
  voice?: string;
  speed?: number;
  language?: string;
  accent?: string;
  tone?: string;
  audience?: string;
  /** Provider model id, e.g. gemini-3.8-flash-tts (from settings). */
  model?: string;
}

export interface NarrationOutput {
  audioUrl: string;
  audioBuffer?: Buffer;
  /** Length of the audio when known (Gemini bills per second of audio). */
  durationSeconds?: number;
}

export interface NarrationProvider {
  generateNarration(input: NarrationInput): Promise<NarrationOutput>;
}
