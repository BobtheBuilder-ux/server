"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testEmailConfiguration = exports.sendEmail = void 0;
const resend_1 = require("resend");
let resend = null;
const getResendInstance = () => {
    if (!resend) {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY environment variable is not set');
        }
        resend = new resend_1.Resend(process.env.RESEND_API_KEY);
    }
    return resend;
};
const sendEmail = async ({ to, subject, body, attachments }) => {
    try {
        const resendInstance = getResendInstance();
        const resendAttachments = attachments?.map(attachment => ({
            filename: attachment.filename,
            content: attachment.content,
        })) || [];
        const emailData = {
            from: process.env.RESEND_FROM_EMAIL || 'HomeMatch <noreply@homematch.ng>',
            to: [to],
            subject: subject,
            html: body,
            ...(resendAttachments.length > 0 && { attachments: resendAttachments }),
        };
        const result = await resendInstance.emails.send(emailData);
        console.log('Email sent successfully:', result.data?.id);
    }
    catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};
exports.sendEmail = sendEmail;
const testEmailConfiguration = async () => {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.error('RESEND_API_KEY is not set');
            return false;
        }
        console.log('Resend configuration is valid');
        return true;
    }
    catch (error) {
        console.error('Resend configuration error:', error);
        return false;
    }
};
exports.testEmailConfiguration = testEmailConfiguration;
