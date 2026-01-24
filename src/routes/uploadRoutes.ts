import { Router } from 'express';
import multer from 'multer';
import {
  uploadSingleFile,
  uploadMultipleFiles,
  uploadApplicationDocuments,
  uploadPropertyPhotos,
  uploadPropertyVideo,
  deleteFile,
} from '../controllers/uploadControllers';

const router = Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
  fileFilter: (_req, file, cb) => {
    // Allow common file types including videos
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, documents, and videos are allowed.'));
    }
  }
});

// Single file upload
router.post('/single', upload.single('file'), uploadSingleFile);

// Multiple files upload
router.post('/multiple', upload.array('files', 10), uploadMultipleFiles);

// Application documents upload (ID and income proof)
router.post('/application-documents', 
  upload.fields([
    { name: 'idDocument', maxCount: 1 },
    { name: 'incomeProof', maxCount: 1 }
  ]), 
  uploadApplicationDocuments
);

// Property photos upload
router.post('/property-photos', upload.array('photos', 20), uploadPropertyPhotos);

// Property video upload (optional)
router.post('/property-video', upload.single('video'), uploadPropertyVideo);

// Delete file
router.delete('/delete', deleteFile);

export default router;