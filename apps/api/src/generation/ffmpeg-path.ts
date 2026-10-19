import * as fs from 'fs';

/**
 * The npm ffmpeg-static/ffprobe binaries are fetched by install scripts, which the production image skips
 * (`npm ci --ignore-scripts`) — so prod had no FFmpeg at all. Prefer the npm binary when it exists,
 * otherwise use the system one (installed with `apk add ffmpeg` in the Docker image).
 */
function firstExisting(candidate: string | undefined, fallback: string): string {
  return candidate && fs.existsSync(candidate) ? candidate : fallback;
}

export function ffmpegPath(): string {
  let bundled: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    bundled = require('ffmpeg-static') as string;
  } catch {
    bundled = undefined;
  }
  return firstExisting(bundled, 'ffmpeg');
}

export function ffprobePath(): string {
  let bundled: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    bundled = (require('@ffprobe-installer/ffprobe') as { path: string }).path;
  } catch {
    bundled = undefined;
  }
  return firstExisting(bundled, 'ffprobe');
}
