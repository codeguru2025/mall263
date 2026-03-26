import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import * as sharp from 'sharp';

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

  constructor(private config: ConfigService) {
    this.bucket = this.config.get('DO_SPACES_BUCKET', 'mall263-uploads');
    this.cdnUrl = this.config.get('DO_SPACES_CDN_URL', '');
    this.endpoint = this.config.get('DO_SPACES_ENDPOINT', 'https://nyc3.digitaloceanspaces.com');
    this.region = this.config.get('DO_SPACES_REGION', 'nyc3');

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
    maxWidth: number = 1200,
  ): Promise<UploadResult> {
    this.validateImage(file);

    const optimized = await sharp(file.buffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 82 })
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
      .webp({ quality: 75 })
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

    const ext = file.originalname.split('.').pop() || 'bin';
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
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image size must be under 5MB');
    }
  }
}
