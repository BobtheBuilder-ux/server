import QRCode from 'qrcode';

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export class QRCodeService {
  private static defaultOptions: QRCodeOptions = {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M'
  };

  /**
   * Generate QR code as base64 data URL
   */
  static async generateQRCode(
    text: string, 
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      const qrOptions = { ...this.defaultOptions, ...options };
      
      const qrCodeDataURL = await QRCode.toDataURL(text, {
        width: qrOptions.width,
        margin: qrOptions.margin,
        color: qrOptions.color,
        errorCorrectionLevel: qrOptions.errorCorrectionLevel
      });

      return qrCodeDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate QR code as SVG string
   */
  static async generateQRCodeSVG(
    text: string, 
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      const qrOptions = { ...this.defaultOptions, ...options };
      
      const qrCodeSVG = await QRCode.toString(text, {
        type: 'svg',
        width: qrOptions.width,
        margin: qrOptions.margin,
        color: qrOptions.color,
        errorCorrectionLevel: qrOptions.errorCorrectionLevel
      });

      return qrCodeSVG;
    } catch (error) {
      console.error('Error generating QR code SVG:', error);
      throw new Error('Failed to generate QR code SVG');
    }
  }

  /**
   * Generate tenant registration QR code
   */
  static async generateTenantRegistrationQR(
    registrationLink: string,
    baseUrl: string,
    options: QRCodeOptions = {}
  ): Promise<{ dataURL: string; svg: string; fullUrl: string }> {
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
    } catch (error) {
      console.error('Error generating tenant registration QR code:', error);
      throw new Error('Failed to generate tenant registration QR code');
    }
  }

  /**
   * Generate property-specific tenant registration QR code
   */
  static async generatePropertyTenantRegistrationQR(
    registrationLink: string,
    propertyId: string,
    baseUrl: string,
    options: QRCodeOptions = {}
  ): Promise<{ dataURL: string; svg: string; fullUrl: string }> {
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
    } catch (error) {
      console.error('Error generating property tenant registration QR code:', error);
      throw new Error('Failed to generate property tenant registration QR code');
    }
  }
}