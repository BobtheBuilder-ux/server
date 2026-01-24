"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const dotenv_1 = tslib_1.__importDefault(require("dotenv"));
const path_1 = tslib_1.__importDefault(require("path"));
const cloudinary_1 = require("cloudinary");
const fs_1 = tslib_1.__importDefault(require("fs"));
dotenv_1.default.config();
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
async function uploadLogo() {
    try {
        const logoPath = path_1.default.join(__dirname, '../../../client/public/logo.svg');
        console.log('Uploading logo for watermarking...');
        console.log('Logo path:', logoPath);
        if (!fs_1.default.existsSync(logoPath)) {
            throw new Error(`Logo file not found at: ${logoPath}`);
        }
        const result = await cloudinary_1.v2.uploader.upload(logoPath, {
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
    }
    catch (error) {
        console.error('❌ Error uploading logo:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    uploadLogo();
}
exports.default = uploadLogo;
