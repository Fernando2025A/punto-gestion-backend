import { Injectable } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  uploadFile(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'uploads' },
        (error, result) => {
          if (error) return reject(error);
          if (!result)
            return reject(
              new Error('Cloudinary upload failed: empty response'),
            ); // Corregido: manejo explícito de result undefined
          resolve(result);
        },
      );
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  async deleteFile(publicId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  extractPublicIdFromUrl(url: string): string | null {
    if (!url || !url.includes('/upload/')) return null;

    try {
      // Separa la URL a partir de '/upload/'
      const afterUpload = url.split('/upload/')[1]; // ej: "v1723700000/uploads/nombre_imagen.jpg"

      // Remueve la versión (v123456789/) si existe
      const withoutVersion = afterUpload.replace(/^v\d+\//, ''); // ej: "uploads/nombre_imagen.jpg"

      // Elimina el parámetro de consulta (query string) si existe
      const withoutQuery = withoutVersion.split('?')[0];

      // Elimina la extensión del archivo (.jpg, .png, .webp, etc.)
      const publicId = withoutQuery.substring(0, withoutQuery.lastIndexOf('.'));

      return publicId; // Retornará exactamente "uploads/nombre_imagen"
    } catch (error) {
      console.error('Error al extraer public_id de la URL:', error);
      return null;
    }
  }
}
