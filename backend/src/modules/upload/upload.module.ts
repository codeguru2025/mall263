import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { ImageModerationService } from './image-moderation.service';
import multer from 'multer';

@Module({
  imports: [
    MulterModule.register({
      storage: multer.memoryStorage(),
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, ImageModerationService],
  exports: [UploadService, ImageModerationService],
})
export class UploadModule {}
