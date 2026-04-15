import { Injectable, BadRequestException, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createWorker, Worker } from 'tesseract.js';
import { containsContactInfo } from '../../common/contact-info.util';

@Injectable()
export class ImageModerationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImageModerationService.name);
  private worker: Worker | null = null;

  /**
   * Initialise a single persistent Tesseract worker when the server starts.
   * The first call downloads the English language data (~4 MB) and caches it
   * locally — subsequent server restarts reuse the cache instantly.
   */
  async onModuleInit() {
    try {
      this.worker = await createWorker('eng', 1, {
        logger: () => {}, // suppress per-character progress logs
      });
      this.logger.log('Image OCR worker ready');
    } catch (err) {
      this.logger.warn('OCR worker failed to initialise — image text-detection disabled', String(err));
    }
  }

  async onModuleDestroy() {
    await this.worker?.terminate().catch(() => {});
  }

  /**
   * Runs OCR on the raw image buffer and checks the extracted text against
   * the contact-info patterns.
   *
   * - Throws BadRequestException when contact info is detected in the image.
   * - Silently passes (fail-open) if the OCR worker is unavailable or errors,
   *   so a temporary initialisation failure never blocks all uploads.
   */
  async assertNoContactInfoInImage(buffer: Buffer): Promise<void> {
    if (!this.worker) return;

    try {
      const {
        data: { text },
      } = await this.worker.recognize(buffer);

      if (text.trim() && containsContactInfo(text)) {
        throw new BadRequestException(
          'This image contains contact information (phone number, WhatsApp, email, address, or social handle). ' +
            'Product photos must show only the product — no text overlays, posters, or flyers. ' +
            'Please upload a clean product photo.',
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn('OCR check failed — allowing upload', err instanceof Error ? err.message : String(err));
    }
  }
}
