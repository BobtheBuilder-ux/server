"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeasePayments = exports.getPropertyLeases = exports.getLeases = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const getLeases = async (_req, res) => {
    try {
        const leasesData = await database_1.db.select()
            .from(schema_1.leases)
            .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id));
        const leasesWithRelations = leasesData.map(row => ({
            ...row.Lease,
            tenant: row.Tenant,
            property: row.Property
        }));
        res.json(leasesWithRelations);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error retrieving leases: ${error.message}` });
    }
};
exports.getLeases = getLeases;
const getPropertyLeases = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const leasesData = await database_1.db.select()
            .from(schema_1.leases)
            .leftJoin(schema_1.tenants, (0, drizzle_orm_1.eq)(schema_1.leases.tenantCognitoId, schema_1.tenants.cognitoId))
            .leftJoin(schema_1.properties, (0, drizzle_orm_1.eq)(schema_1.leases.propertyId, schema_1.properties.id))
            .where((0, drizzle_orm_1.eq)(schema_1.leases.propertyId, Number(propertyId)));
        const leasesWithRelations = leasesData.map(row => ({
            ...row.Lease,
            tenant: row.Tenant,
            property: row.Property
        }));
        res.json(leasesWithRelations);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error retrieving property leases: ${error.message}` });
    }
};
exports.getPropertyLeases = getPropertyLeases;
const getLeasePayments = async (req, res) => {
    try {
        const { id } = req.params;
        const paymentsData = await database_1.db.select()
            .from(schema_1.payments)
            .where((0, drizzle_orm_1.eq)(schema_1.payments.leaseId, Number(id)));
        res.json(paymentsData);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: `Error retrieving lease payments: ${error.message}` });
    }
};
exports.getLeasePayments = getLeasePayments;
