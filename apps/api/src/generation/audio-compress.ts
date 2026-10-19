import { spawn } from 'child_process';

import { ffmpegPath } from './ffmpeg-path';

/**
 * Converts narration WAV to a small MP3 for mobile listening (~5x smaller at 64 kbps mono).
 * Returns the original buffer if conversion fails, so narration is never lost.
 */
export async function wavToMp3(wav: Buffer, bitrateKbps = 64): Promise<Buffer> {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', `${bitrateKbps}k`, '-f', 'mp3', 'pipe:1']);
    const chunks: Buffer[] = [];
    proc.stdout.on('data', (c: Buffer) => chunks.push(c));
    proc.on('error', () => resolve(wav));
    proc.on('close', (code) => {
      const mp3 = Buffer.concat(chunks);
      resolve(code === 0 && mp3.length > 0 ? mp3 : wav);
    });
    proc.stdin.on('error', () => undefined);
    proc.stdin.end(wav);
  });
}
