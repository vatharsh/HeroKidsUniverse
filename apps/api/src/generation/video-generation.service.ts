import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

import { Story, VideoStatus } from '../stories/story.entity';
import { UploadService } from '../upload/upload.service';

const execFileAsync = promisify(execFile);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const FFMPEG_PATH: string = require('ffmpeg-static') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FFPROBE_PATH: string = (require('@ffprobe-installer/ffprobe') as { path: string }).path;

const DEFAULT_PAGE_DURATION = 6;  // seconds when no audio
const FADE_DURATION          = 0.5; // seconds for image fade in/out
const END_SCREEN_DURATION    = 4;  // seconds

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);

  constructor(
    @InjectRepository(Story) private readonly storiesRepo: Repository<Story>,
    private readonly uploadService: UploadService,
    private readonly config: ConfigService,
  ) {}

  // ── Public entry point ────────────────────────────────────────────────────

  async generateVideo(storyId: string, userId: string): Promise<void> {
    const tmpDir = path.join(os.tmpdir(), `hvu-video-${storyId}-${Date.now()}`);

    try {
      await this.storiesRepo.update({ id: storyId, userId }, { videoStatus: VideoStatus.Generating });

      const story = await this.storiesRepo.findOne({ where: { id: storyId, userId } });
      if (!story) throw new Error('Story not found');

      const pages = [...story.pages].sort((a, b) => a.pageNumber - b.pageNumber);
      if (pages.length === 0) throw new Error('Story has no pages');

      fs.mkdirSync(tmpDir, { recursive: true });
      this.logger.log(`Video generation started for story ${storyId} in ${tmpDir}`);

      // ── Download images ─────────────────────────────────────────────────
      const imageSlots: Array<{ url: string; local: string }> = [];
      if (story.coverImageUrl) {
        const local = path.join(tmpDir, 'cover.jpg');
        await this.downloadFile(story.coverImageUrl, local);
        imageSlots.push({ url: story.coverImageUrl, local });
      }
      for (const pg of pages) {
        if (!pg.imageUrl) throw new Error(`Page ${pg.pageNumber} is missing an image`);
        const local = path.join(tmpDir, `page_${pg.pageNumber}.jpg`);
        await this.downloadFile(pg.imageUrl, local);
        imageSlots.push({ url: pg.imageUrl, local });
      }

      // ── Determine audio durations ────────────────────────────────────────
      const hasPageAudio = pages.some((p) => !!p.audioUrl);
      const durations: number[] = [];

      if (story.coverImageUrl) {
        // Cover gets default duration (no audio)
        durations.push(DEFAULT_PAGE_DURATION);
      }

      if (hasPageAudio) {
        for (const pg of pages) {
          if (pg.audioUrl) {
            const local = path.join(tmpDir, `audio_${pg.pageNumber}.mp3`);
            await this.downloadFile(pg.audioUrl, local);
            const dur = await this.getAudioDuration(local);
            durations.push(dur);
          } else {
            durations.push(DEFAULT_PAGE_DURATION);
          }
        }
      } else {
        // No audio — every page gets default duration
        pages.forEach(() => durations.push(DEFAULT_PAGE_DURATION));
      }

      // ── Generate image video segments ────────────────────────────────────
      const segmentPaths: string[] = [];
      for (let i = 0; i < imageSlots.length; i++) {
        const dur = durations[i] ?? DEFAULT_PAGE_DURATION;
        const seg = path.join(tmpDir, `seg_${i}.mp4`);
        await this.imageToSegment(imageSlots[i].local, dur, seg);
        segmentPaths.push(seg);
      }

      // ── End screen ────────────────────────────────────────────────────────
      const endScreenPath = path.join(tmpDir, 'end.mp4');
      await this.createEndScreen(endScreenPath);
      segmentPaths.push(endScreenPath);

      // ── Concatenate video ─────────────────────────────────────────────────
      const silentVideoPath = path.join(tmpDir, 'video_silent.mp4');
      await this.concatenateSegments(segmentPaths, silentVideoPath, tmpDir);

      // ── Build final audio track ───────────────────────────────────────────
      const finalAudioPath = path.join(tmpDir, 'final_audio.aac');
      await this.buildAudioTrack(durations, pages, story.coverImageUrl, tmpDir, finalAudioPath);

      // ── Combine video + audio ─────────────────────────────────────────────
      const outputPath = path.join(tmpDir, 'output.mp4');
      await this.combineVideoAudio(silentVideoPath, finalAudioPath, outputPath);

      // ── Upload to storage ─────────────────────────────────────────────────
      const videoUrl = await this.uploadService.uploadVideo(userId, storyId, outputPath);
      await this.storiesRepo.update({ id: storyId }, { videoUrl, videoStatus: VideoStatus.Completed });
      this.logger.log(`Video generation completed for story ${storyId}: ${videoUrl}`);
    } catch (err) {
      this.logger.error(`Video generation failed for story ${storyId}`, err);
      await this.storiesRepo.update({ id: storyId }, { videoStatus: VideoStatus.Failed }).catch(() => {});
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // ── FFmpeg helpers ────────────────────────────────────────────────────────

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(FFMPEG_PATH, ['-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited ${code}:\n${stderr.slice(-3000)}`));
      });
      proc.on('error', reject);
    });
  }

  private getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      execFile(
        FFPROBE_PATH,
        ['-v', 'quiet', '-print_format', 'json', '-show_streams', filePath],
        (err, stdout) => {
          if (err) { resolve(DEFAULT_PAGE_DURATION); return; }
          try {
            const data = JSON.parse(stdout) as { streams?: Array<{ codec_type: string; duration?: string }> };
            const audio = data.streams?.find((s) => s.codec_type === 'audio');
            const dur = parseFloat(audio?.duration ?? '');
            resolve(isNaN(dur) || dur <= 0 ? DEFAULT_PAGE_DURATION : dur);
          } catch {
            resolve(DEFAULT_PAGE_DURATION);
          }
        },
      );
    });
  }

  private async imageToSegment(imgPath: string, duration: number, outputPath: string): Promise<void> {
    const safeDur = Math.max(duration, 1.5);
    const fadeOut = Math.max(safeDur - FADE_DURATION, 0.1);

    await this.runFfmpeg([
      '-loop', '1',
      '-i', imgPath,
      '-t', String(safeDur),
      '-vf', [
        'scale=1920:1080:force_original_aspect_ratio=decrease',
        'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',
        `fade=t=in:st=0:d=${FADE_DURATION}`,
        `fade=t=out:st=${fadeOut}:d=${FADE_DURATION}`,
      ].join(','),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-pix_fmt', 'yuv420p', '-r', '24',
      outputPath,
    ]);
  }

  private async createEndScreen(outputPath: string): Promise<void> {
    const fadeOut = END_SCREEN_DURATION - 0.8;
    try {
      // Try with drawtext (requires font support)
      await this.runFfmpeg([
        '-f', 'lavfi',
        '-i', `color=c=0x0a0516:s=1920x1080:d=${END_SCREEN_DURATION}`,
        '-vf', [
          `drawtext=text='The End':fontsize=100:fontcolor=white:x=(w-text_w)/2:y=h/2-70:enable='gte(t,1)'`,
          `drawtext=text='Created with HeroKids Universe':fontsize=46:fontcolor=0xFFD700:x=(w-text_w)/2:y=h/2+50:enable='gte(t,1.4)'`,
          `fade=t=in:st=0:d=1.0`,
          `fade=t=out:st=${fadeOut}:d=0.8`,
        ].join(','),
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-pix_fmt', 'yuv420p', '-r', '24',
        outputPath,
      ]);
    } catch {
      // Fallback: plain dark fade
      await this.runFfmpeg([
        '-f', 'lavfi',
        '-i', `color=c=0x0a0516:s=1920x1080:d=${END_SCREEN_DURATION}`,
        '-vf', `fade=t=in:st=0:d=1.0,fade=t=out:st=${fadeOut}:d=0.8`,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-pix_fmt', 'yuv420p', '-r', '24',
        outputPath,
      ]);
    }
  }

  private async concatenateSegments(
    segmentPaths: string[],
    outputPath: string,
    tmpDir: string,
  ): Promise<void> {
    const concatFile = path.join(tmpDir, 'concat.txt');
    const lines = segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(concatFile, lines);

    await this.runFfmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-r', '24',
      outputPath,
    ]);
  }

  private async buildAudioTrack(
    durations: number[],
    pages: Array<{ pageNumber: number; audioUrl?: string }>,
    coverImageUrl: string | null,
    tmpDir: string,
    outputPath: string,
  ): Promise<void> {
    // Build list of audio files in the same order as video segments
    // Slots: [cover(silence)?, ...pages, end(silence)]
    const audioFiles: string[] = [];
    let slot = 0;

    if (coverImageUrl) {
      const coverSilence = path.join(tmpDir, 'silence_cover.mp3');
      await this.generateSilence(durations[slot] ?? DEFAULT_PAGE_DURATION, coverSilence);
      audioFiles.push(coverSilence);
      slot++;
    }

    for (const pg of pages) {
      const localAudio = path.join(tmpDir, `audio_${pg.pageNumber}.mp3`);
      if (pg.audioUrl && fs.existsSync(localAudio)) {
        audioFiles.push(localAudio);
      } else {
        const silence = path.join(tmpDir, `silence_pg_${pg.pageNumber}.mp3`);
        await this.generateSilence(durations[slot] ?? DEFAULT_PAGE_DURATION, silence);
        audioFiles.push(silence);
      }
      slot++;
    }

    // End screen silence
    const endSilence = path.join(tmpDir, 'silence_end.mp3');
    await this.generateSilence(END_SCREEN_DURATION, endSilence);
    audioFiles.push(endSilence);

    // Concatenate all audio
    const audioConcatFile = path.join(tmpDir, 'audio_concat.txt');
    fs.writeFileSync(audioConcatFile, audioFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));

    const narrationPath = path.join(tmpDir, 'narration.aac');
    await this.runFfmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', audioConcatFile,
      '-c:a', 'aac',
      '-ar', '44100',
      '-ac', '2',
      narrationPath,
    ]);

    // Mix with background music if configured
    const bgmEnabled = this.config.get<string>('ENABLE_BACKGROUND_MUSIC') === 'true';
    const bgmPath    = this.config.get<string>('BACKGROUND_MUSIC_PATH') ?? '';
    const bgmVol     = parseFloat(this.config.get<string>('BACKGROUND_MUSIC_VOLUME') ?? '0.12');
    const narrVol    = parseFloat(this.config.get<string>('NARRATION_VOLUME') ?? '1.0');

    if (bgmEnabled && bgmPath && fs.existsSync(bgmPath)) {
      await this.runFfmpeg([
        '-i', narrationPath,
        '-stream_loop', '-1',
        '-i', bgmPath,
        '-filter_complex',
        `[0:a]volume=${narrVol}[narr];[1:a]volume=${bgmVol}[bgm];[narr][bgm]amix=inputs=2:duration=first[out]`,
        '-map', '[out]',
        '-c:a', 'aac',
        '-ar', '44100',
        '-ac', '2',
        outputPath,
      ]);
    } else {
      // No background music — just re-encode narration
      await this.runFfmpeg([
        '-i', narrationPath,
        '-c:a', 'aac',
        '-ar', '44100',
        '-ac', '2',
        outputPath,
      ]);
    }
  }

  private async generateSilence(duration: number, outputPath: string): Promise<void> {
    await this.runFfmpeg([
      '-f', 'lavfi',
      '-i', `anullsrc=r=44100:cl=stereo`,
      '-t', String(Math.max(duration, 0.1)),
      '-c:a', 'libmp3lame',
      '-q:a', '4',
      outputPath,
    ]);
  }

  private async combineVideoAudio(
    videoPath: string,
    audioPath: string,
    outputPath: string,
  ): Promise<void> {
    await this.runFfmpeg([
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-shortest',
      outputPath,
    ]);
  }

  // ── File download ─────────────────────────────────────────────────────────

  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(destPath);

      const req = protocol.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed ${url}: HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      });

      req.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
      file.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
    });
  }
}
