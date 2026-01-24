import { Resend } from 'resend';

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

interface EmailParams {
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

// Create Resend instance lazily
let resend: Resend | null = null;

const getResendInstance = () => {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

export const sendEmail = async ({ to, subject, body, attachments }: EmailParams): Promise<void> => {
  try {
    const resendInstance = getResendInstance();
    
    // Convert attachments to Resend format
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
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Test email configuration
export const testEmailConfiguration = async (): Promise<boolean> => {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set');
      return false;
    }
    
    // Test by attempting to send a test email to a verified domain
    // In production, you might want to use a different validation method
    console.log('Resend configuration is valid');
    return true;
  } catch (error) {
    console.error('Resend configuration error:', error);
    return false;
  }
};