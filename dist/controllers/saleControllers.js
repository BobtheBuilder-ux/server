"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSaleFullPayments = exports.submitSaleFullPayment = exports.getSaleNegotiations = exports.submitSaleViewing = exports.submitSaleNegotiation = exports.verifySaleListing = exports.rejectSaleListing = exports.approveSaleListing = exports.updateSaleListing = exports.getSaleListing = exports.getSaleListings = exports.createSaleListing = exports.saleUpload = void 0;
const tslib_1 = require("tslib");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const cloudinaryService_1 = require("../utils/cloudinaryService");
const emailSubscriptionService_1 = require("../utils/emailSubscriptionService");
const multer_1 = tslib_1.__importDefault(require("multer"));
const storage = multer_1.default.memoryStorage();
exports.saleUpload = (0, multer_1.default)({ storage });
function validateListingPayload(body) {
    const errors = [];
    if (!body.type || !["Land", "Property"].includes(body.type))
        errors.push("Invalid type");
    if (!body.title)
        errors.push("Title is required");
    if (!body.locationAddress)
        errors.push("Location address is required");
    if (!body.city)
        errors.push("City is required");
    if (!body.state)
        errors.push("State is required");
    if (body.price === undefined || body.price === null || isNaN(Number(body.price)))
        errors.push("Valid price (naira) is required");
    return errors;
}
const createSaleListing = async (req, res) => {
    try {
        const body = req.body;
        const errors = validateListingPayload(body);
        if (errors.length)
            return res.status(400).json({ errors });
        const createdByUserId = req.user?.id;
        const userCompany = await database_1.db.query.realEstateCompanies.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.realEstateCompanies.userId, createdByUserId),
        });
        const realEstateCompanyId = userCompany ? userCompany.id : null;
        let proofUrl = null;
        if (req.files && req.files.proof) {
            const proofFile = req.files.proof[0];
            const uploadRes = await (0, cloudinaryService_1.uploadBufferToCloudinary)(proofFile.buffer, proofFile.originalname, "documents/proof", "raw");
            proofUrl = uploadRes.url;
        }
        let imageUrls = [];
        if (req.files && req.files.images) {
            const images = req.files.images;
            const fileData = images.map((f) => ({
                buffer: f.buffer,
                fileName: f.originalname,
                resourceType: "image",
            }));
            const uploadRes = await (0, cloudinaryService_1.uploadMultipleBuffersToCloudinary)(fileData, "properties/photos");
            imageUrls = uploadRes.map((u) => u.url);
        }
        let videoUrls = [];
        if (req.files && req.files.videos) {
            const videos = req.files.videos;
            const fileData = videos.map((f) => ({
                buffer: f.buffer,
                fileName: f.originalname,
                resourceType: "video",
            }));
            const uploadRes = await (0, cloudinaryService_1.uploadMultipleBuffersToCloudinary)(fileData, "properties/videos");
            videoUrls = uploadRes.map((u) => u.url);
        }
        const [inserted] = await database_1.db.insert(schema_1.saleListings).values({
            type: body.type,
            title: body.title,
            description: body.description || null,
            locationAddress: body.locationAddress,
            city: body.city,
            state: body.state,
            country: body.country || "Nigeria",
            coordinates: body.coordinates || null,
            size: body.size ? Number(body.size) : null,
            sizeUnit: body.sizeUnit || "sqm",
            price: Number(body.price),
            currency: "NGN",
            features: body.features || null,
            imageUrls: imageUrls.length ? imageUrls : body.imageUrls || null,
            videoUrls: videoUrls.length ? videoUrls : body.videoUrls || null,
            proofOfOwnershipUrl: proofUrl || body.proofOfOwnershipUrl || null,
            status: "Pending",
            createdByUserId,
            realEstateCompanyId,
            submittedByRole: body.submittedByRole || null,
            propertyType: body.propertyType || null,
            lga: body.lga || null,
            street: body.street || null,
            plotSizeSqm: body.plotSizeSqm ? Number(body.plotSizeSqm) : null,
            numberOfPlots: body.numberOfPlots ? Number(body.numberOfPlots) : 1,
            roadAccess: typeof body.roadAccess === 'string' ? body.roadAccess === 'true' : !!body.roadAccess,
            roadAccessNotes: body.roadAccessNotes || null,
            electricityAvailable: typeof body.electricityAvailable === 'string' ? body.electricityAvailable === 'true' : !!body.electricityAvailable,
            landConditions: body.landConditions ? JSON.parse(body.landConditions) : null,
            surveyPlanNumber: body.surveyPlanNumber || null,
            priceNegotiable: typeof body.priceNegotiable === 'string' ? body.priceNegotiable === 'true' : !!body.priceNegotiable,
            agreedSellingPrice: body.agreedSellingPrice ? Number(body.agreedSellingPrice) : null,
            depositRequired: typeof body.depositRequired === 'string' ? body.depositRequired === 'true' : !!body.depositRequired,
            depositAmount: body.depositAmount ? Number(body.depositAmount) : null,
            paymentOptions: body.paymentOptions ? JSON.parse(body.paymentOptions) : null,
            installmentTerms: body.installmentTerms || null,
            additionalFees: body.additionalFees ? JSON.parse(body.additionalFees) : null,
            paymentInstructions: body.paymentInstructions || null,
            inspectionAllowed: typeof body.inspectionAllowed === 'string' ? body.inspectionAllowed === 'true' : !!body.inspectionAllowed,
            inspectionDays: body.inspectionDays ? JSON.parse(body.inspectionDays) : null,
            inspectionTimeWindow: body.inspectionTimeWindow || null,
            inspectionContactPerson: body.inspectionContactPerson || null,
            inspectionNotes: body.inspectionNotes || null,
        }).returning({
            id: schema_1.saleListings.id,
            type: schema_1.saleListings.type,
            title: schema_1.saleListings.title,
            description: schema_1.saleListings.description,
            locationAddress: schema_1.saleListings.locationAddress,
            city: schema_1.saleListings.city,
            state: schema_1.saleListings.state,
            country: schema_1.saleListings.country,
            coordinates: schema_1.saleListings.coordinates,
            size: schema_1.saleListings.size,
            sizeUnit: schema_1.saleListings.sizeUnit,
            price: schema_1.saleListings.price,
            currency: schema_1.saleListings.currency,
            features: schema_1.saleListings.features,
            imageUrls: schema_1.saleListings.imageUrls,
            videoUrls: schema_1.saleListings.videoUrls,
            proofOfOwnershipUrl: schema_1.saleListings.proofOfOwnershipUrl,
            status: schema_1.saleListings.status,
            createdByUserId: schema_1.saleListings.createdByUserId,
            realEstateCompanyId: schema_1.saleListings.realEstateCompanyId,
            approvedByAdminId: schema_1.saleListings.approvedByAdminId,
            approvedAt: schema_1.saleListings.approvedAt,
            rejectionReason: schema_1.saleListings.rejectionReason,
            createdAt: schema_1.saleListings.createdAt,
            updatedAt: schema_1.saleListings.updatedAt,
        });
        await database_1.db.insert(schema_1.saleListingAuditLog).values({
            listingId: inserted.id,
            action: "Submitted",
            actorUserId: createdByUserId,
            metadata: { title: inserted.title, type: inserted.type },
        });
        if (req.files && req.files.surveyPlan) {
            const survey = req.files.surveyPlan[0];
            const uploadRes = await (0, cloudinaryService_1.uploadBufferToCloudinary)(survey.buffer, survey.originalname, "documents/survey", "raw");
            await database_1.db.insert(schema_1.saleListingDocuments).values({
                listingId: inserted.id,
                docType: "SURVEY_PLAN",
                fileUrl: uploadRes.url,
            });
        }
        if (req.files && req.files.titleDocs) {
            const titleFiles = req.files.titleDocs;
            const types = body.titleDocTypes ? JSON.parse(body.titleDocTypes) : [];
            for (let i = 0; i < titleFiles.length; i++) {
                const f = titleFiles[i];
                const uploadRes = await (0, cloudinaryService_1.uploadBufferToCloudinary)(f.buffer, f.originalname, "documents/title", "raw");
                await database_1.db.insert(schema_1.saleListingDocuments).values({
                    listingId: inserted.id,
                    docType: types[i] || "OTHER",
                    fileUrl: uploadRes.url,
                    otherText: types[i] ? null : (body.otherTitleDocText || null),
                });
            }
        }
        const sellerPayload = {
            listingId: inserted.id,
            name: body.sellerName,
            isCompany: typeof body.isCompany === 'string' ? body.isCompany === 'true' : !!body.isCompany,
            cacNumber: body.cacNumber || null,
            address: body.sellerAddress,
            phone: body.sellerPhone,
            email: body.sellerEmail,
            idType: body.idType,
            idNumber: body.idNumber,
            bankName: body.bankName,
            accountNumber: body.accountNumber,
            accountName: body.accountName,
            signatureUrl: null,
            idFileUrl: null,
        };
        if (req.files && req.files.idUpload) {
            const idF = req.files.idUpload[0];
            const uploadRes = await (0, cloudinaryService_1.uploadBufferToCloudinary)(idF.buffer, idF.originalname, "documents/id", "raw");
            sellerPayload.idFileUrl = uploadRes.url;
        }
        if (req.files && req.files.signature) {
            const sig = req.files.signature[0];
            const uploadRes = await (0, cloudinaryService_1.uploadBufferToCloudinary)(sig.buffer, sig.originalname, "documents/signature", "image");
            sellerPayload.signatureUrl = uploadRes.url;
        }
        await database_1.db.insert(schema_1.saleSellers).values(sellerPayload);
        return res.status(201).json(inserted);
    }
    catch (error) {
        console.error("Error creating sale listing:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.createSaleListing = createSaleListing;
const getSaleListings = async (req, res) => {
    try {
        const { type, search, status, priceMin, priceMax, companyId } = req.query;
        const whereClauses = [];
        if (type)
            whereClauses.push((0, drizzle_orm_1.eq)(schema_1.saleListings.type, type));
        if (status)
            whereClauses.push((0, drizzle_orm_1.eq)(schema_1.saleListings.status, status));
        if (search)
            whereClauses.push((0, drizzle_orm_1.like)(schema_1.saleListings.title, `%${search}%`));
        if (priceMin)
            whereClauses.push((0, drizzle_orm_1.gte)(schema_1.saleListings.price, Number(priceMin)));
        if (priceMax)
            whereClauses.push((0, drizzle_orm_1.lte)(schema_1.saleListings.price, Number(priceMax)));
        if (companyId)
            whereClauses.push((0, drizzle_orm_1.eq)(schema_1.saleListings.realEstateCompanyId, Number(companyId)));
        const listings = await database_1.db.query.saleListings.findMany({
            where: whereClauses.length ? (0, drizzle_orm_1.and)(...whereClauses) : undefined,
            with: {
                company: true,
            },
            orderBy: (listings, { desc }) => [desc(listings.createdAt)],
        });
        return res.status(200).json({ listings });
    }
    catch (error) {
        console.error("Error fetching sale listings:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.getSaleListings = getSaleListings;
const getSaleListing = async (req, res) => {
    try {
        const { id } = req.params;
        let listing;
        if (!isNaN(Number(id))) {
            listing = await database_1.db.query.saleListings.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.saleListings.id, Number(id)),
                with: {
                    company: true,
                }
            });
        }
        else {
            listing = await database_1.db.query.saleListings.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.saleListings.uuid, id),
                with: {
                    company: true,
                }
            });
        }
        if (!listing)
            return res.status(404).json({ error: "Not found" });
        return res.status(200).json(listing);
    }
    catch (error) {
        console.error("Error fetching sale listing:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.getSaleListing = getSaleListing;
const updateSaleListing = async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body;
        let existing;
        if (!isNaN(Number(id))) {
            [existing] = await database_1.db.select().from(schema_1.saleListings).where((0, drizzle_orm_1.eq)(schema_1.saleListings.id, Number(id))).limit(1);
        }
        else {
            [existing] = await database_1.db.select().from(schema_1.saleListings).where((0, drizzle_orm_1.eq)(schema_1.saleListings.uuid, id)).limit(1);
        }
        if (!existing)
            return res.status(404).json({ error: "Not found" });
        const listingId = existing.id;
        const [updated] = await database_1.db.update(schema_1.saleListings).set({
            title: body.title ?? existing.title,
            description: body.description ?? existing.description,
            locationAddress: body.locationAddress ?? existing.locationAddress,
            city: body.city ?? existing.city,
            state: body.state ?? existing.state,
            coordinates: body.coordinates ?? existing.coordinates,
            size: body.size ?? existing.size,
            sizeUnit: body.sizeUnit ?? existing.sizeUnit,
            price: body.price ?? existing.price,
            features: body.features ?? existing.features,
            imageUrls: body.imageUrls ?? existing.imageUrls,
            videoUrls: body.videoUrls ?? existing.videoUrls,
            proofOfOwnershipUrl: body.proofOfOwnershipUrl ?? existing.proofOfOwnershipUrl,
        }).where((0, drizzle_orm_1.eq)(schema_1.saleListings.id, listingId)).returning({
            id: schema_1.saleListings.id,
            type: schema_1.saleListings.type,
            title: schema_1.saleListings.title,
            description: schema_1.saleListings.description,
            locationAddress: schema_1.saleListings.locationAddress,
            city: schema_1.saleListings.city,
            state: schema_1.saleListings.state,
            price: schema_1.saleListings.price,
            imageUrls: schema_1.saleListings.imageUrls,
            videoUrls: schema_1.saleListings.videoUrls,
            proofOfOwnershipUrl: schema_1.saleListings.proofOfOwnershipUrl,
            status: schema_1.saleListings.status,
            createdByUserId: schema_1.saleListings.createdByUserId,
            approvedByAdminId: schema_1.saleListings.approvedByAdminId,
            approvedAt: schema_1.saleListings.approvedAt,
            rejectionReason: schema_1.saleListings.rejectionReason,
        });
        await database_1.db.insert(schema_1.saleListingAuditLog).values({
            listingId: listingId,
            action: "Updated",
            actorUserId: req.user?.id,
            metadata: { fields: Object.keys(body || {}) },
        });
        return res.status(200).json(updated);
    }
    catch (error) {
        console.error("Error updating sale listing:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.updateSaleListing = updateSaleListing;
const approveSaleListing = async (req, res) => {
    try {
        const { id } = req.params;
        const adminUserId = req.user?.id;
        let listingId;
        if (!isNaN(Number(id))) {
            listingId = Number(id);
        }
        else {
            const [listing] = await database_1.db.select().from(schema_1.saleListings).where((0, drizzle_orm_1.eq)(schema_1.saleListings.uuid, id)).limit(1);
            if (!listing)
                return res.status(404).json({ error: "Not found" });
            listingId = listing.id;
        }
        const [updated] = await database_1.db.update(schema_1.saleListings).set({
            status: "Approved",
            approvedByAdminId: undefined,
            approvedAt: new Date(),
            rejectionReason: null,
        }).where((0, drizzle_orm_1.eq)(schema_1.saleListings.id, listingId)).returning({
            id: schema_1.saleListings.id,
            type: schema_1.saleListings.type,
            title: schema_1.saleListings.title,
            description: schema_1.saleListings.description,
            locationAddress: schema_1.saleListings.locationAddress,
            city: schema_1.saleListings.city,
            state: schema_1.saleListings.state,
            price: schema_1.saleListings.price,
            imageUrls: schema_1.saleListings.imageUrls,
            videoUrls: schema_1.saleListings.videoUrls,
            proofOfOwnershipUrl: schema_1.saleListings.proofOfOwnershipUrl,
            status: schema_1.saleListings.status,
            createdByUserId: schema_1.saleListings.createdByUserId,
            approvedByAdminId: schema_1.saleListings.approvedByAdminId,
            approvedAt: schema_1.saleListings.approvedAt,
            rejectionReason: schema_1.saleListings.rejectionReason,
        });
        await database_1.db.insert(schema_1.saleListingAuditLog).values({
            listingId: listingId,
            action: "Approved",
            actorUserId: adminUserId,
        });
        return res.status(200).json(updated);
    }
    catch (error) {
        console.error("Error approving sale listing:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.approveSaleListing = approveSaleListing;
const rejectSaleListing = async (req, res) => {
    try {
        const { id } = req.params;
        const adminUserId = req.user?.id;
        const reason = (req.body && req.body.reason) || "";
        let listingId;
        if (!isNaN(Number(id))) {
            listingId = Number(id);
        }
        else {
            const [listing] = await database_1.db.select().from(schema_1.saleListings).where((0, drizzle_orm_1.eq)(schema_1.saleListings.uuid, id)).limit(1);
            if (!listing)
                return res.status(404).json({ error: "Not found" });
            listingId = listing.id;
        }
        const [updated] = await database_1.db.update(schema_1.saleListings).set({
            status: "Rejected",
            approvedByAdminId: undefined,
            approvedAt: null,
            rejectionReason: reason,
        }).where((0, drizzle_orm_1.eq)(schema_1.saleListings.id, listingId)).returning({
            id: schema_1.saleListings.id,
            type: schema_1.saleListings.type,
            title: schema_1.saleListings.title,
            description: schema_1.saleListings.description,
            locationAddress: schema_1.saleListings.locationAddress,
            city: schema_1.saleListings.city,
            state: schema_1.saleListings.state,
            price: schema_1.saleListings.price,
            imageUrls: schema_1.saleListings.imageUrls,
            videoUrls: schema_1.saleListings.videoUrls,
            proofOfOwnershipUrl: schema_1.saleListings.proofOfOwnershipUrl,
            status: schema_1.saleListings.status,
            createdByUserId: schema_1.saleListings.createdByUserId,
            approvedByAdminId: schema_1.saleListings.approvedByAdminId,
            approvedAt: schema_1.saleListings.approvedAt,
            rejectionReason: schema_1.saleListings.rejectionReason,
        });
        await database_1.db.insert(schema_1.saleListingAuditLog).values({
            listingId: listingId,
            action: "Rejected",
            actorUserId: adminUserId,
            metadata: { reason },
        });
        return res.status(200).json(updated);
    }
    catch (error) {
        console.error("Error rejecting sale listing:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.rejectSaleListing = rejectSaleListing;
const verifySaleListing = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const adminUserId = req.user?.id;
        const outcome = (req.body && req.body.outcome) || "UnderInvestigation";
        const notes = (req.body && req.body.notes) || null;
        const [verification] = await database_1.db.insert(schema_1.saleVerifications).values({
            listingId: id,
            verifiedByUserId: adminUserId,
            outcome,
            notes,
        }).returning();
        if (req.files && req.files.supportingDocs) {
            const docs = req.files.supportingDocs;
            for (const d of docs) {
                const uploadRes = await (0, cloudinaryService_1.uploadBufferToCloudinary)(d.buffer, d.originalname, "documents/supporting", "raw");
                await database_1.db.insert(schema_1.saleListingDocuments).values({
                    listingId: id,
                    docType: "SUPPORTING",
                    fileUrl: uploadRes.url,
                });
            }
        }
        await database_1.db.insert(schema_1.saleListingAuditLog).values({
            listingId: id,
            action: "Verified",
            actorUserId: adminUserId,
            metadata: { outcome, verificationId: verification.id },
        });
        return res.status(201).json(verification);
    }
    catch (error) {
        console.error("Error verifying sale listing:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.verifySaleListing = verifySaleListing;
const submitSaleNegotiation = async (req, res) => {
    try {
        const { id } = req.params;
        let listing;
        if (!isNaN(Number(id))) {
            [listing] = await database_1.db.select().from(schema_1.saleListings).where((0, drizzle_orm_1.eq)(schema_1.saleListings.id, Number(id))).limit(1);
        }
        else {
            [listing] = await database_1.db.select().from(schema_1.saleListings).where((0, drizzle_orm_1.eq)(schema_1.saleListings.uuid, id)).limit(1);
        }
        if (!listing) {
            res.status(404).json({ error: "Not found" });
            return;
        }
        const listingId = listing.id;
        const actorUserId = req.user?.id;
        const { nameOrCompany, phone, email, address, proposedPrice, } = req.body || {};
        if (!nameOrCompany || !phone || !email || !address) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }
        await (0, emailSubscriptionService_1.sendNegotiationRequestToAdminEmail)(nameOrCompany, proposedPrice ? String(proposedPrice) : "N/A", email, phone, listing.title);
        const [log] = await database_1.db
            .insert(schema_1.saleListingAuditLog)
            .values({
            listingId: listingId,
            action: "NegotiationRequested",
            actorUserId,
            metadata: {
                nameOrCompany,
                phone,
                email,
                address,
                proposedPrice: proposedPrice ? Number(proposedPrice) : undefined,
            },
        })
            .returning();
        res.status(201).json(log);
    }
    catch (error) {
        console.error("Error submitting negotiation:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.submitSaleNegotiation = submitSaleNegotiation;
const submitSaleViewing = async (req, res) => {
    try {
        const { id } = req.params;
        let listing;
        if (!isNaN(Number(id))) {
            [listing] = await database_1.db.select().from(schema_1.saleListings).where((0, drizzle_orm_1.eq)(schema_1.saleListings.id, Number(id))).limit(1);
        }
        else {
            [listing] = await database_1.db.select().from(schema_1.saleListings).where((0, drizzle_orm_1.eq)(schema_1.saleListings.uuid, id)).limit(1);
        }
        if (!listing) {
            res.status(404).json({ error: "Not found" });
            return;
        }
        const listingId = listing.id;
        const actorUserId = req.user?.id;
        const { name, email, phone, date, time, message, } = req.body || {};
        if (!name || !email || !phone || !date || !time) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }
        await (0, emailSubscriptionService_1.sendViewingRequestToAdminEmail)(name, listing.title, date, time, email, phone, message);
        const [log] = await database_1.db
            .insert(schema_1.saleListingAuditLog)
            .values({
            listingId: listingId,
            action: "ViewingRequested",
            actorUserId: actorUserId || "guest",
            metadata: {
                name,
                email,
                phone,
                date,
                time,
                message,
            },
        })
            .returning();
        res.status(201).json(log);
    }
    catch (error) {
        console.error("Error submitting viewing:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.submitSaleViewing = submitSaleViewing;
const getSaleNegotiations = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const logs = await database_1.db
            .select()
            .from(schema_1.saleListingAuditLog)
            .where((0, drizzle_orm_1.eq)(schema_1.saleListingAuditLog.listingId, id))
            .orderBy(schema_1.saleListingAuditLog.createdAt);
        const negotiations = logs.filter((l) => l.action === "NegotiationRequested");
        res.json(negotiations);
    }
    catch (error) {
        console.error("Error fetching negotiations:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getSaleNegotiations = getSaleNegotiations;
const submitSaleFullPayment = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const [listing] = await database_1.db.select().from(schema_1.saleListings).where((0, drizzle_orm_1.eq)(schema_1.saleListings.id, id)).limit(1);
        if (!listing) {
            res.status(404).json({ error: "Not found" });
            return;
        }
        const actorUserId = req.user?.id;
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: "Receipt file is required" });
            return;
        }
        const uploadRes = await (0, cloudinaryService_1.uploadBufferToCloudinary)(file.buffer, file.originalname, "documents/payments", "raw");
        const [doc] = await database_1.db
            .insert(schema_1.saleListingDocuments)
            .values({
            listingId: id,
            docType: "PAYMENT_RECEIPT",
            fileUrl: uploadRes.url,
        })
            .returning();
        const { amount, nameOrCompany, phone, email, address } = req.body || {};
        await database_1.db.insert(schema_1.saleListingAuditLog).values({
            listingId: id,
            action: "FullPaymentSubmitted",
            actorUserId,
            metadata: {
                receiptUrl: uploadRes.url,
                amount: amount ? Number(amount) : undefined,
                nameOrCompany,
                phone,
                email,
                address,
            },
        });
        res.status(201).json(doc);
    }
    catch (error) {
        console.error("Error submitting full payment:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.submitSaleFullPayment = submitSaleFullPayment;
const getSaleFullPayments = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const docs = await database_1.db
            .select()
            .from(schema_1.saleListingDocuments)
            .where((0, drizzle_orm_1.eq)(schema_1.saleListingDocuments.listingId, id));
        const receipts = docs.filter((d) => d.docType === "PAYMENT_RECEIPT");
        res.json(receipts);
    }
    catch (error) {
        console.error("Error fetching full payments:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getSaleFullPayments = getSaleFullPayments;
