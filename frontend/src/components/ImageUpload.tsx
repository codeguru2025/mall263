'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (images.length + files.length > maxImages) {
      toast.error(`You can only upload up to ${maxImages} images`);
      return;
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    const oversized = files.find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      toast.error(`"${oversized.name}" exceeds 5 MB. Please compress or resize it.`);
      return;
    }

    setUploading(true);
    try {
      const uploadPromises = files.map(async (file, index) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post('/api/v1/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        return {
          url: response.data.url,
          cdnUrl: response.data.cdnUrl,
          key: response.data.key,
          alt: file.name,
          isPrimary: images.length === 0 && index === 0,
        };
      });

      const uploadedImages = await Promise.all(uploadPromises);
      onChange([...images, ...uploadedImages]);
      toast.success(`${uploadedImages.length} image(s) uploaded successfully`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload images');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
    } catch (error) {
      toast.error('Failed to remove image');
    }
  };

  const setPrimaryImage = (index: number) => {
    const newImages = images.map((img, i) => ({
      ...img,
      isPrimary: i === index,
    }));
    onChange(newImages);
  };

  return (
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
            className="relative aspect-square rounded-xl overflow-hidden border-2 border-gray-100 group"
          >
            <img
              src={image.cdnUrl || image.url}
              alt={image.alt || `Product image ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {!image.isPrimary && (
                <button
                  type="button"
                  onClick={() => setPrimaryImage(index)}
                  className="px-2 py-1 bg-white text-navy-700 text-xs font-bold rounded-lg hover:bg-gray-100"
                >
                  Set Primary
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
            Upload product images from your gallery. The first image will be the primary image shown to customers.
          </p>
        </div>
      )}
    </div>
  );
}
