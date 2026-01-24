"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = require("express");
const multer_1 = tslib_1.__importDefault(require("multer"));
const uploadControllers_1 = require("../controllers/uploadControllers");
const router = (0, express_1.Router)();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
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
        }
        else {
            cb(new Error('Invalid file type. Only images, PDFs, documents, and videos are allowed.'));
        }
    }
});
router.post('/single', upload.single('file'), uploadControllers_1.uploadSingleFile);
router.post('/multiple', upload.array('files', 10), uploadControllers_1.uploadMultipleFiles);
router.post('/application-documents', upload.fields([
    { name: 'idDocument', maxCount: 1 },
    { name: 'incomeProof', maxCount: 1 }
]), uploadControllers_1.uploadApplicationDocuments);
router.post('/property-photos', upload.array('photos', 20), uploadControllers_1.uploadPropertyPhotos);
router.post('/property-video', upload.single('video'), uploadControllers_1.uploadPropertyVideo);
router.delete('/delete', uploadControllers_1.deleteFile);
exports.default = router;
