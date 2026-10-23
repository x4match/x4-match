import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

export const newsImageUpload = FileInterceptor('image', {
  storage: memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      cb(new BadRequestException('Solo se permiten imágenes'), false);
      return;
    }
    cb(null, true);
  },
});

export function requireNewsImage(file?: Express.Multer.File): Express.Multer.File {
  if (!file?.buffer?.length) throw new BadRequestException('La imagen del banner es obligatoria');
  return file;
}
