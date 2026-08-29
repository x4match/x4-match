import { BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

let configured = false;

export function ensureCloudinaryConfigured(): void {
  if (configured) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new BadRequestException(
      'Cloudinary no está configurado. Definí CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.',
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  configured = true;
}

export function isCloudinaryUrl(url?: string | null): url is string {
  return !!url && url.includes('res.cloudinary.com');
}

export function extractCloudinaryPublicId(url: string): string | null {
  if (!isCloudinaryUrl(url)) return null;

  const withoutQuery = url.split('?')[0];
  const uploadIndex = withoutQuery.indexOf('/upload/');
  if (uploadIndex === -1) return null;

  let path = withoutQuery.slice(uploadIndex + '/upload/'.length);
  path = path.replace(/^v\d+\//, '');
  const dotIndex = path.lastIndexOf('.');
  if (dotIndex > -1) {
    path = path.slice(0, dotIndex);
  }

  return path || null;
}

export async function uploadImageBuffer(
  file: Express.Multer.File,
  folder: string,
): Promise<UploadApiResponse> {
  ensureCloudinaryConfigured();

  const b64 = file.buffer.toString('base64');
  const dataUri = `data:${file.mimetype};base64,${b64}`;

  return cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'image',
    overwrite: true,
    transformation: [
      { width: 800, height: 800, crop: 'fill', gravity: 'auto' },
      { quality: 'auto:good', fetch_format: 'auto' },
    ],
  });
}

export async function deleteCloudinaryAsset(url?: string | null): Promise<void> {
  if (!url || !isCloudinaryUrl(url)) return;

  ensureCloudinaryConfigured();

  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch {
    // No bloqueamos la subida nueva si falla borrar la anterior.
  }
}
