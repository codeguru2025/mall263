import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiParam } from '@nestjs/swagger';
import { UploadService, UploadResult } from './upload.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('image')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File): Promise<UploadResult> {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.uploadImage(file, 'products', 900, true);
  }

  @Post('avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 3 * 1024 * 1024 } }))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File): Promise<UploadResult> {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.uploadThumbnail(file, 'avatars');
  }

  @Post('document')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadDocument(@UploadedFile() file: Express.Multer.File): Promise<UploadResult> {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.uploadFile(file, 'documents');
  }

  // Chat attachments — client-side compression already trims image size and
  // the participants already pair up via an accepted offer, so we skip the
  // OCR contact-info check and allow a larger max dimension for legibility.
  @Post('chat-media')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadChatMedia(@UploadedFile() file: Express.Multer.File): Promise<UploadResult> {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.uploadImage(file, 'chat/image', 1400, false);
  }

  @Post('images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 5, { limits: { fileSize: 15 * 1024 * 1024 } }))
  async uploadMultipleImages(@UploadedFiles() files: Express.Multer.File[]): Promise<UploadResult[]> {
    if (!files || files.length === 0) throw new BadRequestException('No files provided');
    return Promise.all(files.map((f) => this.uploadService.uploadImage(f, 'products', 900, true)));
  }

  @Post('video')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  async uploadVideo(@UploadedFile() file: Express.Multer.File): Promise<UploadResult> {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.uploadVideo(file, 'videos');
  }

  // path-to-regexp v8 (Nest 11+): use named wildcard instead of legacy :key(*)
  @Delete('*key')
  @ApiParam({ name: 'key', type: String, description: 'Object key/path under bucket (may include slashes)' })
  async deleteFile(@Param('key') key: string): Promise<{ success: boolean }> {
    let decoded = key;
    try {
      decoded = decodeURIComponent(key);
    } catch {
      decoded = key;
    }
    await this.uploadService.delete(decoded);
    return { success: true };
  }
}
