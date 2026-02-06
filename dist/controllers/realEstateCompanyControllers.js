"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCompanyStatus = exports.getCompanyById = exports.getAllCompanies = exports.updateCompanyProfile = exports.getCompanyProfile = exports.registerCompany = void 0;
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const cloudinaryService_1 = require("../utils/cloudinaryService");
const registerCompany = async (req, res) => {
    try {
        const { companyName, licenseNumber, address, phoneNumber, email, website, description } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (!companyName || !licenseNumber || !email) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        const existingCompany = await database_1.db.query.realEstateCompanies.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.realEstateCompanies.userId, userId),
        });
        if (existingCompany) {
            return res.status(400).json({ message: "User already has a registered company" });
        }
        let logoUrl = null;
        if (req.file) {
            const uploadResult = await (0, cloudinaryService_1.uploadBufferToCloudinary)(req.file.buffer, req.file.originalname, "companies/logos", "image");
            logoUrl = uploadResult.url;
        }
        const [newCompany] = await database_1.db.insert(schema_1.realEstateCompanies).values({
            userId,
            companyName,
            licenseNumber,
            address,
            phoneNumber,
            email,
            website,
            description,
            logoUrl,
            verificationStatus: "Pending",
        }).returning();
        res.status(201).json(newCompany);
    }
    catch (error) {
        console.error("Error registering company:", error);
        res.status(500).json({ message: `Error registering company: ${error.message}` });
    }
};
exports.registerCompany = registerCompany;
const getCompanyProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const company = await database_1.db.query.realEstateCompanies.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.realEstateCompanies.userId, userId),
        });
        if (!company)
            return res.status(404).json({ message: "Company not found" });
        res.json(company);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getCompanyProfile = getCompanyProfile;
const updateCompanyProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const { companyName, licenseNumber, address, phoneNumber, email, website, description } = req.body;
        const existingCompany = await database_1.db.query.realEstateCompanies.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.realEstateCompanies.userId, userId),
        });
        if (!existingCompany) {
            return res.status(404).json({ message: "Company not found" });
        }
        let logoUrl = existingCompany.logoUrl;
        if (req.file) {
            const uploadResult = await (0, cloudinaryService_1.uploadBufferToCloudinary)(req.file.buffer, req.file.originalname, "companies/logos", "image");
            logoUrl = uploadResult.url;
        }
        const [updatedCompany] = await database_1.db.update(schema_1.realEstateCompanies)
            .set({
            companyName: companyName || existingCompany.companyName,
            licenseNumber: licenseNumber || existingCompany.licenseNumber,
            address: address || existingCompany.address,
            phoneNumber: phoneNumber || existingCompany.phoneNumber,
            email: email || existingCompany.email,
            website: website || existingCompany.website,
            description: description || existingCompany.description,
            logoUrl,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.realEstateCompanies.id, existingCompany.id))
            .returning();
        res.json(updatedCompany);
    }
    catch (error) {
        console.error("Error updating company profile:", error);
        res.status(500).json({ message: error.message });
    }
};
exports.updateCompanyProfile = updateCompanyProfile;
const getAllCompanies = async (req, res) => {
    try {
        const { search, verificationStatus } = req.query;
        const whereConditions = [];
        if (search) {
            whereConditions.push((0, drizzle_orm_1.like)(schema_1.realEstateCompanies.companyName, `%${search}%`));
        }
        if (verificationStatus) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.realEstateCompanies.verificationStatus, verificationStatus));
        }
        const companies = await database_1.db.query.realEstateCompanies.findMany({
            where: whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined,
            with: {
                listings: {
                    limit: 4,
                    orderBy: (listings, { desc }) => [desc(listings.createdAt)],
                },
            },
        });
        res.json(companies);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getAllCompanies = getAllCompanies;
const getCompanyById = async (req, res) => {
    try {
        const { id } = req.params;
        let company;
        if (!isNaN(Number(id))) {
            company = await database_1.db.query.realEstateCompanies.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.realEstateCompanies.id, parseInt(id)),
            });
        }
        else {
            const decodedName = decodeURIComponent(id);
            company = await database_1.db.query.realEstateCompanies.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.realEstateCompanies.companyName, decodedName),
            });
            if (!company) {
                company = await database_1.db.query.realEstateCompanies.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema_1.realEstateCompanies.slug, id),
                });
            }
        }
        if (!company)
            return res.status(404).json({ message: "Company not found" });
        res.json(company);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getCompanyById = getCompanyById;
const updateCompanyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }
        const [updatedCompany] = await database_1.db.update(schema_1.realEstateCompanies)
            .set({
            verificationStatus: status,
            isVerified: status === 'Approved'
        })
            .where((0, drizzle_orm_1.eq)(schema_1.realEstateCompanies.id, parseInt(id)))
            .returning();
        if (!updatedCompany)
            return res.status(404).json({ message: "Company not found" });
        res.json(updatedCompany);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateCompanyStatus = updateCompanyStatus;
