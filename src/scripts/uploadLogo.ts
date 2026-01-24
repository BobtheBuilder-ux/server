import dotenv from 'dotenv';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Configure Cloudinary directly in the script
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Script to upload the logo.svg file to Cloudinary for watermarking
 */
async function uploadLogo() {
  try {
    // Path to the logo.svg file in the client's public directory
    const logoPath = path.join(__dirname, '../../../client/public/logo.svg');
    
    console.log('Uploading logo for watermarking...');
    console.log('Logo path:', logoPath);
    
    // Check if logo file exists
    if (!fs.existsSync(logoPath)) {
      throw new Error(`Logo file not found at: ${logoPath}`);
    }
    
    // Upload logo to Cloudinary
    const result = await cloudinary.uploader.upload(logoPath, {
      public_id: 'watermark/logo',
      resource_type: 'image',
      overwrite: true,
      folder: 'watermarks'
    });
    
    console.log('✅ Logo uploaded successfully!');
    console.log('Public ID:', result.public_id);
    console.log('Secure URL:', result.secure_url);
    console.log('You can now use this logo for watermarking images and videos.');
    
    return result.public_id;
    
  } catch (error) {
    console.error('❌ Error uploading logo:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  uploadLogo();
}

export default uploadLogo;