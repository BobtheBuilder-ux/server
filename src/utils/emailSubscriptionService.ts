import { eq, and, desc } from 'drizzle-orm';
import { sendEmail } from './emailService';
import { surveyConfirmationTemplate, welcomeToEmailListTemplate, inspectionRequestTemplate, inspectionApprovedTemplate, tenantWelcomeTemplate, landlordWelcomeTemplate, adminWelcomeTemplate, inspectionRequestAdminTemplate, negotiationRequestAdminTemplate, viewingRequestAdminTemplate } from './emailTemplates';
import { db, emailSubscriptions } from './database';
import { admins } from '../db/schema';

// Helper to get admin emails
const getAdminEmails = async (): Promise<string[]> => {
  try {
    const adminUsers = await db.select({ email: admins.email }).from(admins);
    return adminUsers.map(a => a.email);
  } catch (error) {
    console.error('Error fetching admin emails:', error);
    return [];
  }
};

export const sendInspectionRequestToAdminEmail = async (
  tenantName: string,
  propertyAddress: string,
  scheduledDate: string,
  preferredTime: string,
  tenantEmail: string,
  tenantPhone: string
): Promise<void> => {
  try {
    const adminEmails = await getAdminEmails();
    if (adminEmails.length === 0) return;

    for (const email of adminEmails) {
      await sendEmail({
        to: email,
        subject: inspectionRequestAdminTemplate.subject,
        body: inspectionRequestAdminTemplate.body(tenantName, propertyAddress, scheduledDate, preferredTime, tenantEmail, tenantPhone)
      });
    }
    console.log(`Inspection request email sent to admins: ${adminEmails.join(', ')}`);
  } catch (error) {
    console.error('Error sending inspection request email to admin:', error);
    // Don't throw, just log
  }
};

export const sendNegotiationRequestToAdminEmail = async (
  nameOrCompany: string,
  proposedPrice: string,
  contactEmail: string,
  contactPhone: string,
  listingTitle: string
): Promise<void> => {
  try {
    const adminEmails = await getAdminEmails();
    if (adminEmails.length === 0) return;

    for (const email of adminEmails) {
      await sendEmail({
        to: email,
        subject: negotiationRequestAdminTemplate.subject,
        body: negotiationRequestAdminTemplate.body(nameOrCompany, proposedPrice, contactEmail, contactPhone, listingTitle)
      });
    }
    console.log(`Negotiation request email sent to admins: ${adminEmails.join(', ')}`);
  } catch (error) {
    console.error('Error sending negotiation request email to admin:', error);
    // Don't throw
  }
};


export const sendViewingRequestToAdminEmail = async (
  name: string,
  listingTitle: string,
  date: string,
  time: string,
  contactEmail: string,
  contactPhone: string,
  message?: string
): Promise<void> => {
  try {
    const adminEmails = await getAdminEmails();
    if (adminEmails.length === 0) return;

    for (const email of adminEmails) {
      await sendEmail({
        to: email,
        subject: viewingRequestAdminTemplate.subject,
        body: viewingRequestAdminTemplate.body(name, listingTitle, date, time, contactEmail, contactPhone, message)
      });
    }
    console.log(`Viewing request email sent to admins: ${adminEmails.join(', ')}`);
  } catch (error) {
    console.error('Error sending viewing request email to admin:', error);
    // Don't throw
  }
};

export interface EmailSubscriptionData {
  email: string;
  fullName: string;
  subscriptionType: 'tenant_survey' | 'landlord_survey' | 'newsletter';
}

export const addToEmailList = async (data: EmailSubscriptionData): Promise<void> => {
  try {
    // Check if email already exists
    const existingSubscriptionResult = await db.select().from(emailSubscriptions)
      .where(eq(emailSubscriptions.email, data.email))
      .limit(1);
    const existingSubscription = existingSubscriptionResult[0];

    if (existingSubscription) {
      // Update existing subscription if it was previously unsubscribed
      if (!existingSubscription.isActive) {
        await db.update(emailSubscriptions)
          .set({
            isActive: true,
            subscriptionType: data.subscriptionType,
            fullName: data.fullName,
            subscribedAt: new Date(),
            unsubscribedAt: null
          })
          .where(eq(emailSubscriptions.email, data.email));
        console.log(`Reactivated email subscription for: ${data.email}`);
      } else {
        console.log(`Email already subscribed: ${data.email}`);
      }
    } else {
      // Create new subscription
      await db.insert(emailSubscriptions).values({
        email: data.email,
        fullName: data.fullName,
        subscriptionType: data.subscriptionType,
        isActive: true
      });
      console.log(`Added new email subscription: ${data.email}`);
    }
  } catch (error) {
    console.error('Error adding to email list:', error);
    throw error;
  }
};

