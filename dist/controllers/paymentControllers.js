"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPayment = exports.getPaymentHistory = exports.verifyPayment = exports.initializePayment = void 0;
const tslib_1 = require("tslib");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const axios_1 = tslib_1.__importDefault(require("axios"));
const emailService_1 = require("../utils/emailService");
const emailTemplates_1 = require("../utils/emailTemplates");
const initializePayment = async (req, res) => {
    try {
        const { leaseId, propertyId, tenantId, amount, email, paymentType } = req.body;
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            res.status(400).json({ message: "Invalid amount" });
            return;
        }
        if (!email) {
            res.status(400).json({ message: "Email is required" });
            return;
        }
        if (!process.env.PAYSTACK_SECRET_KEY) {
            console.error("PAYSTACK_SECRET_KEY is missing");
            res.status(500).json({ message: "Payment service configuration error" });
            return;
        }
        let lease = null;
        let property = null;
        if (paymentType === "initial_payment" || paymentType === "deposit") {
            if (!propertyId) {
                res.status(400).json({ message: "Property ID is required for this payment type" });
                return;
            }
            const propertyResult = await database_1.db.select()
                .from(schema_1.properties)
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                .where((0, drizzle_orm_1.eq)(schema_1.properties.id, Number(propertyId)))
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
            if (!leaseId) {
                res.status(400).json({ message: "Lease ID is required for this payment type" });
                return;
            }
            const leaseResult = await database_1.db.select()
                .from(schema_1.leases)
                .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
                .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                .where((0, drizzle_orm_1.eq)(schema_1.leases.id, Number(leaseId)))
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
            amountDue: Number(amount),
            amountPaid: 0,
            dueDate: new Date(),
            paymentDate: new Date(),
            paymentStatus: "Pending",
            paystackReference: `payment_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            leaseId: (paymentType === "initial_payment" || paymentType === "deposit") ? null : Number(leaseId),
            applicationId: null
        }).returning();
        const reference = `payment_${payment.id}_${Date.now()}`;
        await database_1.db.update(schema_1.payments)
            .set({ paystackReference: reference })
            .where((0, drizzle_orm_1.eq)(schema_1.payments.id, payment.id));
        const amountInKobo = Math.round(Number(amount) * 100);
        const paystackResponse = await axios_1.default.post("https://api.paystack.co/transaction/initialize", {
            reference,
            amount: amountInKobo,
            currency: "NGN",
            email: email,
            callback_url: `${process.env.CLIENT_URL}/payment/callback`,
            metadata: {
                paymentId: payment.id,
                leaseId: (paymentType === "initial_payment" || paymentType === "deposit") ? null : Number(leaseId),
                propertyId: (paymentType === "initial_payment" || paymentType === "deposit") ? Number(propertyId) : null,
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
        if (axios_1.default.isAxiosError(error)) {
            console.error("Paystack API Error:", error.response?.data);
            res.status(500).json({ message: `Payment Gateway Error: ${error.response?.data?.message || error.message}` });
            return;
        }
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
