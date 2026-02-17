import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import {
  uploadSingleFile,
  uploadMultipleFiles,
  uploadApplicationDocuments,
  uploadPropertyPhotos,
  uploadPropertyVideo,
  uploadLogoWatermark,
  deleteFile,
  getOptimizedUrl,
} from '../controllers/cloudinaryUploadControllers';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'application/pdf',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Single file upload to Cloudinary
router.post(
  '/single',
  authMiddleware(['landlord', 'tenant', 'admin', 'blogger']),
  upload.single('file'),
  uploadSingleFile
);

// Multiple files upload to Cloudinary
router.post(
  '/multiple',
  authMiddleware(['landlord', 'tenant', 'admin', 'blogger']),
  upload.array('files', 20),
  uploadMultipleFiles
);

// Application documents upload to Cloudinary (ID and income proof)
router.post(
  '/application-documents',
  authMiddleware(['tenant']),
  upload.fields([
    { name: 'idDocument', maxCount: 1 },
    { name: 'incomeProof', maxCount: 1 },
  ]),
  uploadApplicationDocuments
);

// Property photos upload to Cloudinary with watermark
router.post(
  '/property-photos',
  authMiddleware(['landlord']),
  upload.array('photos', 20),
  uploadPropertyPhotos
);

// Property video upload to Cloudinary with watermark
router.post(
  '/property-video',
  authMiddleware(['landlord']),
  upload.single('video'),
  uploadPropertyVideo
);

// Upload logo watermark to Cloudinary (admin only, one-time setup)
router.post(
  '/logo-watermark',
  authMiddleware(['admin']),
  upload.single('logo'),
  uploadLogoWatermark
);

// Delete file from Cloudinary
router.delete(
  '/delete',
  authMiddleware(['landlord', 'tenant', 'admin', 'blogger']),
  deleteFile
);

// Generate optimized URL for existing Cloudinary asset
router.get(
  '/optimize-url',
  authMiddleware(['landlord', 'tenant', 'admin', 'blogger']),
  getOptimizedUrl
);

export default router;
