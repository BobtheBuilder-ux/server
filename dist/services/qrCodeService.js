"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QRCodeService = void 0;
const tslib_1 = require("tslib");
const qrcode_1 = tslib_1.__importDefault(require("qrcode"));
class QRCodeService {
    static async generateQRCode(text, options = {}) {
        try {
            const qrOptions = { ...this.defaultOptions, ...options };
            const qrCodeDataURL = await qrcode_1.default.toDataURL(text, {
                width: qrOptions.width,
                margin: qrOptions.margin,
                color: qrOptions.color,
                errorCorrectionLevel: qrOptions.errorCorrectionLevel
            });
            return qrCodeDataURL;
        }
        catch (error) {
            console.error('Error generating QR code:', error);
            throw new Error('Failed to generate QR code');
        }
    }
    static async generateQRCodeSVG(text, options = {}) {
        try {
            const qrOptions = { ...this.defaultOptions, ...options };
            const qrCodeSVG = await qrcode_1.default.toString(text, {
                type: 'svg',
                width: qrOptions.width,
                margin: qrOptions.margin,
                color: qrOptions.color,
                errorCorrectionLevel: qrOptions.errorCorrectionLevel
            });
            return qrCodeSVG;
        }
        catch (error) {
            console.error('Error generating QR code SVG:', error);
            throw new Error('Failed to generate QR code SVG');
        }
    }
    static async generateTenantRegistrationQR(registrationLink, baseUrl, options = {}) {
        try {
            const fullUrl = `${baseUrl}/register-tenant/${registrationLink}`;
            const [dataURL, svg] = await Promise.all([
                this.generateQRCode(fullUrl, options),
                this.generateQRCodeSVG(fullUrl, options)
            ]);
            return {
                dataURL,
                svg,
                fullUrl
            };
        }
        catch (error) {
            console.error('Error generating tenant registration QR code:', error);
            throw new Error('Failed to generate tenant registration QR code');
        }
    }
    static async generatePropertyTenantRegistrationQR(registrationLink, propertyId, baseUrl, options = {}) {
        try {
            const fullUrl = `${baseUrl}/register-tenant/${registrationLink}?property=${propertyId}`;
            const [dataURL, svg] = await Promise.all([
                this.generateQRCode(fullUrl, options),
                this.generateQRCodeSVG(fullUrl, options)
            ]);
            return {
                dataURL,
                svg,
                fullUrl
            };
        }
        catch (error) {
            console.error('Error generating property tenant registration QR code:', error);
            throw new Error('Failed to generate property tenant registration QR code');
        }
    }
}
exports.QRCodeService = QRCodeService;
QRCodeService.defaultOptions = {
    width: 300,
    margin: 2,
    color: {
        dark: '#000000',
        light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M'
};
