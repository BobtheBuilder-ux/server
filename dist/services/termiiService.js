"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTermiiService = exports.TermiiService = void 0;
const tslib_1 = require("tslib");
const axios_1 = tslib_1.__importDefault(require("axios"));
class TermiiService {
    constructor(config) {
        this.config = config;
    }
    async sendSMS(smsData) {
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
            const response = await axios_1.default.post(`${this.config.baseUrl}/api/sms/send`, payload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Termii SMS Error:', error.response?.data || error.message);
            throw new Error(`Failed to send SMS: ${error.response?.data?.message || error.message}`);
        }
    }
    async sendWhatsApp(whatsappData) {
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
            const response = await axios_1.default.post(`${this.config.baseUrl}/api/sms/send`, payload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Termii WhatsApp Error:', error.response?.data || error.message);
            throw new Error(`Failed to send WhatsApp message: ${error.response?.data?.message || error.message}`);
        }
    }
    async sendBulkSMS(recipients, message, channel = 'generic') {
        try {
            const payload = {
                to: recipients,
                from: this.config.senderId,
                sms: message,
                type: 'plain',
                channel: channel,
                api_key: this.config.apiKey
            };
            const response = await axios_1.default.post(`${this.config.baseUrl}/api/sms/send/bulk`, payload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Termii Bulk SMS Error:', error.response?.data || error.message);
            throw new Error(`Failed to send bulk SMS: ${error.response?.data?.message || error.message}`);
        }
    }
    async getBalance() {
        try {
            const response = await axios_1.default.get(`${this.config.baseUrl}/api/get-balance?api_key=${this.config.apiKey}`);
            return response.data;
        }
        catch (error) {
            console.error('Termii Balance Error:', error.response?.data || error.message);
            throw new Error(`Failed to get balance: ${error.response?.data?.message || error.message}`);
        }
    }
    static formatNigerianPhoneNumber(phoneNumber) {
        let cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.startsWith('234')) {
            return cleaned;
        }
        else if (cleaned.startsWith('0')) {
            return '234' + cleaned.substring(1);
        }
        else if (cleaned.length === 10) {
            return '234' + cleaned;
        }
        return cleaned;
    }
    static isValidNigerianPhoneNumber(phoneNumber) {
        const formatted = this.formatNigerianPhoneNumber(phoneNumber);
        return /^234[789][01]\d{8}$/.test(formatted);
    }
}
exports.TermiiService = TermiiService;
const createTermiiService = () => {
    const config = {
        apiKey: process.env.TERMII_API_KEY || '',
        baseUrl: process.env.TERMII_BASE_URL || 'https://api.ng.termii.com',
        senderId: process.env.TERMII_SENDER_ID || 'HomeMatch'
    };
    if (!config.apiKey) {
        throw new Error('TERMII_API_KEY environment variable is required');
    }
    return new TermiiService(config);
};
exports.createTermiiService = createTermiiService;
