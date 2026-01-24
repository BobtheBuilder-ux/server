"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinary = exports.generateOptimizedUrl = exports.extractPublicIdFromUrl = exports.deleteFileFromCloudinary = exports.uploadDocumentToCloudinary = exports.processAndStoreMultipleImages = exports.processAndStoreVideo = exports.processAndStoreImage = exports.uploadMultipleBuffersToCloudinary = exports.uploadBufferToCloudinary = exports.uploadLogoForWatermark = void 0;
const tslib_1 = require("tslib");
const cloudinary_1 = require("cloudinary");
Object.defineProperty(exports, "cloudinary", { enumerable: true, get: function () { return cloudinary_1.v2; } });
const client_s3_1 = require("@aws-sdk/client-s3");
const fs_1 = tslib_1.__importDefault(require("fs"));
const node_fetch_1 = tslib_1.__importDefault(require("node-fetch"));
const stream_1 = require("stream");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const uploadLogoForWatermark = async (logoPath) => {
    try {
        const result = await cloudinary_1.v2.uploader.upload(logoPath, {
            public_id: 'watermark/logo',
            folder: 'watermarks',
            resource_type: 'image',
            overwrite: true,
        });
        return result.public_id;
    }
    catch (error) {
        console.error('Error uploading logo for watermark:', error);
        throw new Error('Failed to upload logo for watermarking');
    }
};
exports.uploadLogoForWatermark = uploadLogoForWatermark;
const uploadBufferToCloudinary = async (buffer, fileName, folder = 'uploads', resourceType = 'raw') => {
    try {
        const result = await new Promise((resolve, reject) => {
            const clStream = cloudinary_1.v2.uploader.upload_stream({
                folder,
                resource_type: resourceType,
                filename_override: fileName,
                use_filename: true,
            }, (error, data) => {
                if (error)
                    return reject(error);
                resolve(data);
            });
            stream_1.Readable.from(buffer).pipe(clStream);
        });
        return {
            url: result.secure_url || result.url,
            publicId: result.public_id,
            resourceType: result.resource_type,
            format: result.format,
            bytes: result.bytes,
        };
    }
    catch (error) {
        console.error('Error uploading buffer to Cloudinary:', error);
        throw new Error('Failed to upload file to Cloudinary');
    }
};
exports.uploadBufferToCloudinary = uploadBufferToCloudinary;
const uploadMultipleBuffersToCloudinary = async (files, folder = 'uploads') => {
    const results = [];
    for (const f of files) {
        try {
            const r = await (0, exports.uploadBufferToCloudinary)(f.buffer, f.fileName, folder, f.resourceType);
            results.push(r);
        }
        catch (err) {
            console.error(`Cloudinary upload failed for ${f.fileName}:`, err);
        }
    }
    return results;
};
exports.uploadMultipleBuffersToCloudinary = uploadMultipleBuffersToCloudinary;
const processAndStoreImage = async (filePath, fileName, folder = 'uploads', addWatermark = false) => {
    try {
        const uploadResult = await cloudinary_1.v2.uploader.upload(filePath, {
            folder: `temp/${folder}`,
            resource_type: 'image',
            quality: 'auto:good',
            fetch_format: 'auto',
        });
        let transformationUrl = cloudinary_1.v2.url(uploadResult.public_id, {
            quality: 'auto:good',
            fetch_format: 'auto',
            width: 1200,
            height: 800,
            crop: 'limit',
        });
        if (addWatermark) {
            transformationUrl = cloudinary_1.v2.url(uploadResult.public_id, {
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
        const response = await (0, node_fetch_1.default)(transformationUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch processed image from Cloudinary');
        }
        const imageBuffer = await response.buffer();
        const finalUpload = await (0, exports.uploadBufferToCloudinary)(imageBuffer, fileName, folder, 'image');
        await cloudinary_1.v2.uploader.destroy(uploadResult.public_id);
        return {
            s3Url: finalUpload.url,
            s3Key: finalUpload.publicId,
            originalUrl: transformationUrl,
            publicId: finalUpload.publicId,
            format: finalUpload.format || 'jpg',
            resourceType: 'image',
            width: uploadResult.width,
            height: uploadResult.height,
            bytes: imageBuffer.length,
        };
    }
    catch (error) {
        console.error('Error processing and storing image:', error);
        throw new Error('Failed to process and store image');
    }
};
exports.processAndStoreImage = processAndStoreImage;
const processAndStoreVideo = async (filePath, fileName, folder = 'uploads', addWatermark = false) => {
    try {
        const uploadResult = await cloudinary_1.v2.uploader.upload(filePath, {
            folder: `temp/${folder}`,
            resource_type: 'video',
            quality: 'auto:good',
        });
        let transformationUrl = cloudinary_1.v2.url(uploadResult.public_id, {
            resource_type: 'video',
            quality: 'auto:good',
            width: 1280,
            height: 720,
            crop: 'limit',
            format: 'mp4',
        });
        if (addWatermark) {
            transformationUrl = cloudinary_1.v2.url(uploadResult.public_id, {
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
        const response = await (0, node_fetch_1.default)(transformationUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch processed video from Cloudinary');
        }
        const videoBuffer = await response.buffer();
        const finalUpload = await (0, exports.uploadBufferToCloudinary)(videoBuffer, fileName, folder, 'video');
        await cloudinary_1.v2.uploader.destroy(uploadResult.public_id, { resource_type: 'video' });
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
    }
    catch (error) {
        console.error('Error processing and storing video:', error);
        throw new Error('Failed to process and store video');
    }
};
exports.processAndStoreVideo = processAndStoreVideo;
const processAndStoreMultipleImages = async (files, folder = 'uploads', addWatermark = false) => {
    const results = [];
    for (const file of files) {
        try {
            const result = await (0, exports.processAndStoreImage)(file.path, file.originalname, folder, addWatermark);
            results.push(result);
        }
        catch (error) {
            console.error(`Error processing file ${file.originalname}:`, error);
        }
    }
    return results;
};
exports.processAndStoreMultipleImages = processAndStoreMultipleImages;
const uploadDocumentToCloudinary = async (filePath, fileName, folder = 'documents') => {
    try {
        const fileBuffer = fs_1.default.readFileSync(filePath);
        const result = await (0, exports.uploadBufferToCloudinary)(fileBuffer, fileName, folder, 'raw');
        return { url: result.url, publicId: result.publicId };
    }
    catch (error) {
        console.error('Error uploading document to Cloudinary:', error);
        throw new Error('Failed to upload document to Cloudinary');
    }
};
exports.uploadDocumentToCloudinary = uploadDocumentToCloudinary;
const deleteFileFromCloudinary = async (publicId, resourceType = 'raw') => {
    try {
        await cloudinary_1.v2.uploader.destroy(publicId, { resource_type: resourceType });
    }
    catch (error) {
        console.error('Error deleting file from Cloudinary:', error);
        throw new Error('Failed to delete file from Cloudinary');
    }
};
exports.deleteFileFromCloudinary = deleteFileFromCloudinary;
const extractPublicIdFromUrl = (cloudinaryUrl) => {
    try {
        const url = new URL(cloudinaryUrl);
        const parts = url.pathname.split('/');
        const last = parts[parts.length - 1];
        const withoutExt = last.replace(/\.[^/.]+$/, '');
        return withoutExt;
    }
    catch {
        return '';
    }
};
exports.extractPublicIdFromUrl = extractPublicIdFromUrl;
const generateOptimizedUrl = (publicId, options = {}) => {
    const transformations = {
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
    return cloudinary_1.v2.url(publicId, transformations);
};
exports.generateOptimizedUrl = generateOptimizedUrl;
