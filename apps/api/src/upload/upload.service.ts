import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const AVATAR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');
const STORY_UPLOAD_DIR = join(process.cwd(), 'uploads', 'stories');
const CHARACTER_UPLOAD_DIR = join(process.cwd(), 'uploads', 'characters');
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

@Injectable()
export class UploadService {
  private readonly useR2: boolean;
  private s3Client?: S3Client;

  constructor(private readonly configService: ConfigService) {
    const accountId  = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKey  = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretKey  = this.configService.get<string>('R2_SECRET_ACCESS_KEY');

    this.useR2 = Boolean(accountId && accessKey && secretKey);

    if (this.useR2) {
      this.s3Client = new S3Client({
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        region: 'auto',
        credentials: { accessKeyId: accessKey!, secretAccessKey: secretKey! },
      });
    }
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Photo is required');
    if (!ALLOWED_MIME.includes(file.mimetype)) throw new BadRequestException('Invalid file type');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('File too large');

    if (this.useR2) {
      return this.uploadToR2(userId, file);
    }
    return this.saveLocally(userId, file);
  }

  async uploadGeneratedImage(
    userId: string,
    storyId: string,
    pageNumber: number,
    imageBase64: string,
  ): Promise<string> {
    const buffer = Buffer.from(imageBase64, 'base64');
    const filename = `${storyId}-page-${pageNumber}-${randomUUID()}.png`;
    const key = `stories/${userId}/${filename}`;

    if (this.useR2) {
      const bucket = this.configService.get<string>('R2_BUCKET_NAME') ?? 'heroverse-assets';
      const publicUrl = this.configService.get<string>('R2_PUBLIC_URL') ?? '';

      await this.s3Client!.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: 'image/png' }),
      );
      return `${publicUrl.replace(/\/$/, '')}/${key}`;
    }

    await mkdir(STORY_UPLOAD_DIR, { recursive: true });
    await writeFile(join(STORY_UPLOAD_DIR, filename), buffer);
    return `http://localhost:3000/api/upload/files/stories/${filename}`;
  }

  async uploadPageAudio(
    userId: string,
    storyId: string,
    pageNumber: number,
    audioBuffer: Buffer,
  ): Promise<string> {
    const filename = `${storyId}-page-${pageNumber}-${randomUUID()}.mp3`;
    const key = `audio/${userId}/${filename}`;

    if (this.useR2) {
      const bucket    = this.configService.get<string>('R2_BUCKET_NAME') ?? 'heroverse-assets';
      const publicUrl = this.configService.get<string>('R2_PUBLIC_URL') ?? '';

      await this.s3Client!.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: audioBuffer, ContentType: 'audio/mpeg' }),
      );
      return `${publicUrl.replace(/\/$/, '')}/${key}`;
    }

    const audioDir = join(process.cwd(), 'uploads', 'audio');
    await mkdir(audioDir, { recursive: true });
    await writeFile(join(audioDir, filename), audioBuffer);
    return `http://localhost:3000/api/upload/files/audio/${filename}`;
  }

  async uploadCharacterPhoto(userId: string, file: Express.Multer.File): Promise<string> {
    if (!file) throw new BadRequestException('Photo is required');
    if (!ALLOWED_MIME.includes(file.mimetype)) throw new BadRequestException('Invalid file type');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('File too large');

    const ext = file.mimetype.split('/')[1] ?? 'jpg';
    return this.uploadBuffer({
      userId,
      folder: 'characters',
      filename: `photo-${randomUUID()}.${ext}`,
      buffer: file.buffer,
      contentType: file.mimetype,
    });
  }

  async uploadHeroPhoto(userId: string, file: Express.Multer.File): Promise<string> {
    if (!file) throw new BadRequestException('Photo is required');
    if (!ALLOWED_MIME.includes(file.mimetype)) throw new BadRequestException('Invalid file type');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('File too large');

    const ext = file.mimetype.split('/')[1] ?? 'jpg';
    return this.uploadBuffer({
      userId,
      folder: 'heroes',
      filename: `photo-${randomUUID()}.${ext}`,
      buffer: file.buffer,
      contentType: file.mimetype,
    });
  }

  async uploadCharacterAvatar(userId: string, imageBase64: string): Promise<string> {
    return this.uploadBuffer({
      userId,
      folder: 'characters',
      filename: `avatar-${randomUUID()}.png`,
      buffer: Buffer.from(imageBase64, 'base64'),
      contentType: 'image/png',
    });
  }

  async uploadHeroAvatar(userId: string, imageBase64: string): Promise<string> {
    return this.uploadBuffer({
      userId,
      folder: 'heroes',
      filename: `avatar-${randomUUID()}.png`,
      buffer: Buffer.from(imageBase64, 'base64'),
      contentType: 'image/png',
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
    const filename = `payout-proof-${influencerId}-${randomUUID()}.${ext}`;
    const key = `payouts/${influencerId}/${filename}`;
    const fileType: 'pdf' | 'image' = file.mimetype === 'application/pdf' ? 'pdf' : 'image';

    if (this.useR2) {
      const bucket = this.configService.get<string>('R2_BUCKET_NAME') ?? 'heroverse-assets';
      const publicUrl = this.configService.get<string>('R2_PUBLIC_URL') ?? '';
      await this.s3Client!.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }),
      );
      return { url: `${publicUrl}/${key}`, fileType };
    }

    const dir = join(process.cwd(), 'uploads', 'payouts', influencerId);
    await mkdir(dir, { recursive: true });
    const localPath = join(dir, filename);
    await writeFile(localPath, file.buffer);
    return { url: `/uploads/payouts/${influencerId}/${filename}`, fileType };
  }

  private async uploadToR2(userId: string, file: Express.Multer.File) {
    const bucket    = this.configService.get<string>('R2_BUCKET_NAME') ?? 'heroverse-assets';
    const publicUrl = this.configService.get<string>('R2_PUBLIC_URL') ?? '';
    const key       = `avatars/${userId}/${randomUUID()}.webp`;

    await this.s3Client!.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }),
    );
    return { avatarUrl: `${publicUrl.replace(/\/$/, '')}/${key}` };
  }

  private async saveLocally(userId: string, file: Express.Multer.File) {
    await mkdir(AVATAR_UPLOAD_DIR, { recursive: true });
    const ext      = file.mimetype.split('/')[1] ?? 'jpg';
    const filename = `${userId}-${randomUUID()}.${ext}`;
    await writeFile(join(AVATAR_UPLOAD_DIR, filename), file.buffer);
    return { avatarUrl: `http://localhost:3000/api/upload/files/${filename}` };
  }

  async uploadVideo(userId: string, storyId: string, filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    const filename = `${storyId}-${randomUUID()}.mp4`;
    const key = `videos/${userId}/${filename}`;

    if (this.useR2) {
      const bucket    = this.configService.get<string>('R2_BUCKET_NAME') ?? 'heroverse-assets';
      const publicUrl = this.configService.get<string>('R2_PUBLIC_URL') ?? '';
      await this.s3Client!.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: 'video/mp4' }),
      );
      return `${publicUrl.replace(/\/$/, '')}/${key}`;
    }

    const videoDir = join(process.cwd(), 'uploads', 'videos');
    await mkdir(videoDir, { recursive: true });
    await writeFile(join(videoDir, filename), buffer);
    return `http://localhost:3000/api/upload/files/videos/${filename}`;
  }

  private async uploadBuffer(input: {
    userId: string;
    folder: 'characters' | 'heroes';
    filename: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<string> {
    const key = `${input.folder}/${input.userId}/${input.filename}`;

    if (this.useR2) {
      const bucket = this.configService.get<string>('R2_BUCKET_NAME') ?? 'heroverse-assets';
      const publicUrl = this.configService.get<string>('R2_PUBLIC_URL') ?? '';

      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: input.buffer,
          ContentType: input.contentType,
        }),
      );
      return `${publicUrl.replace(/\/$/, '')}/${key}`;
    }

    const uploadDir = input.folder === 'characters' ? CHARACTER_UPLOAD_DIR : AVATAR_UPLOAD_DIR;
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, input.filename), input.buffer);

    const localFolder = input.folder === 'characters' ? 'characters' : '';
    return `http://localhost:3000/api/upload/files/${localFolder ? `${localFolder}/` : ''}${input.filename}`;
  }
}
