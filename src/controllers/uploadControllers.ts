import { Request, Response } from 'express';
import { 
  uploadBufferToCloudinary, 
  uploadMultipleBuffersToCloudinary, 
  deleteFileFromCloudinary, 
  extractPublicIdFromUrl 
} from '../utils/cloudinaryService';

/**
 * Upload a single file to Cloudinary
 */
export const uploadSingleFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const { folder = 'uploads' } = req.body;

    if (!file) {
      res.status(400).json({ message: 'No file provided' });
      return;
    }

    const resourceType: 'image' | 'video' | 'raw' =
      file.mimetype.startsWith('image/') ? 'image' :
      file.mimetype.startsWith('video/') ? 'video' : 'raw';

    const result = await uploadBufferToCloudinary(
      file.buffer,
      file.originalname,
      folder,
      resourceType
    );

    res.status(200).json({
      message: 'File uploaded successfully',
      url: result.url,
      publicId: result.publicId,
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({ 
      message: 'Failed to upload file', 
      error: error.message 
    });
  }
};

/**
 * Upload multiple files to Cloudinary
 */
export const uploadMultipleFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    const { folder = 'uploads' } = req.body;

    if (!files || files.length === 0) {
      res.status(400).json({ message: 'No files provided' });
      return;
    }

    const fileData = files.map(file => ({
      buffer: file.buffer,
      fileName: file.originalname,
      resourceType: file.mimetype.startsWith('image/')
        ? ('image' as const)
        : file.mimetype.startsWith('video/')
        ? ('video' as const)
        : ('raw' as const),
    }));

    const results = await uploadMultipleBuffersToCloudinary(fileData, folder);

    res.status(200).json({
      message: 'Files uploaded successfully',
      files: results,
    });
  } catch (error: any) {
    console.error('Error uploading files:', error);
    res.status(500).json({ 
      message: 'Failed to upload files', 
      error: error.message 
    });
  }
};

/**
 * Upload application documents (ID and income proof)
 */
export const uploadApplicationDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const uploadResults: { [key: string]: string } = {};

    // Handle ID document
    if (files.idDocument && files.idDocument[0]) {
      const idFile = files.idDocument[0];
    const idResult = await uploadBufferToCloudinary(
      idFile.buffer,
      idFile.originalname,
      'documents/id',
      'raw'
    );
    uploadResults.idDocumentUrl = idResult.url;
    }

    // Handle income proof document
    if (files.incomeProof && files.incomeProof[0]) {
      const incomeFile = files.incomeProof[0];
    const incomeResult = await uploadBufferToCloudinary(
      incomeFile.buffer,
      incomeFile.originalname,
      'documents/income',
      'raw'
    );
    uploadResults.incomeProofUrl = incomeResult.url;
    }

    if (Object.keys(uploadResults).length === 0) {
      res.status(400).json({ message: 'No valid documents provided' });
      return;
    }

    res.status(200).json({
      message: 'Documents uploaded successfully',
      documents: uploadResults,
    });
  } catch (error: any) {
    console.error('Error uploading application documents:', error);
    res.status(500).json({ 
      message: 'Failed to upload documents', 
      error: error.message 
    });
  }
};

/**
 * Upload property photos to Cloudinary
 */
export const uploadPropertyPhotos = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ message: 'No photos provided' });
      return;
    }

    // Validate file types (only images)
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidFiles = files.filter(file => !validImageTypes.includes(file.mimetype));
    
    if (invalidFiles.length > 0) {
      res.status(400).json({ 
        message: 'Invalid file types. Only JPEG, PNG, and WebP images are allowed.',
        invalidFiles: invalidFiles.map(f => f.originalname)
      });
      return;
    }

    const fileData = files.map(file => ({
      buffer: file.buffer,
      fileName: file.originalname,
      resourceType: 'image' as const,
    }));

    const results = await uploadMultipleBuffersToCloudinary(fileData, 'properties/photos');

    res.status(200).json({
      message: 'Property photos uploaded successfully',
      photos: results.map(result => result.url),
    });
  } catch (error: any) {
    console.error('Error uploading property photos:', error);
    res.status(500).json({ 
      message: 'Failed to upload property photos', 
      error: error.message 
    });
  }
};

/**
 * Upload property video to Cloudinary (optional)
 */
export const uploadPropertyVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ message: 'No video file provided' });
      return;
    }

    // Validate file type (only videos)
    const validVideoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    
    if (!validVideoTypes.includes(file.mimetype)) {
      res.status(400).json({ 
        message: 'Invalid file type. Only MP4, MPEG, QuickTime, AVI, and WebM videos are allowed.',
        receivedType: file.mimetype
      });
      return;
    }

    // Check file size (limit to 100MB for videos)
    const maxVideoSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxVideoSize) {
      res.status(400).json({ 
        message: 'Video file too large. Maximum size is 100MB.',
        fileSize: file.size,
        maxSize: maxVideoSize
      });
      return;
    }

    const result = await uploadBufferToCloudinary(
      file.buffer,
      file.originalname,
      'properties/videos',
      'video'
    );

    res.status(200).json({
      message: 'Property video uploaded successfully',
      videoUrl: result.url,
      publicId: result.publicId,
    });
  } catch (error: any) {
    console.error('Error uploading property video:', error);
    res.status(500).json({ 
      message: 'Failed to upload property video', 
      error: error.message 
    });
  }
};

/**
 * Delete a file from Cloudinary
 */
export const deleteFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;

    if (!url) {
      res.status(400).json({ message: 'File URL is required' });
      return;
    }

    const publicId = extractPublicIdFromUrl(url);
    if (!publicId) {
      res.status(400).json({ message: 'Invalid Cloudinary URL' });
      return;
    }

    await deleteFileFromCloudinary(publicId);

    res.status(200).json({
      message: 'File deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    res.status(500).json({ 
      message: 'Failed to delete file', 
      error: error.message 
    });
  }
};