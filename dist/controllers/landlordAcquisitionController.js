"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAcquisitionStatus = exports.listAcquisitions = exports.submitAcquisition = void 0;
const database_1 = require("../utils/database");
const drizzle_orm_1 = require("drizzle-orm");
const zod_1 = require("zod");
const createSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(1),
    phoneNumber: zod_1.z.string().regex(/^(\+234|0)[7-9]\d{9}$/),
    address: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    propertyTypes: zod_1.z.array(zod_1.z.string()).min(1),
});
const submitAcquisition = async (req, res) => {
    try {
        const parsed = createSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: "Invalid data", issues: parsed.error.flatten() });
            return;
        }
        const db = database_1.databaseService.getClient();
        const payload = parsed.data;
        const [row] = await db
            .insert(database_1.landlordAcquisitions)
            .values({
            fullName: payload.fullName,
            phoneNumber: payload.phoneNumber,
            address: payload.address,
            email: payload.email,
            propertyTypes: payload.propertyTypes,
        })
            .returning();
        res.status(201).json({ success: true, id: row.id });
    }
    catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
exports.submitAcquisition = submitAcquisition;
const listAcquisitions = async (req, res) => {
    try {
        const db = database_1.databaseService.getClient();
        const search = req.query.search || "";
        const status = req.query.status || undefined;
        const whereClauses = [];
        if (search) {
            const pattern = `%${search}%`;
            whereClauses.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(database_1.landlordAcquisitions.fullName, pattern), (0, drizzle_orm_1.ilike)(database_1.landlordAcquisitions.email, pattern), (0, drizzle_orm_1.ilike)(database_1.landlordAcquisitions.phoneNumber, pattern), (0, drizzle_orm_1.ilike)(database_1.landlordAcquisitions.address, pattern)));
        }
        if (status)
            whereClauses.push((0, drizzle_orm_1.eq)(database_1.landlordAcquisitions.status, status));
        const rows = await db
            .select()
            .from(database_1.landlordAcquisitions)
            .where(whereClauses.length ? (0, drizzle_orm_1.and)(...whereClauses) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(database_1.landlordAcquisitions.createdAt));
        res.json({ acquisitions: rows });
    }
    catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
exports.listAcquisitions = listAcquisitions;
const updateAcquisitionStatus = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const status = req.body?.status;
        if (!id || !["Pending", "Accepted", "Onboarded", "FullyIn"].includes(status)) {
            res.status(400).json({ message: "Invalid request" });
            return;
        }
        const db = database_1.databaseService.getClient();
        const [row] = await db
            .update(database_1.landlordAcquisitions)
            .set({ status, updatedAt: (0, drizzle_orm_1.sql) `NOW()` })
            .where((0, drizzle_orm_1.eq)(database_1.landlordAcquisitions.id, id))
            .returning();
        res.json(row);
    }
    catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
exports.updateAcquisitionStatus = updateAcquisitionStatus;
