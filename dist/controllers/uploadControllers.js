"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = exports.uploadPropertyVideo = exports.uploadPropertyPhotos = exports.uploadApplicationDocuments = exports.uploadMultipleFiles = exports.uploadSingleFile = void 0;
const cloudinaryService_1 = require("../utils/cloudinaryService");
const uploadSingleFile = async (req, res) => {
    try {
        const file = req.file;
        const { folder = 'uploads' } = req.body;
        if (!file) {
            res.status(400).json({ message: 'No file provided' });
            return;
        }
        const resourceType = file.mimetype.startsWith('image/') ? 'image' :
            file.mimetype.startsWith('video/') ? 'video' : 'raw';
        const result = await (0, cloudinaryService_1.uploadBufferToCloudinary)(file.buffer, file.originalname, folder, resourceType);
        res.status(200).json({
            message: 'File uploaded successfully',
            url: result.url,
            publicId: result.publicId,
        });
    }
    catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({
            message: 'Failed to upload file',
            error: error.message
        });
    }
};
exports.uploadSingleFile = uploadSingleFile;
const uploadMultipleFiles = async (req, res) => {
    try {
        const files = req.files;
        const { folder = 'uploads' } = req.body;
        if (!files || files.length === 0) {
            res.status(400).json({ message: 'No files provided' });
            return;
        }
        const fileData = files.map(file => ({
            buffer: file.buffer,
            fileName: file.originalname,
            resourceType: file.mimetype.startsWith('image/')
                ? 'image'
                : file.mimetype.startsWith('video/')
                    ? 'video'
                    : 'raw',
        }));
        const results = await (0, cloudinaryService_1.uploadMultipleBuffersToCloudinary)(fileData, folder);
        res.status(200).json({
            message: 'Files uploaded successfully',
            files: results,
        });
    }
    catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({
            message: 'Failed to upload files',
            error: error.message
        });
    }
};
exports.uploadMultipleFiles = uploadMultipleFiles;
const uploadApplicationDocuments = async (req, res) => {
    try {
        const files = req.files;
        const uploadResults = {};
        if (files.idDocument && files.idDocument[0]) {
            const idFile = files.idDocument[0];
            const idResult = await (0, cloudinaryService_1.uploadBufferToCloudinary)(idFile.buffer, idFile.originalname, 'documents/id', 'raw');
            uploadResults.idDocumentUrl = idResult.url;
        }
        if (files.incomeProof && files.incomeProof[0]) {
            const incomeFile = files.incomeProof[0];
            const incomeResult = await (0, cloudinaryService_1.uploadBufferToCloudinary)(incomeFile.buffer, incomeFile.originalname, 'documents/income', 'raw');
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
    }
    catch (error) {
        console.error('Error uploading application documents:', error);
        res.status(500).json({
            message: 'Failed to upload documents',
            error: error.message
        });
    }
};
exports.uploadApplicationDocuments = uploadApplicationDocuments;
const uploadPropertyPhotos = async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            res.status(400).json({ message: 'No photos provided' });
            return;
        }
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
            resourceType: 'image',
        }));
        const results = await (0, cloudinaryService_1.uploadMultipleBuffersToCloudinary)(fileData, 'properties/photos');
        res.status(200).json({
            message: 'Property photos uploaded successfully',
            photos: results.map(result => result.url),
        });
    }
    catch (error) {
        console.error('Error uploading property photos:', error);
        res.status(500).json({
            message: 'Failed to upload property photos',
            error: error.message
        });
    }
};
exports.uploadPropertyPhotos = uploadPropertyPhotos;
const uploadPropertyVideo = async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).json({ message: 'No video file provided' });
            return;
        }
        const validVideoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
        if (!validVideoTypes.includes(file.mimetype)) {
            res.status(400).json({
                message: 'Invalid file type. Only MP4, MPEG, QuickTime, AVI, and WebM videos are allowed.',
                receivedType: file.mimetype
            });
            return;
        }
        const maxVideoSize = 100 * 1024 * 1024;
        if (file.size > maxVideoSize) {
            res.status(400).json({
                message: 'Video file too large. Maximum size is 100MB.',
                fileSize: file.size,
                maxSize: maxVideoSize
            });
            return;
        }
        const result = await (0, cloudinaryService_1.uploadBufferToCloudinary)(file.buffer, file.originalname, 'properties/videos', 'video');
        res.status(200).json({
            message: 'Property video uploaded successfully',
            videoUrl: result.url,
            publicId: result.publicId,
        });
    }
    catch (error) {
        console.error('Error uploading property video:', error);
        res.status(500).json({
            message: 'Failed to upload property video',
            error: error.message
        });
    }
};
exports.uploadPropertyVideo = uploadPropertyVideo;
const deleteFile = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            res.status(400).json({ message: 'File URL is required' });
            return;
        }
        const publicId = (0, cloudinaryService_1.extractPublicIdFromUrl)(url);
        if (!publicId) {
            res.status(400).json({ message: 'Invalid Cloudinary URL' });
            return;
        }
        await (0, cloudinaryService_1.deleteFileFromCloudinary)(publicId);
        res.status(200).json({
            message: 'File deleted successfully',
        });
    }
    catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({
            message: 'Failed to delete file',
            error: error.message
        });
    }
};
exports.deleteFile = deleteFile;
