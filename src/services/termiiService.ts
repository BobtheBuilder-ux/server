import axios from 'axios';

export interface TermiiConfig {
  apiKey: string;
  baseUrl: string;
  senderId: string;
}

export interface SMSMessage {
  to: string;
  message: string;
  channel?: 'generic' | 'dnd' | 'whatsapp';
  type?: 'plain' | 'unicode';
  media?: {
    url: string;
    caption: string;
  };
}

export interface WhatsAppMessage {
  to: string;
  message: string;
  media?: {
    url: string;
    caption: string;
  };
}

export interface TermiiResponse {
  message_id: string;
  message: string;
  balance: number;
  user: string;
}

export interface WebhookPayload {
  message_id: string;
  phone_number: string;
  message: string;
  sender: string;
  timestamp: string;
  status: 'delivered' | 'failed' | 'sent';
  response?: string; // For interactive responses like YES/NO
}

export class TermiiService {
  private config: TermiiConfig;

  constructor(config: TermiiConfig) {
    this.config = config;
  }

  /**
   * Send SMS message via Termii API
   */
  async sendSMS(smsData: SMSMessage): Promise<TermiiResponse> {
    try {
      const payload = {
        to: smsData.to,
        from: this.config.senderId,
        sms: smsData.message,
        type: smsData.type || 'plain',
        channel: smsData.channel || 'generic',
        api_key: this.config.apiKey,
        ...(smsData.media && { media: smsData.media })
      };

      const response = await axios.post(
        `${this.config.baseUrl}/api/sms/send`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Termii SMS Error:', error.response?.data || error.message);
      throw new Error(`Failed to send SMS: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Send WhatsApp message via Termii API
   */
  async sendWhatsApp(whatsappData: WhatsAppMessage): Promise<TermiiResponse> {
    try {
      const payload = {
        to: whatsappData.to,
        from: this.config.senderId,
        sms: whatsappData.message,
        type: 'plain',
        channel: 'whatsapp',
        api_key: this.config.apiKey,
        ...(whatsappData.media && { media: whatsappData.media })
      };

      const response = await axios.post(
        `${this.config.baseUrl}/api/sms/send`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Termii WhatsApp Error:', error.response?.data || error.message);
      throw new Error(`Failed to send WhatsApp message: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(recipients: string[], message: string, channel: 'generic' | 'dnd' = 'generic'): Promise<TermiiResponse> {
    try {
      const payload = {
        to: recipients,
        from: this.config.senderId,
        sms: message,
        type: 'plain',
        channel: channel,
        api_key: this.config.apiKey
      };

      const response = await axios.post(
        `${this.config.baseUrl}/api/sms/send/bulk`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Termii Bulk SMS Error:', error.response?.data || error.message);
      throw new Error(`Failed to send bulk SMS: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<{ balance: number; currency: string; user: string }> {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}/api/get-balance?api_key=${this.config.apiKey}`
      );

      return response.data;
    } catch (error: any) {
      console.error('Termii Balance Error:', error.response?.data || error.message);
      throw new Error(`Failed to get balance: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verify phone number format for Nigerian numbers
   */
  static formatNigerianPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle different Nigerian number formats
    if (cleaned.startsWith('234')) {
      return cleaned; // Already in international format
    } else if (cleaned.startsWith('0')) {
      return '234' + cleaned.substring(1); // Remove leading 0 and add country code
    } else if (cleaned.length === 10) {
      return '234' + cleaned; // Add country code to 10-digit number
    }
    
    return cleaned;
  }

  /**
   * Validate Nigerian phone number
   */
  static isValidNigerianPhoneNumber(phoneNumber: string): boolean {
    const formatted = this.formatNigerianPhoneNumber(phoneNumber);
    // Nigerian numbers should be 13 digits (234 + 10 digits)
    return /^234[789][01]\d{8}$/.test(formatted);
  }
}

// Default configuration - should be loaded from environment variables
export const createTermiiService = (): TermiiService => {
  const config: TermiiConfig = {
    apiKey: process.env.TERMII_API_KEY || '',
    baseUrl: process.env.TERMII_BASE_URL || 'https://api.ng.termii.com',
    senderId: process.env.TERMII_SENDER_ID || 'HomeMatch'
  };

  if (!config.apiKey) {
    throw new Error('TERMII_API_KEY environment variable is required');
  }

  return new TermiiService(config);
};