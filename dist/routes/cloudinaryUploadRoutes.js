"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = require("express");
const multer_1 = tslib_1.__importDefault(require("multer"));
const os_1 = tslib_1.__importDefault(require("os"));
const cloudinaryUploadControllers_1 = require("../controllers/cloudinaryUploadControllers");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, os_1.default.tmpdir());
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
});
const upload = (0, multer_1.default)({
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
        }
        else {
            cb(new Error('Invalid file type'));
        }
    },
});
router.post('/single', (0, authMiddleware_1.authMiddleware)(['landlord', 'tenant', 'admin', 'blogger']), upload.single('file'), cloudinaryUploadControllers_1.uploadSingleFile);
router.post('/multiple', (0, authMiddleware_1.authMiddleware)(['landlord', 'tenant', 'admin', 'blogger']), upload.array('files', 20), cloudinaryUploadControllers_1.uploadMultipleFiles);
router.post('/application-documents', (0, authMiddleware_1.authMiddleware)(['tenant']), upload.fields([
    { name: 'idDocument', maxCount: 1 },
    { name: 'incomeProof', maxCount: 1 },
]), cloudinaryUploadControllers_1.uploadApplicationDocuments);
router.post('/property-photos', (0, authMiddleware_1.authMiddleware)(['landlord']), upload.array('photos', 20), cloudinaryUploadControllers_1.uploadPropertyPhotos);
router.post('/property-video', (0, authMiddleware_1.authMiddleware)(['landlord']), upload.single('video'), cloudinaryUploadControllers_1.uploadPropertyVideo);
router.post('/logo-watermark', (0, authMiddleware_1.authMiddleware)(['admin']), upload.single('logo'), cloudinaryUploadControllers_1.uploadLogoWatermark);
router.delete('/delete', (0, authMiddleware_1.authMiddleware)(['landlord', 'tenant', 'admin', 'blogger']), cloudinaryUploadControllers_1.deleteFile);
router.get('/optimize-url', (0, authMiddleware_1.authMiddleware)(['landlord', 'tenant', 'admin', 'blogger']), cloudinaryUploadControllers_1.getOptimizedUrl);
exports.default = router;
