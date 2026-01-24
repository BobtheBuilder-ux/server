"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPayment = exports.getPaymentHistory = exports.verifyPayment = exports.initializePayment = void 0;
const tslib_1 = require("tslib");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const axios_1 = tslib_1.__importDefault(require("axios"));
const emailService_1 = require("../utils/emailService");
const leaseAgreementGenerator_1 = require("../utils/leaseAgreementGenerator");
const emailTemplates_1 = require("../utils/emailTemplates");
const paymentNotificationService_1 = require("../services/paymentNotificationService");
const initializePayment = async (req, res) => {
    try {
        const { leaseId, propertyId, tenantId, amount, email, paymentType } = req.body;
        let lease = null;
        let property = null;
        if (paymentType === "initial_payment" || paymentType === "deposit") {
            const propertyResult = await database_1.db.select()
                .from(schema_1.properties)
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                .where((0, drizzle_orm_1.eq)(schema_1.properties.id, propertyId))
                .limit(1);
            property = propertyResult[0] ? {
                ...propertyResult[0].Property,
                location: propertyResult[0].Location,
                landlord: propertyResult[0].Landlord
            } : null;
            if (!property) {
                res.status(404).json({ message: "Property not found" });
                return;
            }
            if (paymentType === "initial_payment" && (property.availableUnits <= 0 || property.status !== 'Available')) {
                res.status(409).json({ message: "This property is no longer available" });
                return;
            }
        }
        else {
            const leaseResult = await database_1.db.select()
                .from(schema_1.leases)
                .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
                .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                .where((0, drizzle_orm_1.eq)(schema_1.leases.id, leaseId))
                .limit(1);
            lease = leaseResult[0] ? {
                ...leaseResult[0].Lease,
                tenant: leaseResult[0].Tenant,
                property: {
                    ...leaseResult[0].Property,
                    location: leaseResult[0].Location,
                    landlord: leaseResult[0].Landlord
                }
            } : null;
            if (!lease) {
                res.status(404).json({ message: "Lease not found" });
                return;
            }
        }
        const [payment] = await database_1.db.insert(schema_1.payments).values({
            amountDue: amount,
            amountPaid: 0,
            dueDate: new Date(),
            paymentDate: new Date(),
            paymentStatus: "Pending",
            leaseId: (paymentType === "initial_payment" || paymentType === "deposit") ? null : leaseId
        }).returning();
        const reference = `payment_${payment.id}_${Date.now()}`;
        const amountInKobo = Math.round(Number(amount) * 100);
        const paystackResponse = await axios_1.default.post("https://api.paystack.co/transaction/initialize", {
            reference,
            amount: amountInKobo,
            currency: "NGN",
            email: email,
            callback_url: `${process.env.CLIENT_URL}/payment/callback`,
            metadata: {
                paymentId: payment.id,
                leaseId: (paymentType === "initial_payment" || paymentType === "deposit") ? null : leaseId,
                propertyId: (paymentType === "initial_payment" || paymentType === "deposit") ? propertyId : null,
                paymentType: paymentType,
                tenantId: (paymentType === "initial_payment" || paymentType === "deposit") ? tenantId : lease?.tenantCognitoId
            }
        }, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json"
            }
        });
        res.json({
            paymentId: payment.id,
            url: paystackResponse.data?.data?.authorization_url,
            reference
        });
    }
    catch (error) {
        console.error("Payment initialization error:", error);
        res.status(500).json({ message: `Error initializing payment: ${error.message}` });
    }
};
exports.initializePayment = initializePayment;
const verifyPayment = async (req, res) => {
    try {
        const { reference } = req.params;
        const paystackResponse = await axios_1.default.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
            }
        });
        const paystackData = paystackResponse.data;
        const data = paystackData?.data;
        if (paystackData?.status === true && data?.status === "success") {
            const paymentId = parseInt(data?.metadata?.paymentId, 10);
            const leaseId = data?.metadata?.leaseId ? parseInt(data.metadata.leaseId, 10) : null;
            const propertyId = data?.metadata?.propertyId ? parseInt(data.metadata.propertyId, 10) : null;
            const paymentType = data?.metadata?.paymentType;
            const tenantId = data?.metadata?.tenantId;
            if (isNaN(paymentId)) {
                res.status(400).json({ success: false, message: "Invalid payment ID" });
                return;
            }
            if ((paymentType === "initial_payment" || paymentType === "deposit") && (!propertyId || isNaN(propertyId))) {
                res.status(400).json({ success: false, message: "Invalid or missing property ID for this payment type" });
                return;
            }
            if (data?.metadata?.leaseId && isNaN(leaseId)) {
                res.status(400).json({ success: false, message: "Invalid lease ID" });
                return;
            }
            let updatedPayment;
            if (paymentType === "initial_payment") {
                const propertyResult = await database_1.db.select()
                    .from(schema_1.properties)
                    .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                    .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                    .where((0, drizzle_orm_1.eq)(schema_1.properties.id, propertyId))
                    .limit(1);
                const property = propertyResult[0] ? {
                    ...propertyResult[0].Property,
                    location: propertyResult[0].Location,
                    landlord: propertyResult[0].Landlord
                } : null;
                if (!property) {
                    res.status(404).json({ success: false, message: "Property not found" });
                    return;
                }
                const tenantResult = await database_1.db.select()
                    .from(schema_1.tenants)
                    .where((0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, tenantId || data.customer.email))
                    .limit(1);
                const tenant = tenantResult[0] || null;
                if (!tenant) {
                    res.status(404).json({ success: false, message: "Tenant not found" });
                    return;
                }
                const newLeaseResult = await database_1.db.insert(schema_1.leases).values({
                    rent: property.pricePerYear,
                    deposit: property.securityDeposit,
                    startDate: new Date(),
                    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                    tenantCognitoId: tenant.cognitoId,
                    propertyId: property.id
                }).returning();
                const newLease = {
                    ...newLeaseResult[0],
                    tenant: tenant,
                    property: property
                };
                try {
                    const nextRentDueDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
                    const leaseStartDate = new Date();
                    const leaseEndDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
                    const landlordIdNumeric = property.landlord?.id;
                    const tenantIdNumeric = tenant.id;
                    if (landlordIdNumeric && tenantIdNumeric) {
                        await database_1.db.insert(schema_1.landlordTenantRentals).values({
                            tenantId: tenantIdNumeric,
                            landlordId: landlordIdNumeric,
                            rentAmount: property.pricePerYear,
                            rentDueDate: nextRentDueDate,
                            leaseStartDate,
                            leaseEndDate,
                            paymentMethod: 'Paystack',
                            propertyAddress: property?.location?.address || 'N/A',
                            isRentOverdue: false,
                            applicationFeeAdded: false,
                            securityDepositAdded: !!property.securityDeposit,
                            hasBeenEditedByLandlord: false,
                        }).onConflictDoNothing();
                    }
                }
                catch (rentalErr) {
                    console.error('Failed to create LandlordTenantRental record:', rentalErr);
                }
                await database_1.db.update(schema_1.payments)
                    .set({
                    amountPaid: Number(data.amount) / 100,
                    paymentStatus: "Paid",
                    paymentDate: new Date(),
                    leaseId: newLease.id
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId));
                updatedPayment = {
                    id: paymentId,
                    amountPaid: Number(data.amount) / 100,
                    paymentStatus: "Paid",
                    paymentDate: new Date(),
                    leaseId: newLease.id,
                    lease: newLease
                };
                const currentPropertyResult = await database_1.db.select()
                    .from(schema_1.properties)
                    .where((0, drizzle_orm_1.eq)(schema_1.properties.id, propertyId))
                    .limit(1);
                const currentProperty = currentPropertyResult[0];
                if (currentProperty) {
                    const newUnits = Math.max(0, (currentProperty.availableUnits || 0) - 1);
                    await database_1.db.update(schema_1.properties)
                        .set({ availableUnits: newUnits, status: newUnits === 0 ? 'Closed' : 'Available' })
                        .where((0, drizzle_orm_1.eq)(schema_1.properties.id, propertyId));
                }
                await database_1.db.update(schema_1.applications)
                    .set({ leaseId: newLease.id, status: 'Approved' })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.applications.propertyId, propertyId), (0, drizzle_orm_1.eq)(schema_1.applications.tenantCognitoId, tenant.cognitoId)));
                if (newLease.property.landlord?.email) {
                    await (0, emailService_1.sendEmail)({
                        to: newLease.property.landlord.email,
                        subject: emailTemplates_1.propertyRentedNotificationTemplate.subject,
                        body: emailTemplates_1.propertyRentedNotificationTemplate.body(newLease.property.landlord.name, newLease.property?.location?.address || 'N/A', newLease.tenant.name, newLease.tenant.phoneNumber, newLease.property.pricePerYear)
                    });
                }
            }
            else if (paymentType === "deposit") {
                const propertyResult = await database_1.db.select()
                    .from(schema_1.properties)
                    .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                    .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                    .where((0, drizzle_orm_1.eq)(schema_1.properties.id, propertyId))
                    .limit(1);
                const property = propertyResult[0] ? {
                    ...propertyResult[0].Property,
                    location: propertyResult[0].Location,
                    landlord: propertyResult[0].Landlord
                } : null;
                if (!property) {
                    res.status(404).json({ success: false, message: "Property not found" });
                    return;
                }
                const tenantResult = await database_1.db.select()
                    .from(schema_1.tenants)
                    .where((0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, tenantId))
                    .limit(1);
                const tenant = tenantResult[0] || null;
                if (!tenant) {
                    res.status(404).json({ success: false, message: "Tenant not found" });
                    return;
                }
                await database_1.db.update(schema_1.payments)
                    .set({
                    amountPaid: Number(data.amount) / 100,
                    paymentStatus: "Paid",
                    paymentDate: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId));
                updatedPayment = {
                    id: paymentId,
                    amountPaid: Number(data.amount) / 100,
                    paymentStatus: "Paid",
                    paymentDate: new Date(),
                    lease: null
                };
            }
            else {
                await database_1.db.update(schema_1.payments)
                    .set({
                    amountPaid: Number(data.amount) / 100,
                    paymentStatus: "Paid",
                    paymentDate: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId));
                const leaseResult = await database_1.db.select()
                    .from(schema_1.leases)
                    .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
                    .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
                    .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                    .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                    .where((0, drizzle_orm_1.eq)(schema_1.leases.id, leaseId))
                    .limit(1);
                const lease = leaseResult[0] ? {
                    ...leaseResult[0].Lease,
                    tenant: leaseResult[0].Tenant,
                    property: {
                        ...leaseResult[0].Property,
                        location: leaseResult[0].Location,
                        landlord: leaseResult[0].Landlord
                    }
                } : null;
                updatedPayment = {
                    id: paymentId,
                    amountPaid: Number(data.amount) / 100,
                    paymentStatus: "Paid",
                    paymentDate: new Date(),
                    lease: lease
                };
            }
            if (paymentType === "deposit") {
                const tenantResult = await database_1.db.select()
                    .from(schema_1.tenants)
                    .where((0, drizzle_orm_1.eq)(schema_1.tenants.cognitoId, tenantId))
                    .limit(1);
                const propertyResult = await database_1.db.select()
                    .from(schema_1.properties)
                    .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                    .where((0, drizzle_orm_1.eq)(schema_1.properties.id, propertyId))
                    .limit(1);
                const tenant = tenantResult[0];
                const property = propertyResult[0] ? {
                    ...propertyResult[0].Property,
                    location: propertyResult[0].Location
                } : null;
                if (tenant && property) {
                    await (0, emailService_1.sendEmail)({
                        to: tenant.email,
                        subject: "Deposit Payment Confirmation - Homematch",
                        body: `
              <h2>Deposit Payment Successful!</h2>
              <p>Dear ${tenant.name},</p>
              <p>Your deposit payment of ₦${updatedPayment.amountPaid} has been successfully processed.</p>
              <p>Payment Details:</p>
              <ul>
                <li>Amount: ₦${updatedPayment.amountPaid}</li>
                <li>Property: ${property?.location?.address || 'N/A'}</li>
                <li>Payment Date: ${new Date().toLocaleDateString()}</li>
                <li>Reference: ${reference}</li>
              </ul>
              <p>Your inspection limit has been upgraded to unlimited for one year!</p>
              <p>Thank you for choosing Homematch!</p>
            `
                    });
                }
            }
            else if (updatedPayment.lease) {
                if (paymentType === "initial_payment") {
                    if (!updatedPayment.lease.tenant || !updatedPayment.lease.property) {
                        throw new Error("Incomplete lease data for PDF generation");
                    }
                    const leaseAgreementPDF = await (0, leaseAgreementGenerator_1.generateLeaseAgreement)({
                        tenantName: updatedPayment.lease.tenant.name,
                        tenantEmail: updatedPayment.lease.tenant.email,
                        tenantPhone: updatedPayment.lease.tenant.phoneNumber,
                        propertyAddress: updatedPayment.lease?.property?.location?.address || 'N/A',
                        propertyName: updatedPayment.lease?.property?.name || 'Property',
                        landlordName: updatedPayment.lease?.property?.landlord?.name || 'N/A',
                        landlordEmail: updatedPayment.lease?.property?.landlord?.email || 'N/A',
                        landlordPhone: updatedPayment.lease?.property?.landlord?.phoneNumber || 'N/A',
                        rentAmount: updatedPayment.lease.rent,
                        securityDeposit: updatedPayment.lease.deposit,
                        leaseStartDate: updatedPayment.lease.startDate,
                        leaseEndDate: updatedPayment.lease.endDate,
                        paymentDate: new Date(),
                        paymentReference: reference
                    });
                    await (0, emailService_1.sendEmail)({
                        to: updatedPayment.lease.tenant.email,
                        subject: "🎉 Congratulations! Your Property Payment is Complete - Homematch",
                        body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-size: 24px;">🎉 Congratulations!</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px;">Your property payment has been successfully completed!</p>
                </div>
                
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <h2 style="color: #1f2937; margin-top: 0;">Dear ${updatedPayment.lease.tenant.name},</h2>
                  
                  <p style="color: #4b5563; line-height: 1.6;">We're thrilled to confirm that your payment has been successfully processed! The property is now officially yours, and it has been removed from our search listings.</p>
                  
                  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #1f2937; margin-top: 0;">📋 Payment Summary</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Property:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${updatedPayment.lease.property.name}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Address:</td>
                        <td style="padding: 8px 0; color: #1f2937;">${updatedPayment.lease?.property?.location?.address || 'N/A'}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Yearly Rent:</td>
                        <td style="padding: 8px 0; color: #1f2937;">₦${updatedPayment.lease?.property?.pricePerYear?.toLocaleString?.() || updatedPayment.lease?.property?.pricePerYear}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Application Fee (10%):</td>
                        <td style="padding: 8px 0; color: #1f2937;">₦${updatedPayment.lease?.property?.applicationFee?.toLocaleString?.() || (((updatedPayment.lease?.property?.pricePerYear ?? 0) * 0.10).toLocaleString())}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Caution Fee (15%):</td>
                        <td style="padding: 8px 0; color: #1f2937;">₦${updatedPayment.lease?.property?.securityDeposit?.toLocaleString?.() || (((updatedPayment.lease?.property?.pricePerYear ?? 0) * 0.15).toLocaleString())}</td>
                      </tr>
                      ${updatedPayment.lease?.property?.serviceCharge && updatedPayment.lease.property.serviceCharge > 0 ? `
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Service Charge:</td>
                        <td style="padding: 8px 0; color: #1f2937;">₦${updatedPayment.lease.property.serviceCharge.toLocaleString()}</td>
                      </tr>` : ''}
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Total Amount Paid:</td>
                        <td style="padding: 8px 0; color: #10b981; font-weight: bold; font-size: 18px;">₦${updatedPayment.amountPaid.toLocaleString()}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Payment Date:</td>
                        <td style="padding: 8px 0; color: #1f2937;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Lease Period:</td>
                        <td style="padding: 8px 0; color: #1f2937;">${updatedPayment.lease.startDate.toLocaleDateString()} - ${updatedPayment.lease.endDate.toLocaleDateString()}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Reference:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-family: monospace;">${reference}</td>
                      </tr>
                    </table>
                  </div>
                  
                  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                    <h4 style="color: #92400e; margin: 0 0 10px 0;">📄 Tenancy Agreement Attached</h4>
                    <p style="color: #92400e; margin: 0; font-size: 14px;">Your personalized tenancy agreement is attached to this email. Please review, sign, and keep it for your records.</p>
                  </div>
                  
                  <h3 style="color: #1f2937;">🏠 What's Next?</h3>
                  <ul style="color: #4b5563; line-height: 1.6;">
                    <li>Review and sign your tenancy agreement</li>
                    <li>The property has been removed from search listings</li>
                    <li>You can now access your property details in your dashboard</li>
                    <li>Contact your landlord for move-in arrangements</li>
                  </ul>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.CLIENT_URL}/tenants/residences" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Your Dashboard</a>
                  </div>
                  
                  <p style="color: #4b5563; line-height: 1.6;">If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                  
                  <p style="color: #4b5563; margin-bottom: 0;">Welcome to your new home!</p>
                  <p style="color: #10b981; font-weight: bold;">The Homematch Team</p>
                </div>
              </div>
            `,
                        attachments: [{
                                filename: `Lease_Agreement_${updatedPayment.lease?.property?.name?.replace(/\s+/g, '_') || 'Property'}_${new Date().toISOString().split('T')[0]}.pdf`,
                                content: leaseAgreementPDF,
                                contentType: 'application/pdf'
                            }]
                    });
                }
                else {
                    await (0, emailService_1.sendEmail)({
                        to: updatedPayment.lease?.tenant?.email || '',
                        subject: "Payment Confirmation - Homematch",
                        body: `
              <h2>Payment Successful!</h2>
              <p>Dear ${updatedPayment.lease?.tenant?.name || 'Tenant'},</p>
              <p>Your payment of ₦${updatedPayment.amountPaid} has been successfully processed.</p>
              <p>Payment Details:</p>
              <ul>
                <li>Amount: ₦${updatedPayment.amountPaid}</li>
                <li>Property: ${updatedPayment.lease?.property?.location?.address || 'N/A'}</li>
                <li>Payment Date: ${new Date().toLocaleDateString()}</li>
                <li>Reference: ${reference}</li>
              </ul>
              <p>Thank you for choosing Homematch!</p>
            `
                    });
                }
                try {
                    const paymentNotificationService = new paymentNotificationService_1.PaymentNotificationService();
                    await paymentNotificationService.processPaymentNotifications(updatedPayment.id);
                }
                catch (smsError) {
                    console.error("SMS notification error:", smsError);
                }
            }
            res.json({ success: true, payment: updatedPayment });
        }
        else {
            res.json({ success: false, message: "Payment verification failed" });
        }
    }
    catch (error) {
        console.error("Payment verification error:", error?.response?.data || error);
        res.status(500).json({ success: false, message: `Error verifying payment: ${error.message}` });
    }
};
exports.verifyPayment = verifyPayment;
const getPaymentHistory = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const paymentsResult = await database_1.db.select()
            .from(schema_1.payments)
            .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.payments.leaseId, schema_1.leases.id))
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .where((0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, tenantId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.payments.paymentDate));
        const formattedPayments = paymentsResult.map(result => ({
            ...result.Payment,
            lease: result.Lease ? {
                ...result.Lease,
                property: {
                    ...result.Property,
                    location: result.Location
                }
            } : null
        }));
        res.json(formattedPayments);
    }
    catch (error) {
        res.status(500).json({ message: `Error fetching payment history: ${error.message}` });
    }
};
exports.getPaymentHistory = getPaymentHistory;
const createPayment = async (req, res) => {
    try {
        const { leaseId, amount, dueDate } = req.body;
        const newPayment = await database_1.db.insert(schema_1.payments).values({
            leaseId,
            amountDue: amount,
            amountPaid: 0,
            dueDate: new Date(dueDate),
            paymentDate: new Date(),
            paymentStatus: "Pending"
        }).returning();
        res.status(201).json(newPayment[0]);
    }
    catch (error) {
        res.status(500).json({ message: `Error creating payment: ${error.message}` });
    }
};
exports.createPayment = createPayment;
