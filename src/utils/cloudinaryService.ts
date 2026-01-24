import { v2 as cloudinary } from 'cloudinary';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import fetch from 'node-fetch';
import { Readable } from 'stream';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

export interface ProcessedFileResult {
  s3Url: string;
  s3Key: string;
  originalUrl: string;
  publicId: string;
  format: string;
  resourceType: string;
  width?: number;
  height?: number;
  bytes: number;
}

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  resourceType: string;
  format?: string;
  bytes?: number;
}

/**
 * Upload logo to Cloudinary for watermarking
 */
export const uploadLogoForWatermark = async (logoPath: string): Promise<string> => {
  try {
    const result = await cloudinary.uploader.upload(logoPath, {
      public_id: 'watermark/logo',
      folder: 'watermarks',
      resource_type: 'image',
      overwrite: true,
    });
    return result.public_id;
  } catch (error) {
    console.error('Error uploading logo for watermark:', error);
    throw new Error('Failed to upload logo for watermarking');
  }
};

/**
 * Upload a buffer directly to Cloudinary
 */
export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  fileName: string,
  folder: string = 'uploads',
  resourceType: 'image' | 'video' | 'raw' = 'raw'
): Promise<CloudinaryUploadResult> => {
  try {
    const result: any = await new Promise((resolve, reject) => {
      const clStream = cloudinary.uploader.upload_stream({
        folder,
        resource_type: resourceType,
        filename_override: fileName,
        use_filename: true,
      }, (error, data) => {
        if (error) return reject(error);
        resolve(data);
      });
      Readable.from(buffer).pipe(clStream);
    });

    return {
      url: result.secure_url || result.url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error) {
    console.error('Error uploading buffer to Cloudinary:', error);
    throw new Error('Failed to upload file to Cloudinary');
  }
};

/**
 * Upload multiple buffers to Cloudinary
 */
export const uploadMultipleBuffersToCloudinary = async (
  files: Array<{ buffer: Buffer; fileName: string; resourceType: 'image' | 'video' | 'raw' }>,
  folder: string = 'uploads'
): Promise<CloudinaryUploadResult[]> => {
  const results: CloudinaryUploadResult[] = [];
  for (const f of files) {
    try {
      const r = await uploadBufferToCloudinary(f.buffer, f.fileName, folder, f.resourceType);
      results.push(r);
    } catch (err) {
      console.error(`Cloudinary upload failed for ${f.fileName}:`, err);
    }
  }
  return results;
};

/**
 * Process image through Cloudinary with watermark and optimization, then store in S3
 */
export const processAndStoreImage = async (
  filePath: string,
  fileName: string,
  folder: string = 'uploads',
  addWatermark: boolean = false
): Promise<ProcessedFileResult> => {
  try {
    // Step 1: Upload to Cloudinary for processing
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      folder: `temp/${folder}`,
      resource_type: 'image',
      quality: 'auto:good',
      fetch_format: 'auto',
    });

    // Step 2: Generate optimized URL with transformations
    let transformationUrl = cloudinary.url(uploadResult.public_id, {
      quality: 'auto:good',
      fetch_format: 'auto',
      width: 1200,
      height: 800,
      crop: 'limit',
    });

    // Add watermark if requested
    if (addWatermark) {
      transformationUrl = cloudinary.url(uploadResult.public_id, {
        quality: 'auto:good',
        fetch_format: 'auto',
        width: 1200,
        height: 800,
        crop: 'limit',
        overlay: 'watermarks:logo_watermark',
        gravity: 'south_east',
        x: 20,
        y: 20,
        opacity: 70,
      });
    }

    // Step 3: Download processed image from Cloudinary
    const response = await fetch(transformationUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch processed image from Cloudinary');
    }
    const imageBuffer = await response.buffer();

    // Step 4: Upload processed content to Cloudinary as final asset (no S3)
    const finalUpload = await uploadBufferToCloudinary(
      imageBuffer,
      fileName,
      folder,
      'image'
    );

    // Step 5: Clean up temporary Cloudinary file
    await cloudinary.uploader.destroy(uploadResult.public_id);

    return {
      s3Url: finalUpload.url, // Backward field name; now Cloudinary URL
      s3Key: finalUpload.publicId, // Backward field name; now Cloudinary publicId
      originalUrl: transformationUrl,
      publicId: finalUpload.publicId,
      format: finalUpload.format || 'jpg',
      resourceType: 'image',
      width: uploadResult.width,
      height: uploadResult.height,
      bytes: imageBuffer.length,
    };
  } catch (error) {
    console.error('Error processing and storing image:', error);
    throw new Error('Failed to process and store image');
  }
};

/**
 * Process video through Cloudinary with watermark and optimization, then store in S3
 */
