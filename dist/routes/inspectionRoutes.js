"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = tslib_1.__importDefault(require("express"));
const drizzle_orm_1 = require("drizzle-orm");
const authMiddleware_1 = require("../middleware/authMiddleware");
const emailSubscriptionService_1 = require("../utils/emailSubscriptionService");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const router = express_1.default.Router();
router.get("/limit/:tenantCognitoId", (0, authMiddleware_1.authMiddleware)(["tenant"]), async (req, res) => {
    try {
        const { tenantCognitoId } = req.params;
        let [inspectionLimit] = await database_1.db.select().from(schema_1.inspectionLimits)
            .where((0, drizzle_orm_1.eq)(schema_1.inspectionLimits.tenantCognitoId, tenantCognitoId))
            .limit(1);
        if (!inspectionLimit) {
            [inspectionLimit] = await database_1.db.insert(schema_1.inspectionLimits)
                .values({
                tenantCognitoId,
                freeInspections: 2,
                usedInspections: 0,
                hasUnlimited: false
            })
                .returning();
        }
        res.json(inspectionLimit);
    }
    catch (error) {
        console.error("Error fetching inspection limit:", error);
        res.status(500).json({ error: "Failed to fetch inspection limit" });
    }
});
router.post("/request", (0, authMiddleware_1.authMiddleware)(["tenant"]), async (req, res) => {
    try {
        const { propertyId, tenantCognitoId, tenantName, tenantEmail, tenantPhone, preferredTime, message, depositPaid = false, depositAmount, paymentReference } = req.body;
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 3);
        let [inspectionLimit] = await database_1.db.select().from(schema_1.inspectionLimits)
            .where((0, drizzle_orm_1.eq)(schema_1.inspectionLimits.tenantCognitoId, tenantCognitoId))
            .limit(1);
        if (!inspectionLimit) {
            [inspectionLimit] = await database_1.db.insert(schema_1.inspectionLimits)
                .values({
                tenantCognitoId,
                freeInspections: 2,
                usedInspections: 0,
                hasUnlimited: false
            })
                .returning();
        }
        const canRequestFree = inspectionLimit.usedInspections < inspectionLimit.freeInspections;
        const hasUnlimited = inspectionLimit.hasUnlimited &&
            (inspectionLimit.unlimitedUntil ? new Date() < inspectionLimit.unlimitedUntil : true);
        if (!canRequestFree && !hasUnlimited && !depositPaid) {
            res.status(400).json({
                error: "Free inspection limit exceeded. Deposit payment required.",
                requiresDeposit: true,
                depositAmount: 0.4
            });
            return;
        }
        const [property] = await database_1.db.select().from(schema_1.properties)
            .where((0, drizzle_orm_1.eq)(schema_1.properties.id, propertyId))
            .limit(1);
        if (!property) {
            res.status(404).json({ error: "Property not found" });
            return;
        }
        const [nearestAgent] = await database_1.db.select().from(schema_1.agents)
            .limit(1);
        const [inspection] = await database_1.db.insert(schema_1.inspections)
            .values({
            propertyId,
            tenantCognitoId,
            scheduledDate,
            tenantName,
            tenantEmail,
            tenantPhone,
            preferredTime,
            message,
            agentId: nearestAgent?.id,
            depositPaid,
            depositAmount,
            paymentReference
        })
            .returning();
        if (!depositPaid && canRequestFree) {
            await database_1.db.update(schema_1.inspectionLimits)
                .set({
                usedInspections: inspectionLimit.usedInspections + 1
            })
                .where((0, drizzle_orm_1.eq)(schema_1.inspectionLimits.tenantCognitoId, tenantCognitoId));
        }
        try {
            const [propertyLocation] = await database_1.db.select({
                address: schema_1.locations.address
            })
                .from(schema_1.properties)
                .innerJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .where((0, drizzle_orm_1.eq)(schema_1.properties.id, propertyId))
                .limit(1);
            if (propertyLocation) {
                await (0, emailSubscriptionService_1.sendInspectionRequestEmail)(tenantEmail, tenantName, propertyLocation.address, scheduledDate.toLocaleDateString(), preferredTime);
                console.log(`Inspection request email sent to tenant: ${tenantEmail}`);
            }
        }
        catch (emailError) {
            console.error('Error sending inspection request email:', emailError);
        }
        res.status(201).json(inspection);
    }
    catch (error) {
        console.error("Error creating inspection:", error);
        res.status(500).json({ error: "Failed to create inspection request" });
    }
});
router.get("/tenant/:tenantCognitoId", (0, authMiddleware_1.authMiddleware)(["tenant"]), async (req, res) => {
    try {
        const { tenantCognitoId } = req.params;
        const inspectionsList = await database_1.db.select().from(schema_1.inspections)
            .where((0, drizzle_orm_1.eq)(schema_1.inspections.tenantCognitoId, tenantCognitoId))
            .orderBy(schema_1.inspections.createdAt);
        res.json(inspectionsList);
    }
    catch (error) {
        console.error("Error fetching tenant inspections:", error);
        res.status(500).json({ error: "Failed to fetch inspections" });
    }
});
router.get("/admin", (0, authMiddleware_1.authMiddleware)(["admin"]), async (_req, res) => {
    try {
        const inspectionsList = await database_1.db.select().from(schema_1.inspections)
            .orderBy(schema_1.inspections.createdAt);
        res.json(inspectionsList);
    }
    catch (error) {
        console.error("Error fetching admin inspections:", error);
        res.status(500).json({ error: "Failed to fetch inspections" });
    }
});
router.put("/:id/status", (0, authMiddleware_1.authMiddleware)(["admin", "agent"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;
        const [inspection] = await database_1.db.update(schema_1.inspections)
            .set({
            status,
            adminNotes,
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.inspections.id, parseInt(id)))
            .returning();
        if (status === 'Approved' && inspection.agentId) {
            try {
                const [propertyWithLocation] = await database_1.db.select({
                    address: schema_1.locations.address
                })
                    .from(schema_1.properties)
                    .innerJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                    .where((0, drizzle_orm_1.eq)(schema_1.properties.id, inspection.propertyId))
                    .limit(1);
                const [agent] = await database_1.db.select({
                    name: schema_1.agents.name,
                    phoneNumber: schema_1.agents.phoneNumber
                })
                    .from(schema_1.agents)
                    .where((0, drizzle_orm_1.eq)(schema_1.agents.id, inspection.agentId))
                    .limit(1);
                if (propertyWithLocation && agent) {
                    await (0, emailSubscriptionService_1.sendInspectionApprovedEmail)(inspection.tenantEmail, inspection.tenantName, propertyWithLocation.address, inspection.scheduledDate.toLocaleDateString(), inspection.preferredTime, agent.name, agent.phoneNumber || 'N/A');
                }
                console.log(`Inspection approved email sent to tenant: ${inspection.tenantEmail}`);
            }
            catch (emailError) {
                console.error('Error sending inspection approved email:', emailError);
            }
        }
        res.json(inspection);
    }
    catch (error) {
        console.error("Error updating inspection status:", error);
        res.status(500).json({ error: "Failed to update inspection status" });
    }
});
router.post("/deposit/payment", (0, authMiddleware_1.authMiddleware)(["tenant"]), async (req, res) => {
    try {
        const { tenantCognitoId, propertyId, paymentReference, amount } = req.body;
        const [property] = await database_1.db.select().from(schema_1.properties)
            .where((0, drizzle_orm_1.eq)(schema_1.properties.id, propertyId))
            .limit(1);
        if (!property) {
            res.status(404).json({ error: "Property not found" });
            return;
        }
        const requiredDeposit = property.pricePerYear * 0.4;
        if (amount < requiredDeposit) {
            res.status(400).json({
                error: "Insufficient deposit amount",
                required: requiredDeposit,
                provided: amount
            });
            return;
        }
        console.log(`Processing deposit payment with reference: ${paymentReference}`);
        const unlimitedUntil = new Date();
        unlimitedUntil.setFullYear(unlimitedUntil.getFullYear() + 1);
        const [inspectionLimit] = await database_1.db.insert(schema_1.inspectionLimits)
            .values({
            tenantCognitoId,
            freeInspections: 2,
            usedInspections: 0,
            hasUnlimited: true,
            unlimitedUntil
        })
            .onConflictDoUpdate({
            target: schema_1.inspectionLimits.tenantCognitoId,
            set: {
                hasUnlimited: true,
                unlimitedUntil
            }
        })
            .returning();
        res.json({
            success: true,
            inspectionLimit,
            paymentReference,
            message: "Deposit processed successfully. You now have unlimited inspections for 1 year."
        });
    }
    catch (error) {
        console.error("Error processing deposit payment:", error);
        res.status(500).json({ error: "Failed to process deposit payment" });
    }
});
exports.default = router;
