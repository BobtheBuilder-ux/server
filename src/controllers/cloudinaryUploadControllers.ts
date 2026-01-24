import { Request, Response } from 'express';
import {
  processAndStoreImage,
  processAndStoreVideo,
  processAndStoreMultipleImages,
  uploadDocumentToCloudinary,
  uploadLogoForWatermark,
  deleteFileFromCloudinary,
  extractPublicIdFromUrl,
  generateOptimizedUrl,
  ProcessedFileResult
} from '../utils/cloudinaryService';

/**
 * Upload a single file - process through Cloudinary and store in S3
 */
export const uploadSingleFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const { folder = 'uploads', watermark = 'false' } = req.body;
    const addWatermark = watermark === 'true';

    // Determine if it's an image or video
    const isImage = req.file.mimetype.startsWith('image/');
    const isVideo = req.file.mimetype.startsWith('video/');

    let result: ProcessedFileResult;

    if (isImage) {
      result = await processAndStoreImage(
        req.file.path,
        req.file.originalname,
        folder,
        addWatermark
      );
    } else if (isVideo) {
      result = await processAndStoreVideo(
        req.file.path,
        req.file.originalname,
        folder,
        addWatermark
      );
    } else {
      // For documents, upload directly to Cloudinary (raw)
      const docResult = await uploadDocumentToCloudinary(
        req.file.path,
        req.file.originalname,
        folder
      );
      result = {
        s3Url: docResult.url,
        s3Key: docResult.publicId,
        originalUrl: docResult.url,
        publicId: '',
        format: req.file.originalname.split('.').pop() || '',
        resourceType: 'raw',
        bytes: req.file.size
      };
    }

    res.status(200).json({
      message: 'File processed and stored successfully',
      file: result
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message || 'Failed to process and store file' });
  }
};

/**
 * Upload multiple files - process through Cloudinary and store in S3
 */
export const uploadMultipleFiles = async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: 'No files provided' });
    }

    const { folder = 'uploads', watermark = 'false' } = req.body;
    const addWatermark = watermark === 'true';

    const fileData = req.files.map(file => ({
      path: file.path,
      originalname: file.originalname
    }));

    const results = await processAndStoreMultipleImages(
      fileData,
      folder,
      addWatermark
    );

    res.status(200).json({
      message: 'Files processed and stored successfully',
      files: results
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message || 'Failed to process and store files' });
  }
};

/**
 * Upload application documents (ID and income proof)
 */
export const uploadApplicationDocuments = async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const { jobApplicationId } = req.body;

    if (!jobApplicationId) {
      return res.status(400).json({ message: 'Job Application ID is required' });
    }

    const documents: { [key: string]: any } = {};

    // Handle ID document
    if (files.idDocument && files.idDocument[0]) {
      const idDoc = files.idDocument[0];
      const result = await uploadDocumentToCloudinary(
        idDoc.path,
        idDoc.originalname,
        `job-applications/${jobApplicationId}/id`
      );
      documents.idDocument = {
        url: result.url,
        publicId: result.publicId,
        originalName: idDoc.originalname
      };
    }

    // Handle income proof
    if (files.incomeProof && files.incomeProof[0]) {
      const incomeDoc = files.incomeProof[0];
      const result = await uploadDocumentToCloudinary(
        incomeDoc.path,
        incomeDoc.originalname,
        `job-applications/${jobApplicationId}/income`
      );
      documents.incomeProof = {
        url: result.url,
        publicId: result.publicId,
        originalName: incomeDoc.originalname
      };
    }

    if (Object.keys(documents).length === 0) {
      return res.status(400).json({ message: 'At least one document is required' });
    }

    res.status(200).json({
      message: 'Application documents uploaded successfully',
      documents
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message || 'Failed to upload application documents' });
  }
};

/**
 * Upload property photos with watermark
 */
export const uploadPropertyPhotos = async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: 'No photos provided' });
    }

    const { propertyId } = req.body;
    if (!propertyId) {
      return res.status(400).json({ message: 'Property ID is required' });
    }

    const fileData = req.files.map(file => ({
      path: file.path,
      originalname: file.originalname
    }));

    const results = await processAndStoreMultipleImages(
      fileData,
      `properties/${propertyId}/photos`,
      true // Always add watermark for property photos
    );

    res.status(200).json({
      message: 'Property photos processed and stored successfully',
      photos: results
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message || 'Failed to upload property photos' });
  }
};

/**
 * Upload property video with watermark
 */
export const uploadPropertyVideo = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No video provided' });
    }

    const { propertyId } = req.body;
    if (!propertyId) {
      return res.status(400).json({ message: 'Property ID is required' });
    }

    const result = await processAndStoreVideo(
      req.file.path,
      req.file.originalname,
      `properties/${propertyId}/videos`,
      true // Always add watermark for property videos
    );

    res.status(200).json({
      message: 'Property video processed and stored successfully',
      video: result
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message || 'Failed to upload property video' });
  }
};

/**
 * Upload logo for watermarking
 */
export const uploadLogoWatermark = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No logo file provided' });
    }

    const publicId = await uploadLogoForWatermark(req.file.path);

    res.status(200).json({
      message: 'Logo uploaded successfully for watermarking',
      publicId
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message || 'Failed to upload logo for watermarking' });
  }
};

/**
 * Delete a file from Cloudinary
 */
export const deleteFile = async (req: Request, res: Response) => {
  try {
    const { s3Url, s3Key } = req.body;

    if (!s3Url && !s3Key) {
      return res.status(400).json({ message: 'S3 URL or S3 key is required' });
    }

    const publicId = s3Key || extractPublicIdFromUrl(s3Url);
    await deleteFileFromCloudinary(publicId);

    res.status(200).json({
      message: 'File deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message || 'Failed to delete file' });
  }
};

/**
 * Generate optimized URL (for temporary Cloudinary processing)
 */
export const getOptimizedUrl = async (req: Request, res: Response) => {
  try {
    const { publicId, width, height, crop, quality, format, watermark } = req.query;

    if (!publicId) {
      return res.status(400).json({ message: 'Public ID is required' });
    }

    const optimizedUrl = generateOptimizedUrl(publicId as string, {
      width: width ? parseInt(width as string) : undefined,
      height: height ? parseInt(height as string) : undefined,
      crop: crop as string,
      quality: quality as string,
      format: format as string,
      watermark: watermark === 'true'
    });

    res.status(200).json({
      optimizedUrl
    });
  } catch (error: any) {
    console.error('URL generation error:', error);
    res.status(500).json({ message: error.message || 'Failed to generate optimized URL' });
  }
};