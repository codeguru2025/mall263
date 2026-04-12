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
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadService, UploadResult } from './upload.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

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
    return this.uploadService.uploadImage(file, 'products');
  }

  @Post('avatar')
  @Public()
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

  @Post('images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 5, { limits: { fileSize: 15 * 1024 * 1024 } }))
  async uploadMultipleImages(@UploadedFiles() files: Express.Multer.File[]): Promise<UploadResult[]> {
    if (!files || files.length === 0) throw new BadRequestException('No files provided');
    return Promise.all(files.map((f) => this.uploadService.uploadImage(f, 'products')));
  }

  @Delete(':key(*)')
  async deleteFile(@Param('key') key: string): Promise<{ success: boolean }> {
    await this.uploadService.delete(key);
    return { success: true };
  }
}