export const sendSurveyConfirmationEmail = async (
  email: string,
  fullName: string,
  surveyType: 'tenant' | 'landlord'
): Promise<void> => {
  try {
    const template = surveyConfirmationTemplate[surveyType];
    
    await sendEmail({
      to: email,
      subject: template.subject,
      body: template.body(fullName)
    });
    
    console.log(`Survey confirmation email sent to: ${email}`);
  } catch (error) {
    console.error('Error sending survey confirmation email:', error);
    throw error;
  }
};

export const sendWelcomeEmail = async (
  email: string,
  fullName: string,
  subscriptionType: string
): Promise<void> => {
  try {
    await sendEmail({
      to: email,
      subject: welcomeToEmailListTemplate.subject,
      body: welcomeToEmailListTemplate.body(fullName, subscriptionType)
    });
    
    console.log(`Welcome email sent to: ${email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

export const unsubscribeFromEmailList = async (email: string): Promise<void> => {
  try {
    await db.update(emailSubscriptions)
      .set({
        isActive: false,
        unsubscribedAt: new Date()
      })
      .where(eq(emailSubscriptions.email, email));
    
    console.log(`Unsubscribed email: ${email}`);
  } catch (error) {
    console.error('Error unsubscribing from email list:', error);
    throw error;
  }
};

export const getEmailSubscriptions = async (subscriptionType?: string) => {
  try {
    const whereCondition = subscriptionType 
      ? and(eq(emailSubscriptions.subscriptionType, subscriptionType), eq(emailSubscriptions.isActive, true))
      : eq(emailSubscriptions.isActive, true);
    
    return await db.select().from(emailSubscriptions)
      .where(whereCondition)
      .orderBy(desc(emailSubscriptions.subscribedAt));
  } catch (error) {
    console.error('Error fetching email subscriptions:', error);
    throw error;
  }
};

export const sendInspectionRequestEmail = async (
  tenantEmail: string,
  tenantName: string,
  propertyAddress: string,
  scheduledDate: string,
  preferredTime: string
): Promise<void> => {
  try {
    await sendEmail({
      to: tenantEmail,
      subject: inspectionRequestTemplate.subject,
      body: inspectionRequestTemplate.body(tenantName, propertyAddress, scheduledDate, preferredTime)
    });
    
    console.log(`Inspection request email sent to: ${tenantEmail}`);
  } catch (error) {
    console.error('Error sending inspection request email:', error);
    throw error;
  }
};

export const sendInspectionApprovedEmail = async (
  tenantEmail: string,
  tenantName: string,
  propertyAddress: string,
  scheduledDate: string,
  preferredTime: string,
  agentName: string,
  agentPhone: string
): Promise<void> => {
  try {
    await sendEmail({
      to: tenantEmail,
      subject: inspectionApprovedTemplate.subject,
      body: inspectionApprovedTemplate.body(tenantName, propertyAddress, scheduledDate, preferredTime, agentName, agentPhone)
    });
    
    console.log(`Inspection approved email sent to: ${tenantEmail}`);
  } catch (error) {
    console.error('Error sending inspection approved email:', error);
    throw error;
  }
};

export const sendTenantWelcomeEmail = async (
  tenantEmail: string,
  tenantName: string
): Promise<void> => {
  try {
    await sendEmail({
      to: tenantEmail,
      subject: tenantWelcomeTemplate.subject,
      body: tenantWelcomeTemplate.body(tenantName)
    });
    
    console.log(`Tenant welcome email sent to: ${tenantEmail}`);
  } catch (error) {
    console.error('Error sending tenant welcome email:', error);
    throw error;
  }
};

export const sendLandlordWelcomeEmail = async (
  landlordEmail: string,
  landlordName: string
): Promise<void> => {
  try {
    await sendEmail({
      to: landlordEmail,
      subject: landlordWelcomeTemplate.subject,
      body: landlordWelcomeTemplate.body(landlordName)
    });
    
    console.log(`Landlord welcome email sent to: ${landlordEmail}`);
  } catch (error) {
    console.error('Error sending landlord welcome email:', error);
    throw error;
  }
};

export const sendAdminWelcomeEmail = async (
  adminEmail: string,
  adminName: string,
  temporaryPassword: string
): Promise<void> => {
  try {
    await sendEmail({
      to: adminEmail,
      subject: adminWelcomeTemplate.subject,
      body: adminWelcomeTemplate.body(adminName, adminEmail, temporaryPassword)
    });
    
    console.log(`Admin welcome email sent to: ${adminEmail}`);
  } catch (error) {
    console.error('Error sending admin welcome email:', error);
    throw error;
  }
};