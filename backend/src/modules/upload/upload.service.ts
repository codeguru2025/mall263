import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import sharp from 'sharp';
import { ImageModerationService } from './image-moderation.service';

export interface UploadResult {
  key: string;
  url: string;
  cdnUrl: string;
  size: number;
  mimetype: string;
}

@Injectable()
export class UploadService {
  private s3: S3Client;
  private bucket: string;
  private cdnUrl: string;
  private endpoint: string;
  private region: string;

  constructor(
    private config: ConfigService,
    private imageModeration: ImageModerationService,
  ) {
    this.bucket = this.config.get('DO_SPACES_BUCKET', 'mall263-uploads');
    this.cdnUrl = this.config.get('DO_SPACES_CDN_URL', '');
    this.endpoint = this.config.get('DO_SPACES_ENDPOINT', 'https://lon1.digitaloceanspaces.com');
    this.region = this.config.get('DO_SPACES_REGION', 'lon1');

    this.s3 = new S3Client({
      endpoint: this.endpoint,
      region: this.region,
      credentials: {
        accessKeyId: this.config.get('DO_SPACES_ACCESS_KEY', ''),
        secretAccessKey: this.config.get('DO_SPACES_SECRET_KEY', ''),
      },
      forcePathStyle: false,
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'images',
    maxWidth: number = 900,
    moderateContact: boolean = false,
  ): Promise<UploadResult> {
    this.validateImage(file);

    // OCR check on the original buffer BEFORE expensive processing.
    // Using the original gives Tesseract the highest quality input for text recognition.
    if (moderateContact) {
      await this.imageModeration.assertNoContactInfoInImage(file.buffer);
    }

    const optimized = await sharp(file.buffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .sharpen({ sigma: 0.6, m1: 0.5, m2: 0.5 })
      .webp({ quality: 78, effort: 6, smartSubsample: true })
      .toBuffer();

    const key = `${folder}/${uuid()}.webp`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: optimized,
        ContentType: 'image/webp',
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000',
      }),
    );

    return {
      key,
      url: `${this.endpoint}/${this.bucket}/${key}`,
      cdnUrl: this.cdnUrl ? `${this.cdnUrl}/${key}` : `${this.endpoint}/${this.bucket}/${key}`,
      size: optimized.length,
      mimetype: 'image/webp',
    };
  }

  async uploadThumbnail(
    file: Express.Multer.File,
    folder: string = 'thumbnails',
  ): Promise<UploadResult> {
    this.validateImage(file);

    const optimized = await sharp(file.buffer)
      .resize({ width: 400, height: 400, fit: 'cover' })
      .sharpen({ sigma: 0.5, m1: 0.4, m2: 0.4 })
      .webp({ quality: 70, effort: 6, smartSubsample: true })
      .toBuffer();

    const key = `${folder}/${uuid()}.webp`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: optimized,
        ContentType: 'image/webp',
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000',
      }),
    );

    return {
      key,
      url: `${this.endpoint}/${this.bucket}/${key}`,
      cdnUrl: this.cdnUrl ? `${this.cdnUrl}/${key}` : `${this.endpoint}/${this.bucket}/${key}`,
      size: optimized.length,
      mimetype: 'image/webp',
    };
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'files',
  ): Promise<UploadResult> {
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size must be under 10MB');
    }

    const allowedDocumentExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'];
    const ext = (file.originalname.split('.').pop() || 'bin').toLowerCase();
    if (!allowedDocumentExts.includes(ext)) {
      throw new BadRequestException(`File type .${ext} is not allowed. Allowed types: ${allowedDocumentExts.join(', ')}`);
    }
    const key = `${folder}/${uuid()}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000',
      }),
    );

    return {
      key,
      url: `${this.endpoint}/${this.bucket}/${key}`,
      cdnUrl: this.cdnUrl ? `${this.cdnUrl}/${key}` : `${this.endpoint}/${this.bucket}/${key}`,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  private validateImage(file: Express.Multer.File): void {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, WebP, and GIF images are allowed');
    }
    if (file.size > 15 * 1024 * 1024) {
      throw new BadRequestException('Image size must be under 15MB');
    }
  }
}
