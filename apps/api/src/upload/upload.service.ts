import { BadRequestException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { makePreview, previewPathFor } from './image-preview';

const AVATAR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');
const STORY_UPLOAD_DIR = join(process.cwd(), 'uploads', 'stories');
const CHARACTER_UPLOAD_DIR = join(process.cwd(), 'uploads', 'characters');

// Immutable cache: keys include a random component so they never collide on regen.
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

@Injectable()
export class UploadService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UploadService.name);
  readonly useR2: boolean;
  private s3Client?: S3Client;
  private readonly bucket: string;
  private readonly r2PublicUrl: string;

  constructor(private readonly configService: ConfigService) {
    const accountId  = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKey  = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretKey  = this.configService.get<string>('R2_SECRET_ACCESS_KEY');

    this.useR2 = Boolean(accountId && accessKey && secretKey);
    this.bucket = this.configService.get<string>('R2_BUCKET_NAME') ?? 'heroverse-assets';
    this.r2PublicUrl = (this.configService.get<string>('R2_PUBLIC_URL') ?? '').replace(/\/$/, '');

    if (this.useR2) {
      this.s3Client = new S3Client({
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        region: 'auto',
        credentials: { accessKeyId: accessKey!, secretAccessKey: secretKey! },
      });
    }
  }

  onApplicationBootstrap() {
    if (!this.useR2 && this.configService.get<string>('NODE_ENV') === 'production') {
      this.logger.warn(
        '⚠️  R2 storage NOT configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY missing). ' +
        'Images are stored in the local Docker volume and WILL BE LOST if the volume is removed. ' +
        'Set R2 credentials in .env.production to enable permanent cloud storage.',
      );
    }
  }

  // ── Public URL helpers ────────────────────────────────────────────────────

  getPublicUrl(key: string): string {
    return `${this.r2PublicUrl}/${key}`;
  }

  /** Extracts the R2 object key from a full public URL. Returns null for non-R2 URLs. */
  extractKeyFromUrl(url: string): string | null {
    if (!url || !this.r2PublicUrl || !url.startsWith(this.r2PublicUrl)) return null;
    return url.slice(this.r2PublicUrl.length).replace(/^\/+/, '');
  }

  // ── Deletion ──────────────────────────────────────────────────────────────

  /** Deletes an R2 object by its public URL. Silently no-ops for non-R2 URLs or if R2 is not configured. */
  async deleteObject(url: string | null | undefined): Promise<void> {
    if (!url || !this.useR2 || !this.s3Client) return;
    const key = this.extractKeyFromUrl(url);
    if (!key) return;
    try {
      await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      this.logger.debug(`Deleted R2 object: ${key}`);
    } catch (err) {
      this.logger.warn(`Failed to delete R2 object ${key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** HEAD-checks that an object exists in R2. */
  async objectExists(url: string): Promise<boolean> {
    if (!this.useR2 || !this.s3Client) return false;
    const key = this.extractKeyFromUrl(url);
    if (!key) return false;
    try {
      await this.s3Client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  // ── Public upload methods ─────────────────────────────────────────────────

  async uploadGeneratedImage(
    userId: string,
    storyId: string,
    pageNumber: number | string,
    imageBase64: string,
  ): Promise<string> {
    const buffer = Buffer.from(imageBase64, 'base64');
    const randomId = randomUUID();

    if (this.useR2) {
      const key = `stories/${storyId}/pages/${pageNumber}-${randomId}.png`;
      await this.putR2Object(key, buffer, 'image/png');
      await this.savePreview(key, buffer);
      return this.getPublicUrl(key);
    }

    const filename = `${storyId}-page-${pageNumber}-${randomId}.png`;
    await mkdir(STORY_UPLOAD_DIR, { recursive: true });
    await writeFile(join(STORY_UPLOAD_DIR, filename), buffer);
    await this.savePreview(`stories/${filename}`, buffer);
    return this.localUploadUrl(`stories/${filename}`);
  }

  // ── Previews (small WebP copies for lists) ────────────────────────────────

  /** Stores the small copy next to the original. Never fails the upload — lists fall back to the original. */
  private async savePreview(keyOrLocalPath: string, original: Buffer): Promise<void> {
    const target = previewPathFor(keyOrLocalPath);
    if (!target) return;
    try {
      const preview = await makePreview(original);
      if (this.useR2) await this.putR2Object(target, preview, 'image/webp');
      else await writeFile(join(process.cwd(), 'uploads', target), preview);
    } catch (err) {
      this.logger.warn(`Preview not saved for ${keyOrLocalPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Makes the preview for an existing picture if it's missing (one-off backfill).
   * Returns 'created', 'exists', or 'skipped' (not a stored PNG/JPEG we own).
   */
  async ensurePreview(url: string): Promise<'created' | 'exists' | 'skipped'> {
    const r2Key = this.extractKeyFromUrl(url);
    if (r2Key && this.useR2 && this.s3Client) {
      const target = previewPathFor(r2Key);
      if (!target) return 'skipped';
      if (await this.objectExists(this.getPublicUrl(target))) return 'exists';
      const obj = await this.s3Client.send(new GetObjectCommand({ Bucket: this.bucket, Key: r2Key }));
      const original = Buffer.from(await obj.Body!.transformToByteArray());
      await this.putR2Object(target, await makePreview(original), 'image/webp');
      return 'created';
    }
    const local = url.match(/\/upload\/files\/((?:stories|characters)\/[^/?#]+)$/);
    if (!local) return 'skipped';
    const target = previewPathFor(local[1]);
    if (!target) return 'skipped';
    const targetPath = join(process.cwd(), 'uploads', target);
    try { await readFile(targetPath); return 'exists'; } catch { /* not there yet */ }
    const original = await readFile(join(process.cwd(), 'uploads', local[1]));
    await writeFile(targetPath, await makePreview(original));
    return 'created';
  }

  async uploadPageAudio(
    userId: string,
    storyId: string,
    pageNumber: number,
    audioBuffer: Buffer,
    contentType = 'audio/mpeg',
  ): Promise<string> {
    const isWav = audioBuffer.length >= 4 && audioBuffer.slice(0, 4).toString('ascii') === 'RIFF';
    const ext = isWav ? 'wav' : 'mp3';
    const mime = isWav ? 'audio/wav' : contentType;
    const randomId = randomUUID();

    if (this.useR2) {
      const key = `stories/${storyId}/audio/${pageNumber}-${randomId}.${ext}`;
      await this.putR2Object(key, audioBuffer, mime);
      return this.getPublicUrl(key);
    }

    const filename = `${storyId}-page-${pageNumber}-${randomId}.${ext}`;
    const audioDir = join(process.cwd(), 'uploads', 'audio');
    await mkdir(audioDir, { recursive: true });
    await writeFile(join(audioDir, filename), audioBuffer);
    return this.localUploadUrl(`audio/${filename}`);
  }

  /**
   * Uploads a generated hero avatar. Pass `heroId` when the hero entity already exists
   * (update / regen flows) so the key is scoped to that hero UUID.
   */
  async uploadHeroAvatar(userId: string, imageBase64: string, heroId?: string): Promise<string> {
    return this.uploadEntityAvatar({
      prefix: 'avatars/heroes',
      entityId: heroId ?? randomUUID(),
      buffer: Buffer.from(imageBase64, 'base64'),
      localDir: AVATAR_UPLOAD_DIR,
      localSubpath: '',
    });
  }

  /**
   * Uploads a generated character avatar. Pass `characterId` when the character already
   * exists (update / regen flows) so the key is scoped to that character UUID.
   */
  async uploadCharacterAvatar(userId: string, imageBase64: string, characterId?: string): Promise<string> {
    return this.uploadEntityAvatar({
      prefix: 'avatars/characters',
      entityId: characterId ?? randomUUID(),
      buffer: Buffer.from(imageBase64, 'base64'),
      localDir: CHARACTER_UPLOAD_DIR,
      localSubpath: 'characters',
    });
  }

  async uploadPaymentProof(influencerId: string, file: Express.Multer.File): Promise<{ url: string; fileType: 'pdf' | 'image' }> {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: PDF, JPG, PNG, WEBP');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 10MB)');
    }

    const ext = file.mimetype === 'application/pdf' ? 'pdf' : file.originalname.split('.').pop() ?? 'jpg';
    const randomId = randomUUID();
    const fileType: 'pdf' | 'image' = file.mimetype === 'application/pdf' ? 'pdf' : 'image';

    if (this.useR2) {
      const key = `payouts/${influencerId}/${randomId}.${ext}`;
      await this.putR2Object(key, file.buffer, file.mimetype);
      return { url: this.getPublicUrl(key), fileType };
    }

    const dir = join(process.cwd(), 'uploads', 'payouts', influencerId);
    await mkdir(dir, { recursive: true });
    const filename = `payout-proof-${influencerId}-${randomId}.${ext}`;
    await writeFile(join(dir, filename), file.buffer);
    return { url: `/uploads/payouts/${influencerId}/${filename}`, fileType };
  }

  /**
   * `downloadName` is sent as Content-Disposition: attachment, so clicking the link downloads the video
   * (browsers ignore the <a download> attribute for files on another origin such as R2).
   */
  async uploadVideo(userId: string, storyId: string, filePath: string, downloadName = 'herokids-story.mp4'): Promise<string> {
    const buffer = await readFile(filePath);
    const randomId = randomUUID();

    if (this.useR2) {
      const key = `videos/${storyId}/${randomId}.mp4`;
      await this.putR2Object(key, buffer, 'video/mp4', `attachment; filename="${downloadName.replace(/[^a-z0-9.-]/gi, '-')}"`);
      return this.getPublicUrl(key);
    }

    const filename = `${storyId}-${randomId}.mp4`;
    const videoDir = join(process.cwd(), 'uploads', 'videos');
    await mkdir(videoDir, { recursive: true });
    await writeFile(join(videoDir, filename), buffer);
    return this.localUploadUrl(`videos/${filename}`);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async putR2Object(key: string, body: Buffer, contentType: string, contentDisposition?: string): Promise<void> {
    await this.s3Client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: IMMUTABLE_CACHE,
        ...(contentDisposition ? { ContentDisposition: contentDisposition } : {}),
      }),
    );
  }

  private async uploadEntityAvatar(opts: {
    prefix: string;
    entityId: string;
    buffer: Buffer;
    localDir: string;
    localSubpath: string;
  }): Promise<string> {
    const randomId = randomUUID();

    if (this.useR2) {
      const key = `${opts.prefix}/${opts.entityId}/${randomId}.png`;
      await this.putR2Object(key, opts.buffer, 'image/png');
      return this.getPublicUrl(key);
    }

    const filename = `avatar-${randomId}.png`;
    await mkdir(opts.localDir, { recursive: true });
    await writeFile(join(opts.localDir, filename), opts.buffer);
    return this.localUploadUrl(opts.localSubpath ? `${opts.localSubpath}/${filename}` : filename);
  }

  /** True only for images we generated and stored ourselves — an avatar may never point anywhere else. */
  isOwnAssetUrl(url: string): boolean {
    const value = url.trim();
    if (value.startsWith('/api/upload/files/')) return true;
    if (this.r2PublicUrl && value.startsWith(`${this.r2PublicUrl}/`)) return true;
    const apiBase = this.getPublicApiBaseUrl();
    if (apiBase && value.startsWith(`${apiBase}/upload/files/`)) return true;
    return /^http:\/\/localhost:\d+\/api\/upload\/files\//.test(value) && process.env.NODE_ENV !== 'production';
  }

  private getPublicApiBaseUrl(): string | null {
    const configured =
      this.configService.get<string>('API_PUBLIC_URL')
      ?? this.configService.get<string>('PUBLIC_API_URL')
      ?? this.configService.get<string>('BACKEND_PUBLIC_URL');

    const raw = configured?.trim();
    if (!raw) return null;

    const base = raw.replace(/\/$/, '');
    return /\/api$/i.test(base) ? base : `${base}/api`;
  }

  private localUploadUrl(path: string): string {
    const relativePath = `/api/upload/files/${path.replace(/^\/+/, '')}`;
    const publicApiBase = this.getPublicApiBaseUrl();
    if (!publicApiBase) return relativePath;
    return `${publicApiBase}/upload/files/${path.replace(/^\/+/, '')}`;
  }
}
