import * as cron from 'node-cron';
import { SMSController } from '../controllers/smsController';
import { db } from '../db/index';
import { tenants, leases, payments } from '../db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';

export class CronJobService {
  private smsController: SMSController;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.smsController = new SMSController();
  }

  /**
   * Initialize all cron jobs
   */
  initializeJobs() {
    console.log('Initializing cron jobs...');

    // Daily rent reminder check at 9:00 AM
    this.scheduleRentReminders();

    // Weekly overdue rent reminders on Mondays at 10:00 AM
    this.scheduleOverdueReminders();

    // Monthly lease renewal reminders on the 1st at 9:00 AM
    this.scheduleLeaseRenewalReminders();

    console.log('All cron jobs initialized successfully');
  }

  /**
   * Schedule daily rent reminders
   * Runs every day at 9:00 AM
   */
  private scheduleRentReminders() {
    const job = cron.schedule('0 9 * * *', async () => {
      console.log('Running daily rent reminder check...');
      try {
        await this.sendDailyRentReminders();
      } catch (error) {
        console.error('Error in daily rent reminder job:', error);
      }
    }, {
      timezone: 'Africa/Lagos'
    });

    this.jobs.set('daily-rent-reminders', job);
    job.start();
    console.log('Daily rent reminder job scheduled');
  }

  /**
   * Schedule overdue rent reminders
   * Runs every Monday at 10:00 AM
   */
  private scheduleOverdueReminders() {
    const job = cron.schedule('0 10 * * 1', async () => {
      console.log('Running weekly overdue rent reminder check...');
      try {
        await this.sendOverdueRentReminders();
      } catch (error) {
        console.error('Error in overdue rent reminder job:', error);
      }
    }, {
      timezone: 'Africa/Lagos'
    });

    this.jobs.set('overdue-rent-reminders', job);
    job.start();
    console.log('Overdue rent reminder job scheduled');
  }

  /**
   * Schedule lease renewal reminders
   * Runs on the 1st of every month at 9:00 AM
   */
  private scheduleLeaseRenewalReminders() {
    const job = cron.schedule('0 9 1 * *', async () => {
      console.log('Running monthly lease renewal reminder check...');
      try {
        await this.sendLeaseRenewalReminders();
      } catch (error) {
        console.error('Error in lease renewal reminder job:', error);
      }
    }, {
      timezone: 'Africa/Lagos'
    });

    this.jobs.set('lease-renewal-reminders', job);
    job.start();
    console.log('Lease renewal reminder job scheduled');
  }

  /**
   * Send daily rent reminders to tenants whose rent is due within 7 days
   */
  private async sendDailyRentReminders() {
    try {
      const today = new Date();
      const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Get all active leases with rent due within 7 days
      const upcomingRentDue = await db
        .select({
          tenant: tenants,
          lease: leases,
          payment: payments
        })
        .from(leases)
        .innerJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
        .leftJoin(payments, and(
          eq(payments.leaseId, leases.id),
          eq(payments.paymentStatus, 'Pending')
        ))
        .where(
          and(
            gte(leases.endDate, today), // Active lease
            lte(payments.dueDate, sevenDaysFromNow) // Due within 7 days
          )
        );

      let sentCount = 0;
      let failedCount = 0;

      for (const record of upcomingRentDue) {
        try {
          if (record.tenant.phoneNumber && record.payment) {
            const daysUntilDue = Math.ceil(
              (record.payment.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Create a mock request object for the SMS controller
            const mockReq = {
              body: {
                tenantId: record.tenant.userId,
                daysBeforeDue: daysUntilDue
              }
            } as any;

            const mockRes = {
              json: (data: any) => console.log('Rent reminder sent:', data),
              status: (code: number) => ({
                json: (data: any) => console.error('Rent reminder failed:', data)
              })
            } as any;

            await this.smsController.sendRentReminder(mockReq, mockRes);
            sentCount++;
          }
        } catch (error) {
          console.error(`Failed to send rent reminder to tenant ${record.tenant.userId}:`, error);
          failedCount++;
        }
      }

      console.log(`Daily rent reminders completed: ${sentCount} sent, ${failedCount} failed`);
    } catch (error) {
      console.error('Error in sendDailyRentReminders:', error);
      throw error;
    }
  }

  /**
   * Send overdue rent reminders to tenants with overdue payments
   */
  private async sendOverdueRentReminders() {
    try {
      const today = new Date();

      // Get all overdue payments
      const overduePayments = await db
        .select({
          tenant: tenants,
          lease: leases,
          payment: payments
        })
        .from(payments)
        .innerJoin(leases, eq(payments.leaseId, leases.id))
        .innerJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
        .where(
          and(
            lte(payments.dueDate, today), // Overdue
            eq(payments.paymentStatus, 'Pending') // Still pending
          )
        );

      let sentCount = 0;
      let failedCount = 0;

      for (const record of overduePayments) {
        try {
          if (record.tenant.phoneNumber) {
            const daysOverdue = Math.ceil(
              (today.getTime() - record.payment.dueDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Create a mock request object for the SMS controller
            const mockReq = {
              body: {
                tenantId: record.tenant.userId,
                daysBeforeDue: -daysOverdue // Negative to indicate overdue
              }
            } as any;

            const mockRes = {
              json: (data: any) => console.log('Overdue reminder sent:', data),
              status: (code: number) => ({
                json: (data: any) => console.error('Overdue reminder failed:', data)
              })
            } as any;

            await this.smsController.sendRentReminder(mockReq, mockRes);
            sentCount++;
          }
        } catch (error) {
          console.error(`Failed to send overdue reminder to tenant ${record.tenant.userId}:`, error);
          failedCount++;
        }
      }

      console.log(`Overdue rent reminders completed: ${sentCount} sent, ${failedCount} failed`);
    } catch (error) {
      console.error('Error in sendOverdueRentReminders:', error);
      throw error;
    }
  }

  /**
   * Send lease renewal reminders to tenants whose leases are expiring within 60 days
   */
  private async sendLeaseRenewalReminders() {
    try {
      const today = new Date();
      const sixtyDaysFromNow = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

      // Get all leases expiring within 60 days
      const expiringLeases = await db
        .select({
          tenant: tenants,
          lease: leases
        })
        .from(leases)
        .innerJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
        .where(
          and(
            gte(leases.endDate, today), // Not yet expired
            lte(leases.endDate, sixtyDaysFromNow) // Expiring within 60 days
          )
        );

      let sentCount = 0;
      let failedCount = 0;

      for (const record of expiringLeases) {
        try {
          if (record.tenant.phoneNumber) {
            const daysUntilExpiry = Math.ceil(
              (record.lease.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Create a mock request object for the SMS controller
            const mockReq = {
              body: {
                leaseId: record.lease.id,
                tenantId: record.tenant.cognitoId,
                expiresInDays: daysUntilExpiry
              }
            } as any;

            const mockRes = {
              json: (data: any) => console.log('Renewal reminder sent:', data),
              status: (code: number) => ({
                json: (data: any) => console.error('Renewal reminder failed:', data)
              })
            } as any;

            await this.smsController.sendRenewalRequest(mockReq, mockRes);
            sentCount++;
          }
        } catch (error) {
          console.error(`Failed to send renewal reminder to tenant ${record.tenant.userId}:`, error);
          failedCount++;
        }
      }

      console.log(`Lease renewal reminders completed: ${sentCount} sent, ${failedCount} failed`);
    } catch (error) {
      console.error('Error in sendLeaseRenewalReminders:', error);
      throw error;
    }
  }

  /**
   * Stop a specific cron job
   */
  stopJob(jobName: string) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      console.log(`Stopped cron job: ${jobName}`);
    }
  }

  /**
   * Start a specific cron job
   */
  startJob(jobName: string) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      console.log(`Started cron job: ${jobName}`);
    }
  }

  /**
   * Stop all cron jobs
   */
  stopAllJobs() {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped cron job: ${name}`);
    });
  }

  /**
   * Get status of all cron jobs
   */
  getJobsStatus() {
    const status: Record<string, boolean> = {};
    this.jobs.forEach((job, name) => {
      status[name] = job.getStatus() === 'scheduled';
    });
    return status;
  }

  /**
   * Manually trigger a specific job (for testing)
   */
  async triggerJob(jobName: string) {
    switch (jobName) {
      case 'daily-rent-reminders':
        await this.sendDailyRentReminders();
        break;
      case 'overdue-rent-reminders':
        await this.sendOverdueRentReminders();
        break;
      case 'lease-renewal-reminders':
        await this.sendLeaseRenewalReminders();
        break;
      default:
        throw new Error(`Unknown job name: ${jobName}`);
    }
  }
}