'use client';

import { useState, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ImageEditorModal } from './ImageEditorModal';

interface ImageUploadProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages?: number;
}

export interface UploadedImage {
  url: string;
  cdnUrl: string;
  key: string;
  alt?: string;
  isPrimary?: boolean;
}

export function ImageUpload({ images, onChange, maxImages = 5 }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [editingSrc, setEditingSrc] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (images.length + files.length > maxImages) {
      toast.error(`You can only upload up to ${maxImages} images`);
      return;
    }

    const MAX_FILE_SIZE = 15 * 1024 * 1024;
    const oversized = files.find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      toast.error(`"${oversized.name}" exceeds 15 MB. Please use a smaller image.`);
      return;
    }

    // Open the first file in the editor; remaining files queued
    setPendingFiles(files.slice(1));
    openEditor(files[0]);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEditor = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setEditingSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleEditorApply = async (blob: Blob) => {
    const src = editingSrc;
    setEditingSrc(null);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'product.webp');

      const response = await api.post('/api/v1/upload/image', formData);

      const newImage: UploadedImage = {
        url: response.data.url,
        cdnUrl: response.data.cdnUrl,
        key: response.data.key,
        alt: 'Product image',
        isPrimary: images.length === 0,
      };
      onChange([...images, newImage]);
      toast.success('Image uploaded');

      // Process next pending file if any
      if (pendingFiles.length > 0) {
        const [next, ...rest] = pendingFiles;
        setPendingFiles(rest);
        openEditor(next);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleEditorCancel = () => {
    setEditingSrc(null);
    setPendingFiles([]);
  };

  const removeImage = async (index: number) => {
    const imageToRemove = images[index];
    try {
      await api.delete(`/api/v1/upload/${imageToRemove.key}`);
      const newImages = images.filter((_, i) => i !== index);
      if (imageToRemove.isPrimary && newImages.length > 0) {
        newImages[0].isPrimary = true;
      }
      onChange(newImages);
      toast.success('Image removed');
    } catch {
      toast.error('Failed to remove image');
    }
  };

  const setPrimaryImage = (index: number) => {
    onChange(images.map((img, i) => ({ ...img, isPrimary: i === index })));
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="label">Product Images</label>
          <span className="text-xs text-gray-500">
            {images.length}/{maxImages} images
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {images.map((image, index) => (
            <div
              key={image.key}
              className="relative aspect-square rounded-2xl overflow-hidden border-2 border-gray-200 bg-checkerboard shadow-sm hover:shadow-md hover:border-gray-400 transition-all group"
            >
              <img
                src={image.cdnUrl || image.url}
                alt={image.alt || `Product image ${index + 1}`}
                className="w-full h-full object-contain p-2"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!image.isPrimary && (
                  <button
                    type="button"
                    onClick={() => setPrimaryImage(index)}
                    className="px-2 py-1 bg-white text-navy-700 text-xs font-bold rounded-lg hover:bg-gray-100"
                  >
                    Primary
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {image.isPrimary && (
                <div className="absolute top-2 left-2 bg-brand-green text-white text-xs font-bold px-2 py-1 rounded-lg">
                  Primary
                </div>
              )}
            </div>
          ))}

          {images.length < maxImages && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-brand-green hover:bg-green-50 transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <div className="w-8 h-8 border-3 border-brand-green border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-500 font-medium">Uploading...</span>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Upload className="w-5 h-5 text-gray-400" />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">Add Image</span>
                </>
              )}
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {images.length === 0 && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl">
            <ImageIcon className="w-4 h-4 text-brand-blue flex-shrink-0 mt-0.5" />
            <p className="text-xs text-brand-blue">
              Tap to add images. You can crop, adjust brightness/contrast, or remove the background before uploading. Max 15 MB per image.
            </p>
          </div>
        )}
      </div>

      {/* Image editor modal — rendered outside grid */}
      <AnimatePresence>
        {editingSrc && (
          <ImageEditorModal
            imageSrc={editingSrc}
            onApply={handleEditorApply}
            onCancel={handleEditorCancel}
          />
        )}
      </AnimatePresence>
    </>
  );
}
