import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile, spawn } from 'child_process';

import { Story, VideoStatus } from '../stories/story.entity';
import { UploadService } from '../upload/upload.service';
import { ffmpegPath, ffprobePath } from './ffmpeg-path';
import { FrameBubble, renderCoverFrame, renderEndFrame, renderPageFrame, VideoFormat } from './video-frames';

const FPS = 25;
const CROSSFADE = 0.6;          // seconds of overlap between frames
const COVER_SECONDS = 3.5;
const END_SECONDS = 3.5;
const PAGE_PADDING = 0.9;       // breathing room after each page's narration
const STUCK_AFTER_MS = 30 * 60 * 1000;
/** Output size — frames are drawn at full HD for crisp text, then encoded at 720p so videos stay WhatsApp-friendly. */
const OUTPUT_SIZE: Record<VideoFormat, { width: number; height: number }> = {
  vertical: { width: 720, height: 1280 },
  landscape: { width: 1280, height: 720 },
};

/**
 * Story → MP4. Each page is drawn like the reader (illustration + speech bubbles + text), held for its
 * narration with a slow zoom, and pages crossfade. Vertical (phone/WhatsApp) is the default; landscape
 * is optional and stored in story.videoVariants.landscape.
 */
@Injectable()
export class VideoGenerationService implements OnModuleInit {
  private readonly logger = new Logger(VideoGenerationService.name);
  /** One render at a time — FFmpeg is CPU-heavy and shares the box with the API. */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    @InjectRepository(Story) private readonly storiesRepo: Repository<Story>,
    private readonly uploadService: UploadService,
    private readonly config: ConfigService,
  ) {}

  /** A restart mid-render used to leave stories "generating" forever — mark those failed so they can be retried. */
  async onModuleInit(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
      const stuck = await this.storiesRepo.find({ where: { videoStatus: VideoStatus.Generating, updatedAt: LessThan(cutoff) } });
      for (const s of stuck) await this.storiesRepo.update(s.id, { videoStatus: VideoStatus.Failed });
      const withVariant = await this.storiesRepo.createQueryBuilder('s')
        .where(`s."videoVariants"->'landscape'->>'status' = 'generating'`)
        .andWhere('s."updatedAt" < :cutoff', { cutoff })
        .getMany();
      for (const s of withVariant) await this.setStatus(s, 'landscape', 'failed');
      if (stuck.length || withVariant.length) this.logger.warn(`Marked ${stuck.length + withVariant.length} stuck video export(s) as failed`);
    } catch (err) {
      this.logger.warn(`Stuck video rescue skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Queues a render; returns immediately. */
  async generateVideo(storyId: string, userId: string, format: VideoFormat = 'vertical'): Promise<void> {
    const story = await this.storiesRepo.findOne({ where: { id: storyId, userId } });
    if (!story) throw new Error('Story not found');
    await this.setStatus(story, format, 'generating');
    this.queue = this.queue.then(() => this.render(storyId, userId, format)).catch(() => undefined);
  }

  private async setStatus(story: Story, format: VideoFormat, status: 'generating' | 'completed' | 'failed', url?: string): Promise<void> {
    if (format === 'vertical') {
      await this.storiesRepo.update(story.id, {
        videoStatus: status === 'generating' ? VideoStatus.Generating : status === 'completed' ? VideoStatus.Completed : VideoStatus.Failed,
        ...(url ? { videoUrl: url } : {}),
      });
      return;
    }
    const fresh = await this.storiesRepo.findOne({ where: { id: story.id } });
    const variants = { ...(fresh?.videoVariants ?? {}) };
    variants.landscape = { status, url: url ?? variants.landscape?.url ?? null };
    await this.storiesRepo.update(story.id, { videoVariants: variants });
  }

  private async render(storyId: string, userId: string, format: VideoFormat): Promise<void> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `hku-video-${format}-`));
    const started = Date.now();
    const story = await this.storiesRepo.findOne({ where: { id: storyId, userId } });
    if (!story) return;
    try {
      const pages = [...(story.pages ?? [])]
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .filter((p) => !!p.imageUrl); // a missing illustration used to fail the whole export
      if (!pages.length) throw new Error('Story has no illustrated pages');

      const title = story.title ?? 'My HeroKids Story';
      const heroName = (await this.storiesRepo.manager.query(`SELECT name FROM heroes WHERE id = $1`, [story.heroId]))[0]?.name ?? 'our hero';
      const coverImage = await this.fetchBuffer(story.coverImageUrl ?? pages[0].imageUrl!).catch(() => null);

      // ── Frames + durations ──────────────────────────────────────────────
      type Segment = { frame: string; seconds: number; audio?: string };
      const segments: Segment[] = [];
      const coverPath = path.join(tmpDir, 'cover.png');
      fs.writeFileSync(coverPath, await renderCoverFrame({ format, image: coverImage, title, heroName }));
      segments.push({ frame: coverPath, seconds: COVER_SECONDS });

      for (const page of pages) {
        const image = await this.fetchBuffer(page.imageUrl!);
        const framePath = path.join(tmpDir, `page-${page.pageNumber}.png`);
        fs.writeFileSync(framePath, await renderPageFrame({
          format,
          image,
          bubbles: (page.speechBubbles ?? []) as FrameBubble[],
          text: page.text,
          title,
          pageNumber: page.pageNumber,
          totalPages: pages.length,
        }));
        let audioPath: string | undefined;
        let seconds = Math.max(5, page.text.split(/\s+/).length * 0.42);
        if (page.audioUrl) {
          try {
            audioPath = path.join(tmpDir, `audio-${page.pageNumber}${path.extname(new URL(page.audioUrl, 'http://x').pathname) || '.mp3'}`);
            fs.writeFileSync(audioPath, await this.fetchBuffer(page.audioUrl));
            seconds = (await this.audioSeconds(audioPath)) ?? seconds;
          } catch (err) {
            this.logger.warn(`Video ${storyId}: narration for page ${page.pageNumber} unavailable (${err instanceof Error ? err.message : err})`);
            audioPath = undefined;
          }
        }
        segments.push({ frame: framePath, seconds: seconds + PAGE_PADDING, audio: audioPath });
      }

      const endPath = path.join(tmpDir, 'end.png');
      fs.writeFileSync(endPath, await renderEndFrame({ format, image: coverImage }));
      segments.push({ frame: endPath, seconds: END_SECONDS });

      // ── One FFmpeg pass: slow zoom per frame, crossfades, narration at each page's start ──
      const outPath = path.join(tmpDir, `story-${format}.mp4`);
      await this.runFfmpeg(this.buildArgs(segments, format, outPath));

      const url = await this.uploadService.uploadVideo(userId, storyId, outPath);
      const previous = format === 'vertical' ? story.videoUrl : story.videoVariants?.landscape?.url;
      await this.setStatus(story, format, 'completed', url);
      if (previous && previous !== url) await this.uploadService.deleteObject(previous);
      this.logger.log(`Video (${format}) for story ${storyId} done in ${((Date.now() - started) / 1000).toFixed(0)}s: ${url}`);
    } catch (err) {
      this.logger.error(`Video (${format}) failed for story ${storyId}: ${err instanceof Error ? err.message : String(err)}`);
      await this.setStatus(story, format, 'failed').catch(() => undefined);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private buildArgs(segments: Array<{ frame: string; seconds: number; audio?: string }>, format: VideoFormat, outPath: string): string[] {
    const { width, height } = OUTPUT_SIZE[format];
    const args: string[] = ['-y', '-hide_banner', '-loglevel', 'error'];
    segments.forEach((s) => args.push('-loop', '1', '-t', s.seconds.toFixed(2), '-i', s.frame));
    const audioInputs: Array<{ input: number; delayMs: number }> = [];

    // Each segment starts CROSSFADE seconds before the previous one ends.
    const starts: number[] = [];
    let t = 0;
    segments.forEach((s, i) => {
      starts.push(t);
      t += s.seconds - (i < segments.length - 1 ? CROSSFADE : 0);
    });
    const total = t;
    segments.forEach((s, i) => {
      if (!s.audio) return;
      audioInputs.push({ input: segments.length + audioInputs.length, delayMs: Math.round((starts[i] + 0.35) * 1000) });
      args.push('-i', s.audio);
    });

    const filters: string[] = [];
    segments.forEach((s, i) => {
      const frames = Math.ceil(s.seconds * FPS);
      // Upscale first so the slow zoom is smooth, then zoom from 1.00 to ~1.04 over the segment.
      filters.push(
        `[${i}:v]scale=${width * 2}:${height * 2},zoompan=z='min(zoom+${(0.04 / frames).toFixed(6)},1.04)':d=${frames}` +
        `:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${FPS},format=yuv420p,setsar=1[v${i}]`,
      );
    });
    let last = 'v0';
    for (let i = 1; i < segments.length; i++) {
      const out = i === segments.length - 1 ? 'vout' : `x${i}`;
      filters.push(`[${last}][v${i}]xfade=transition=fade:duration=${CROSSFADE}:offset=${(starts[i]).toFixed(2)}[${out}]`);
      last = out;
    }
    if (segments.length === 1) filters.push('[v0]null[vout]');

    const narrVol = parseFloat(this.config.get<string>('NARRATION_VOLUME') ?? '1.0');
    if (audioInputs.length) {
      audioInputs.forEach((a, k) => filters.push(`[${a.input}:a]aresample=44100,volume=${narrVol},adelay=${a.delayMs}|${a.delayMs}[a${k}]`));
      filters.push(`${audioInputs.map((_, k) => `[a${k}]`).join('')}amix=inputs=${audioInputs.length}:normalize=0,apad[aout]`);
    }

    args.push('-filter_complex', filters.join(';'), '-map', '[vout]');
    if (audioInputs.length) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '128k');
    args.push(
      '-t', total.toFixed(2),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outPath,
    );
    return args;
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-2000)}`))));
      proc.on('error', reject);
    });
  }

  private audioSeconds(filePath: string): Promise<number | null> {
    return new Promise((resolve) => {
      execFile(ffprobePath(), ['-v', 'quiet', '-print_format', 'json', '-show_format', filePath], (err, stdout) => {
        if (err) return resolve(null);
        try {
          const seconds = parseFloat((JSON.parse(stdout) as { format?: { duration?: string } }).format?.duration ?? '');
          resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : null);
        } catch {
          resolve(null);
        }
      });
    });
  }

  /** Locally stored media is a relative /api/... path served by this API. */
  private async fetchBuffer(url: string): Promise<Buffer> {
    const absolute = url.startsWith('/') ? `http://localhost:${process.env.PORT ?? 3000}${url}` : url;
    const res = await fetch(absolute, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Download failed ${absolute}: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