export const processAndStoreVideo = async (
  filePath: string,
  fileName: string,
  folder: string = 'uploads',
  addWatermark: boolean = false
): Promise<ProcessedFileResult> => {
  try {
    // Step 1: Upload to Cloudinary for processing
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      folder: `temp/${folder}`,
      resource_type: 'video',
      quality: 'auto:good',
    });

    // Step 2: Generate optimized URL with transformations
    let transformationUrl = cloudinary.url(uploadResult.public_id, {
      resource_type: 'video',
      quality: 'auto:good',
      width: 1280,
      height: 720,
      crop: 'limit',
      format: 'mp4',
    });

    // Add watermark if requested
    if (addWatermark) {
      transformationUrl = cloudinary.url(uploadResult.public_id, {
        resource_type: 'video',
        quality: 'auto:good',
        width: 1280,
        height: 720,
        crop: 'limit',
        format: 'mp4',
        overlay: 'watermarks:logo_watermark',
        gravity: 'south_east',
        x: 20,
        y: 20,
        opacity: 70,
      });
    }

    // Step 3: Download processed video from Cloudinary
    const response = await fetch(transformationUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch processed video from Cloudinary');
    }
    const videoBuffer = await response.buffer();

    // Step 4: Upload processed content to Cloudinary as final asset (no S3)
    const finalUpload = await uploadBufferToCloudinary(
      videoBuffer,
      fileName,
      folder,
      'video'
    );

    // Step 5: Clean up temporary Cloudinary file
    await cloudinary.uploader.destroy(uploadResult.public_id, { resource_type: 'video' });

    return {
      s3Url: finalUpload.url,
      s3Key: finalUpload.publicId,
      originalUrl: transformationUrl,
      publicId: finalUpload.publicId,
      format: finalUpload.format || 'mp4',
      resourceType: 'video',
      width: uploadResult.width,
      height: uploadResult.height,
      bytes: videoBuffer.length,
    };
  } catch (error) {
    console.error('Error processing and storing video:', error);
    throw new Error('Failed to process and store video');
  }
};

/**
 * Process multiple images and store in S3
 */
export const processAndStoreMultipleImages = async (
  files: { path: string; originalname: string }[],
  folder: string = 'uploads',
  addWatermark: boolean = false
): Promise<ProcessedFileResult[]> => {
  const results: ProcessedFileResult[] = [];
  
  for (const file of files) {
    try {
      const result = await processAndStoreImage(file.path, file.originalname, folder, addWatermark);
      results.push(result);
    } catch (error) {
      console.error(`Error processing file ${file.originalname}:`, error);
      // Continue with other files even if one fails
    }
  }
  
  return results;
};

/**
 * Upload document directly to S3 without Cloudinary processing
 */
export const uploadDocumentToCloudinary = async (
  filePath: string,
  fileName: string,
  folder: string = 'documents'
): Promise<{ url: string; publicId: string }> => {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const result = await uploadBufferToCloudinary(fileBuffer, fileName, folder, 'raw');
    return { url: result.url, publicId: result.publicId };
  } catch (error) {
    console.error('Error uploading document to Cloudinary:', error);
    throw new Error('Failed to upload document to Cloudinary');
  }
};

/**
 * Delete file from S3
 */
export const deleteFileFromCloudinary = async (publicId: string, resourceType: 'image' | 'video' | 'raw' = 'raw'): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    throw new Error('Failed to delete file from Cloudinary');
  }
};

/**
 * Extract S3 key from S3 URL
 */
export const extractPublicIdFromUrl = (cloudinaryUrl: string): string => {
  // Cloudinary URLs typically contain public_id near the end of the path
  try {
    const url = new URL(cloudinaryUrl);
    const parts = url.pathname.split('/');
    const last = parts[parts.length - 1];
    const withoutExt = last.replace(/\.[^/.]+$/, '');
    return withoutExt;
  } catch {
    return '';
  }
};

/**
 * Generate optimized image URL using Cloudinary (for temporary processing)
 */
export const generateOptimizedUrl = (
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string;
    format?: string;
    watermark?: boolean;
  } = {}
): string => {
  const transformations: any = {
    quality: options.quality || 'auto:good',
    fetch_format: options.format || 'auto',
  };

  if (options.width || options.height) {
    transformations.width = options.width;
    transformations.height = options.height;
    transformations.crop = options.crop || 'limit';
  }

  if (options.watermark) {
    transformations.overlay = 'watermarks:watermark:logo';
    transformations.gravity = 'south_east';
    transformations.x = 20;
    transformations.y = 20;
    transformations.opacity = 70;
  }

  return cloudinary.url(publicId, transformations);
};

export { cloudinary };