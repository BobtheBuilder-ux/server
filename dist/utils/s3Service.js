"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractS3Key = exports.getS3Url = exports.deleteFileFromS3 = exports.uploadMultipleFilesToS3 = exports.uploadFileToS3 = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const lib_storage_1 = require("@aws-sdk/lib-storage");
const uuid_1 = require("uuid");
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const uploadFileToS3 = async (file, fileName, mimeType, folder = 'uploads') => {
    try {
        const fileExtension = fileName.split('.').pop();
        const uniqueFileName = `${(0, uuid_1.v4)()}.${fileExtension}`;
        const key = `${folder}/${uniqueFileName}`;
        const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: key,
            Body: file,
            ContentType: mimeType,
        };
        const upload = new lib_storage_1.Upload({
            client: s3Client,
            params: uploadParams,
        });
        const result = await upload.done();
        return {
            url: result.Location || `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
            key: key,
        };
    }
    catch (error) {
        console.error('Error uploading file to S3:', error);
        throw new Error(`Failed to upload file: ${error}`);
    }
};
exports.uploadFileToS3 = uploadFileToS3;
const uploadMultipleFilesToS3 = async (files, folder = 'uploads') => {
    try {
        const uploadPromises = files.map(file => (0, exports.uploadFileToS3)(file.buffer, file.filename, file.mimetype, folder));
        return await Promise.all(uploadPromises);
    }
    catch (error) {
        console.error('Error uploading multiple files to S3:', error);
        throw new Error(`Failed to upload files: ${error}`);
    }
};
exports.uploadMultipleFilesToS3 = uploadMultipleFilesToS3;
const deleteFileFromS3 = async (key) => {
    try {
        const deleteParams = {
            Bucket: BUCKET_NAME,
            Key: key,
        };
        const command = new client_s3_1.DeleteObjectCommand(deleteParams);
        await s3Client.send(command);
    }
    catch (error) {
        console.error('Error deleting file from S3:', error);
        throw new Error(`Failed to delete file: ${error}`);
    }
};
exports.deleteFileFromS3 = deleteFileFromS3;
const getS3Url = (key) => {
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};
exports.getS3Url = getS3Url;
const extractS3Key = (url) => {
    try {
        const urlPattern = new RegExp(`https://${BUCKET_NAME}\.s3\..+\.amazonaws\.com/(.+)`);
        const match = url.match(urlPattern);
        return match ? match[1] : null;
    }
    catch (error) {
        return null;
    }
};
exports.extractS3Key = extractS3Key;
