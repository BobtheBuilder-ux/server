import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Upload a file to S3
 * @param file - The file buffer or stream
 * @param fileName - Original filename
 * @param mimeType - File MIME type
 * @param folder - S3 folder path (e.g., 'documents', 'photos', 'properties')
 * @returns Promise with upload result containing URL and key
 */
export const uploadFileToS3 = async (
  file: Buffer,
  fileName: string,
  mimeType: string,
  folder: string = 'uploads'
): Promise<UploadResult> => {
  try {
    // Generate unique filename to avoid conflicts
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const key = `${folder}/${uniqueFileName}`;

    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: mimeType,
    };

    const upload = new Upload({
      client: s3Client,
      params: uploadParams,
    });

    const result = await upload.done();
    
    return {
      url: result.Location || `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      key: key,
    };
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error(`Failed to upload file: ${error}`);
  }
};

/**
 * Upload multiple files to S3
 * @param files - Array of file objects with buffer, filename, and mimetype
 * @param folder - S3 folder path
 * @returns Promise with array of upload results
 */
export const uploadMultipleFilesToS3 = async (
  files: Array<{ buffer: Buffer; filename: string; mimetype: string }>,
  folder: string = 'uploads'
): Promise<UploadResult[]> => {
  try {
    const uploadPromises = files.map(file => 
      uploadFileToS3(file.buffer, file.filename, file.mimetype, folder)
    );
    
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading multiple files to S3:', error);
    throw new Error(`Failed to upload files: ${error}`);
  }
};

/**
 * Delete a file from S3
 * @param key - S3 object key
 * @returns Promise
 */
export const deleteFileFromS3 = async (key: string): Promise<void> => {
  try {
    const deleteParams = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    const command = new DeleteObjectCommand(deleteParams);
    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw new Error(`Failed to delete file: ${error}`);
  }
};

/**
 * Get the S3 URL for a given key
 * @param key - S3 object key
 * @returns S3 URL
 */
export const getS3Url = (key: string): string => {
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

/**
 * Extract S3 key from URL
 * @param url - S3 URL
 * @returns S3 key or null if invalid URL
 */
export const extractS3Key = (url: string): string | null => {
  try {
    const urlPattern = new RegExp(`https://${BUCKET_NAME}\.s3\..+\.amazonaws\.com/(.+)`);
    const match = url.match(urlPattern);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
};