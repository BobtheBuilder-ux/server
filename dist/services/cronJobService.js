"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronJobService = void 0;
const tslib_1 = require("tslib");
const cron = tslib_1.__importStar(require("node-cron"));
const smsController_1 = require("../controllers/smsController");
const index_1 = require("../db/index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
class CronJobService {
    constructor() {
        this.jobs = new Map();
        this.smsController = new smsController_1.SMSController();
    }
    initializeJobs() {
        console.log('Initializing cron jobs...');
        this.scheduleRentReminders();
        this.scheduleOverdueReminders();
        this.scheduleLeaseRenewalReminders();
        console.log('All cron jobs initialized successfully');
    }
    scheduleRentReminders() {
        const job = cron.schedule('0 9 * * *', async () => {
            console.log('Running daily rent reminder check...');
            try {
                await this.sendDailyRentReminders();
            }
            catch (error) {
                console.error('Error in daily rent reminder job:', error);
            }
        }, {
            timezone: 'Africa/Lagos'
        });
        this.jobs.set('daily-rent-reminders', job);
        job.start();
        console.log('Daily rent reminder job scheduled');
    }
    scheduleOverdueReminders() {
        const job = cron.schedule('0 10 * * 1', async () => {
            console.log('Running weekly overdue rent reminder check...');
            try {
                await this.sendOverdueRentReminders();
            }
            catch (error) {
                console.error('Error in overdue rent reminder job:', error);
            }
        }, {
            timezone: 'Africa/Lagos'
        });
        this.jobs.set('overdue-rent-reminders', job);
        job.start();
        console.log('Overdue rent reminder job scheduled');
    }
    scheduleLeaseRenewalReminders() {
        const job = cron.schedule('0 9 1 * *', async () => {
            console.log('Running monthly lease renewal reminder check...');
            try {
                await this.sendLeaseRenewalReminders();
            }
            catch (error) {
                console.error('Error in lease renewal reminder job:', error);
            }
        }, {
            timezone: 'Africa/Lagos'
        });
        this.jobs.set('lease-renewal-reminders', job);
        job.start();
        console.log('Lease renewal reminder job scheduled');
    }
    async sendDailyRentReminders() {
        try {
            const today = new Date();
            const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            const upcomingRentDue = await index_1.db
                .select({
                tenant: schema_1.tenants,
                lease: schema_1.leases,
                payment: schema_1.payments
            })
                .from(schema_1.leases)
                .innerJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
                .leftJoin(schema_1.payments, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.payments.leaseId, schema_1.leases.id), (0, drizzle_orm_1.eq)(schema_1.payments.paymentStatus, 'Pending')))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.leases.endDate, today), (0, drizzle_orm_1.lte)(schema_1.payments.dueDate, sevenDaysFromNow)));
            let sentCount = 0;
            let failedCount = 0;
            for (const record of upcomingRentDue) {
                try {
                    if (record.tenant.phoneNumber && record.payment) {
                        const daysUntilDue = Math.ceil((record.payment.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const mockReq = {
                            body: {
                                tenantId: record.tenant.userId,
                                daysBeforeDue: daysUntilDue
                            }
                        };
                        const mockRes = {
                            json: (data) => console.log('Rent reminder sent:', data),
                            status: (code) => ({
                                json: (data) => console.error('Rent reminder failed:', data)
                            })
                        };
                        await this.smsController.sendRentReminder(mockReq, mockRes);
                        sentCount++;
                    }
                }
                catch (error) {
                    console.error(`Failed to send rent reminder to tenant ${record.tenant.userId}:`, error);
                    failedCount++;
                }
            }
            console.log(`Daily rent reminders completed: ${sentCount} sent, ${failedCount} failed`);
        }
        catch (error) {
            console.error('Error in sendDailyRentReminders:', error);
            throw error;
        }
    }
    async sendOverdueRentReminders() {
        try {
            const today = new Date();
            const overduePayments = await index_1.db
                .select({
                tenant: schema_1.tenants,
                lease: schema_1.leases,
                payment: schema_1.payments
            })
                .from(schema_1.payments)
                .innerJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.payments.leaseId, schema_1.leases.id))
                .innerJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.lte)(schema_1.payments.dueDate, today), (0, drizzle_orm_1.eq)(schema_1.payments.paymentStatus, 'Pending')));
            let sentCount = 0;
            let failedCount = 0;
            for (const record of overduePayments) {
                try {
                    if (record.tenant.phoneNumber) {
                        const daysOverdue = Math.ceil((today.getTime() - record.payment.dueDate.getTime()) / (1000 * 60 * 60 * 24));
                        const mockReq = {
                            body: {
                                tenantId: record.tenant.userId,
                                daysBeforeDue: -daysOverdue
                            }
                        };
                        const mockRes = {
                            json: (data) => console.log('Overdue reminder sent:', data),
                            status: (code) => ({
                                json: (data) => console.error('Overdue reminder failed:', data)
                            })
                        };
                        await this.smsController.sendRentReminder(mockReq, mockRes);
                        sentCount++;
                    }
                }
                catch (error) {
                    console.error(`Failed to send overdue reminder to tenant ${record.tenant.userId}:`, error);
                    failedCount++;
                }
            }
            console.log(`Overdue rent reminders completed: ${sentCount} sent, ${failedCount} failed`);
        }
        catch (error) {
            console.error('Error in sendOverdueRentReminders:', error);
            throw error;
        }
    }
    async sendLeaseRenewalReminders() {
        try {
            const today = new Date();
            const sixtyDaysFromNow = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
            const expiringLeases = await index_1.db
                .select({
                tenant: schema_1.tenants,
                lease: schema_1.leases
            })
                .from(schema_1.leases)
                .innerJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.leases.endDate, today), (0, drizzle_orm_1.lte)(schema_1.leases.endDate, sixtyDaysFromNow)));
            let sentCount = 0;
            let failedCount = 0;
            for (const record of expiringLeases) {
                try {
                    if (record.tenant.phoneNumber) {
                        const daysUntilExpiry = Math.ceil((record.lease.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const mockReq = {
                            body: {
                                leaseId: record.lease.id,
                                tenantId: record.tenant.cognitoId,
                                expiresInDays: daysUntilExpiry
                            }
                        };
                        const mockRes = {
                            json: (data) => console.log('Renewal reminder sent:', data),
                            status: (code) => ({
                                json: (data) => console.error('Renewal reminder failed:', data)
                            })
                        };
                        await this.smsController.sendRenewalRequest(mockReq, mockRes);
                        sentCount++;
                    }
                }
                catch (error) {
                    console.error(`Failed to send renewal reminder to tenant ${record.tenant.userId}:`, error);
                    failedCount++;
                }
            }
            console.log(`Lease renewal reminders completed: ${sentCount} sent, ${failedCount} failed`);
        }
        catch (error) {
            console.error('Error in sendLeaseRenewalReminders:', error);
            throw error;
        }
    }
    stopJob(jobName) {
        const job = this.jobs.get(jobName);
        if (job) {
            job.stop();
            console.log(`Stopped cron job: ${jobName}`);
        }
    }
    startJob(jobName) {
        const job = this.jobs.get(jobName);
        if (job) {
            job.start();
            console.log(`Started cron job: ${jobName}`);
        }
    }
    stopAllJobs() {
        this.jobs.forEach((job, name) => {
            job.stop();
            console.log(`Stopped cron job: ${name}`);
        });
    }
    getJobsStatus() {
        const status = {};
        this.jobs.forEach((job, name) => {
            status[name] = job.getStatus() === 'scheduled';
        });
        return status;
    }
    async triggerJob(jobName) {
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
exports.CronJobService = CronJobService;
