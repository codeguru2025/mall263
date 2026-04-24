import { getAccessToken } from '@/lib/token-storage';
import { getApiBaseUrl } from '@/lib/config';

export interface UploadResult {
  key: string;
  url: string;
  cdnUrl: string;
  size: number;
  mimetype: string;
}

async function uploadToEndpoint(
  endpoint: string,
  fileUri: string,
  mimeType: string,
  filename: string,
): Promise<UploadResult> {
  const token = await getAccessToken();
  const formData = new FormData();
  formData.append('file', { uri: fileUri, name: filename, type: mimeType } as unknown as Blob);

  const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => 'Upload failed');
    throw new Error(msg);
  }
  const json = (await res.json()) as UploadResult;
  return { ...json, cdnUrl: json.cdnUrl || json.url };
}

export async function uploadImage(fileUri: string, mimeType = 'image/jpeg'): Promise<string> {
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const result = await uploadToEndpoint('/api/v1/upload/image', fileUri, mimeType, `upload.${ext}`);
  return result.cdnUrl;
}

export async function uploadVideo(fileUri: string, mimeType = 'video/mp4'): Promise<string> {
  const ext = mimeType === 'video/quicktime' ? 'mov' : mimeType.split('/')[1] ?? 'mp4';
  const result = await uploadToEndpoint('/api/v1/upload/video', fileUri, mimeType, `video.${ext}`);
  return result.cdnUrl;
}
