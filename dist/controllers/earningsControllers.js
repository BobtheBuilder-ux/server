"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLandlordWithdrawals = exports.createWithdrawalRequest = exports.getLandlordEarnings = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const getLandlordEarnings = async (req, res) => {
    try {
        const { authId: cognitoId } = req.params;
        const propertiesResult = await database_1.db.select()
            .from(schema_1.properties)
            .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
            .leftJoin(schema_1.payments, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.payments.leaseId, schema_1.leases.id), (0, drizzle_orm_1.eq)(schema_1.payments.paymentStatus, "Paid")))
            .where((0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, cognitoId));
        const propertiesWithLeases = propertiesResult.reduce((acc, result) => {
            const property = result.Property;
            const lease = result.Lease;
            const payment = result.Payment;
            let existingProperty = acc.find(p => p.id === property.id);
            if (!existingProperty) {
                existingProperty = {
                    ...property,
                    leases: []
                };
                acc.push(existingProperty);
            }
            if (lease) {
                let existingLease = existingProperty.leases.find((l) => l.id === lease.id);
                if (!existingLease) {
                    existingLease = {
                        ...lease,
                        payments: []
                    };
                    existingProperty.leases.push(existingLease);
                }
                if (payment) {
                    existingLease.payments.push(payment);
                }
            }
            return acc;
        }, []);
        let totalEarnings = 0;
        let totalPropertiesRented = 0;
        let activeLeases = 0;
        const monthlyEarnings = {};
        propertiesWithLeases.forEach((property) => {
            if (property.leases.length > 0) {
                totalPropertiesRented++;
                property.leases.forEach((lease) => {
                    const currentDate = new Date();
                    if (lease.endDate > currentDate) {
                        activeLeases++;
                    }
                    lease.payments.forEach((payment) => {
                        totalEarnings += payment.amountPaid;
                        const monthKey = payment.paymentDate.toISOString().substring(0, 7);
                        monthlyEarnings[monthKey] = (monthlyEarnings[monthKey] || 0) + payment.amountPaid;
                    });
                });
            }
        });
        const pendingWithdrawals = await database_1.db.select()
            .from(schema_1.withdrawals)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.withdrawals.landlordCognitoId, cognitoId), (0, drizzle_orm_1.inArray)(schema_1.withdrawals.status, ["Pending", "Processing"])));
        const totalPendingWithdrawals = pendingWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
        const availableBalance = totalEarnings - totalPendingWithdrawals;
        res.json({
            totalEarnings,
            availableBalance,
            totalPropertiesRented,
            activeLeases,
            totalProperties: propertiesWithLeases.length,
            monthlyEarnings,
            pendingWithdrawals: totalPendingWithdrawals
        });
    }
    catch (error) {
        res.status(500).json({
            message: `Error retrieving landlord earnings: ${error.message}`
        });
    }
};
exports.getLandlordEarnings = getLandlordEarnings;
const createWithdrawalRequest = async (req, res) => {
    try {
        const { authId: cognitoId } = req.params;
        const { amount, bankName, accountNumber, accountName } = req.body;
        if (!amount || !bankName || !accountNumber || !accountName) {
            res.status(400).json({
                message: "Amount, bank name, account number, and account name are required"
            });
            return;
        }
        const landlordResult = await database_1.db.select()
            .from(schema_1.landlords)
            .where((0, drizzle_orm_1.eq)(schema_1.landlords.cognitoId, cognitoId))
            .limit(1);
        const landlord = landlordResult[0];
        if (!landlord) {
            res.status(404).json({ message: "Landlord not found" });
            return;
        }
        const earnings = await getLandlordEarningsData(cognitoId);
        if (amount > earnings.availableBalance) {
            res.status(400).json({
                message: "Insufficient balance for withdrawal"
            });
            return;
        }
        const reference = `WD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const withdrawalResult = await database_1.db.insert(schema_1.withdrawals)
            .values({
            amount,
            landlordCognitoId: cognitoId,
            bankName,
            accountNumber,
            accountName,
            reference,
            status: "Pending"
        })
            .returning();
        const withdrawal = withdrawalResult[0];
        res.status(201).json({
            message: "Withdrawal request created successfully",
            withdrawal
        });
    }
    catch (error) {
        res.status(500).json({
            message: `Error creating withdrawal request: ${error.message}`
        });
    }
};
exports.createWithdrawalRequest = createWithdrawalRequest;
const getLandlordWithdrawals = async (req, res) => {
    try {
        const { authId: cognitoId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const withdrawalsList = await database_1.db.select()
            .from(schema_1.withdrawals)
            .where((0, drizzle_orm_1.eq)(schema_1.withdrawals.landlordCognitoId, cognitoId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.withdrawals.createdAt))
            .offset(skip)
            .limit(Number(limit));
        const [totalWithdrawalsResult] = await database_1.db.select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.withdrawals)
            .where((0, drizzle_orm_1.eq)(schema_1.withdrawals.landlordCognitoId, cognitoId));
        const totalWithdrawals = totalWithdrawalsResult.count;
        res.json({
            withdrawals: withdrawalsList,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalWithdrawals,
                pages: Math.ceil(totalWithdrawals / Number(limit))
            }
        });
    }
    catch (error) {
        res.status(500).json({
            message: `Error retrieving withdrawal history: ${error.message}`
        });
    }
};
exports.getLandlordWithdrawals = getLandlordWithdrawals;
const getLandlordEarningsData = async (cognitoId) => {
    const propertiesResult = await database_1.db.select()
        .from(schema_1.properties)
        .leftJoin(schema_1.leases, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
        .leftJoin(schema_1.payments, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.payments.leaseId, schema_1.leases.id), (0, drizzle_orm_1.eq)(schema_1.payments.paymentStatus, "Paid")))
        .where((0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, cognitoId));
    let totalEarnings = 0;
    propertiesResult.forEach((result) => {
        if (result.Payment) {
            totalEarnings += result.Payment.amountPaid;
        }
    });
    const pendingWithdrawals = await database_1.db.select()
        .from(schema_1.withdrawals)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.withdrawals.landlordCognitoId, cognitoId), (0, drizzle_orm_1.inArray)(schema_1.withdrawals.status, ["Pending", "Processing"])));
    const totalPendingWithdrawals = pendingWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    return {
        totalEarnings,
        availableBalance: totalEarnings - totalPendingWithdrawals
    };
};
