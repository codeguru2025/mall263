/**
 * Resize and re-encode profile images in the browser so uploads stay small
 * while keeping as much detail as practical (downscale only when needed, then tune quality).
 */

const DEFAULT_MAX_BYTES = Math.floor(1.95 * 1024 * 1024); // under typical 2MB API limits
const MAX_EDGE_STEPS = [2048, 1680, 1440, 1280, 1024, 896, 768, 640, 512, 400] as const;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

let webpEncodeSupported: boolean | null = null;

function supportsWebpEncode(): boolean {
  if (webpEncodeSupported !== null) return webpEncodeSupported;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    webpEncodeSupported = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpEncodeSupported = false;
  }
  return webpEncodeSupported;
}

async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

export type CompressAvatarOptions = {
  /** Upper bound on encoded file size (default ~1.95MB). */
  maxBytes?: number;
  /** Base name without extension for the returned File. */
  fileBaseName?: string;
};

/**
 * Produces a JPEG or WebP file suitable for `/api/v1/upload/avatar`.
 * Throws if the image cannot be decoded or compressed enough.
 */
export async function compressImageForAvatarUpload(
  file: File,
  options: CompressAvatarOptions = {},
): Promise<File> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const base = options.fileBaseName ?? 'avatar';

  if (file.size <= maxBytes && /^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
    return file;
  }

  const bitmap = await decodeToBitmap(file).catch(() => {
    throw new Error('Could not read this image. Try a JPEG or PNG photo.');
  });

  try {
    const tryWebpFirst = supportsWebpEncode();
    const formats: { mime: string; ext: string }[] = tryWebpFirst
      ? [
          { mime: 'image/webp', ext: 'webp' },
          { mime: 'image/jpeg', ext: 'jpg' },
        ]
      : [{ mime: 'image/jpeg', ext: 'jpg' }];

    for (const maxEdge of MAX_EDGE_STEPS) {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not process image in this browser.');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, w, h);

      for (const { mime, ext } of formats) {
        let q = 0.92;
        while (q >= 0.42) {
          const blob = await canvasToBlob(canvas, mime, q);
          if (blob && blob.size > 0 && blob.size <= maxBytes) {
            return new File([blob], `${base}.${ext}`, { type: mime });
          }
          q -= 0.06;
        }
      }
    }

    // Last resort: smallest box, lowest acceptable JPEG quality
    const edge = 360;
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image in this browser.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);

    let q = 0.88;
    while (q >= 0.35) {
      const blob = await canvasToBlob(canvas, 'image/jpeg', q);
      if (blob && blob.size > 0 && blob.size <= maxBytes) {
        return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
      }
      q -= 0.05;
    }

    throw new Error('Photo is still too large after compression. Try a different image.');
  } finally {
    bitmap.close();
  }
}

/** Default avatar upload size ceiling (aligned with `compressImageForAvatarUpload`). */
export const AVATAR_UPLOAD_MAX_BYTES = DEFAULT_MAX_BYTES;
