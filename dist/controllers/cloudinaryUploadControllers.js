"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOptimizedUrl = exports.deleteFile = exports.uploadLogoWatermark = exports.uploadPropertyVideo = exports.uploadPropertyPhotos = exports.uploadApplicationDocuments = exports.uploadMultipleFiles = exports.uploadSingleFile = void 0;
const cloudinaryService_1 = require("../utils/cloudinaryService");
const uploadSingleFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file provided' });
        }
        const { folder = 'uploads', watermark = 'false' } = req.body;
        const addWatermark = watermark === 'true';
        const isImage = req.file.mimetype.startsWith('image/');
        const isVideo = req.file.mimetype.startsWith('video/');
        let result;
        if (isImage) {
            result = await (0, cloudinaryService_1.processAndStoreImage)(req.file.path, req.file.originalname, folder, addWatermark);
        }
        else if (isVideo) {
            result = await (0, cloudinaryService_1.processAndStoreVideo)(req.file.path, req.file.originalname, folder, addWatermark);
        }
        else {
            const docResult = await (0, cloudinaryService_1.uploadDocumentToCloudinary)(req.file.path, req.file.originalname, folder);
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
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: error.message || 'Failed to process and store file' });
    }
};
exports.uploadSingleFile = uploadSingleFile;
const uploadMultipleFiles = async (req, res) => {
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
        const results = await (0, cloudinaryService_1.processAndStoreMultipleImages)(fileData, folder, addWatermark);
        res.status(200).json({
            message: 'Files processed and stored successfully',
            files: results
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: error.message || 'Failed to process and store files' });
    }
};
exports.uploadMultipleFiles = uploadMultipleFiles;
const uploadApplicationDocuments = async (req, res) => {
    try {
        const files = req.files;
        const { jobApplicationId } = req.body;
        if (!jobApplicationId) {
            return res.status(400).json({ message: 'Job Application ID is required' });
        }
        const documents = {};
        if (files.idDocument && files.idDocument[0]) {
            const idDoc = files.idDocument[0];
            const result = await (0, cloudinaryService_1.uploadDocumentToCloudinary)(idDoc.path, idDoc.originalname, `job-applications/${jobApplicationId}/id`);
            documents.idDocument = {
                url: result.url,
                publicId: result.publicId,
                originalName: idDoc.originalname
            };
        }
        if (files.incomeProof && files.incomeProof[0]) {
            const incomeDoc = files.incomeProof[0];
            const result = await (0, cloudinaryService_1.uploadDocumentToCloudinary)(incomeDoc.path, incomeDoc.originalname, `job-applications/${jobApplicationId}/income`);
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
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: error.message || 'Failed to upload application documents' });
    }
};
exports.uploadApplicationDocuments = uploadApplicationDocuments;
const uploadPropertyPhotos = async (req, res) => {
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
        const results = await (0, cloudinaryService_1.processAndStoreMultipleImages)(fileData, `properties/${propertyId}/photos`, true);
        res.status(200).json({
            message: 'Property photos processed and stored successfully',
            photos: results
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: error.message || 'Failed to upload property photos' });
    }
};
exports.uploadPropertyPhotos = uploadPropertyPhotos;
const uploadPropertyVideo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No video provided' });
        }
        const { propertyId } = req.body;
        if (!propertyId) {
            return res.status(400).json({ message: 'Property ID is required' });
        }
        const result = await (0, cloudinaryService_1.processAndStoreVideo)(req.file.path, req.file.originalname, `properties/${propertyId}/videos`, true);
        res.status(200).json({
            message: 'Property video processed and stored successfully',
            video: result
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: error.message || 'Failed to upload property video' });
    }
};
exports.uploadPropertyVideo = uploadPropertyVideo;
const uploadLogoWatermark = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No logo file provided' });
        }
        const publicId = await (0, cloudinaryService_1.uploadLogoForWatermark)(req.file.path);
        res.status(200).json({
            message: 'Logo uploaded successfully for watermarking',
            publicId
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: error.message || 'Failed to upload logo for watermarking' });
    }
};
exports.uploadLogoWatermark = uploadLogoWatermark;
const deleteFile = async (req, res) => {
    try {
        const { s3Url, s3Key } = req.body;
        if (!s3Url && !s3Key) {
            return res.status(400).json({ message: 'S3 URL or S3 key is required' });
        }
        const publicId = s3Key || (0, cloudinaryService_1.extractPublicIdFromUrl)(s3Url);
        await (0, cloudinaryService_1.deleteFileFromCloudinary)(publicId);
        res.status(200).json({
            message: 'File deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ message: error.message || 'Failed to delete file' });
    }
};
exports.deleteFile = deleteFile;
const getOptimizedUrl = async (req, res) => {
    try {
        const { publicId, width, height, crop, quality, format, watermark } = req.query;
        if (!publicId) {
            return res.status(400).json({ message: 'Public ID is required' });
        }
        const optimizedUrl = (0, cloudinaryService_1.generateOptimizedUrl)(publicId, {
            width: width ? parseInt(width) : undefined,
            height: height ? parseInt(height) : undefined,
            crop: crop,
            quality: quality,
            format: format,
            watermark: watermark === 'true'
        });
        res.status(200).json({
            optimizedUrl
        });
    }
    catch (error) {
        console.error('URL generation error:', error);
        res.status(500).json({ message: error.message || 'Failed to generate optimized URL' });
    }
};
exports.getOptimizedUrl = getOptimizedUrl;
