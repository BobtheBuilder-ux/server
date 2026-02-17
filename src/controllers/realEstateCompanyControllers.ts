import { Request, Response } from "express";
import { db } from "../utils/database";
import { adminAuditLogs, realEstateCompanies } from "../db/schema";
import { eq, like, and } from "drizzle-orm";
import { uploadBufferToCloudinary } from "../utils/cloudinaryService";
import { auth } from "../auth";

export const registerCompany = async (req: Request, res: Response) => {
  try {
    const { companyName, licenseNumber, address, phoneNumber, email, website, description } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!companyName || !licenseNumber || !email) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if company already exists for this user
    const existingCompany = await db.query.realEstateCompanies.findFirst({
      where: eq(realEstateCompanies.userId, userId),
    });

    if (existingCompany) {
      return res.status(400).json({ message: "User already has a registered company" });
    }

    let logoUrl = null;
    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "companies/logos",
        "image"
      );
      logoUrl = uploadResult.url;
    }

    const [newCompany] = await db.insert(realEstateCompanies).values({
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
  } catch (error: any) {
    console.error("Error registering company:", error);
    res.status(500).json({ message: `Error registering company: ${error.message}` });
  }
};

export const getCompanyProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const company = await db.query.realEstateCompanies.findFirst({
      where: eq(realEstateCompanies.userId, userId),
    });

    if (!company) return res.status(404).json({ message: "Company not found" });

    res.json(company);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCompanyProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { companyName, licenseNumber, address, phoneNumber, email, website, description } = req.body;

    const existingCompany = await db.query.realEstateCompanies.findFirst({
      where: eq(realEstateCompanies.userId, userId),
    });

    if (!existingCompany) {
      return res.status(404).json({ message: "Company not found" });
    }

    let logoUrl = existingCompany.logoUrl;
    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "companies/logos",
        "image"
      );
      logoUrl = uploadResult.url;
    }

    const [updatedCompany] = await db.update(realEstateCompanies)
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
      .where(eq(realEstateCompanies.id, existingCompany.id))
      .returning();

    res.json(updatedCompany);
  } catch (error: any) {
    console.error("Error updating company profile:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getAllCompanies = async (req: Request, res: Response) => {
  try {
    const { search, verificationStatus } = req.query;
    
    const whereConditions: any[] = [];
    
    if (search) {
      whereConditions.push(like(realEstateCompanies.companyName, `%${search}%`));
    }
    
    if (verificationStatus) {
      whereConditions.push(eq(realEstateCompanies.verificationStatus, verificationStatus as string));
    }

    const companies = await db.query.realEstateCompanies.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        listings: {
          limit: 4,
          orderBy: (listings, { desc }) => [desc(listings.createdAt)],
        },
      },
    });

    res.json(companies);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getCompanyById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let company;
    
    // Check if id is numeric (legacy ID) or string (company name/slug)
    if (!isNaN(Number(id))) {
      company = await db.query.realEstateCompanies.findFirst({
        where: eq(realEstateCompanies.id, parseInt(id)),
      });
    } else {
      // Try finding by company name (decoded) or slug
      const decodedName = decodeURIComponent(id);
      company = await db.query.realEstateCompanies.findFirst({
        where: eq(realEstateCompanies.companyName, decodedName),
      });
      
      if (!company) {
        company = await db.query.realEstateCompanies.findFirst({
          where: eq(realEstateCompanies.slug, id),
        });
      }
    }

    if (!company) return res.status(404).json({ message: "Company not found" });

    res.json(company);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCompanyStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Approved', 'Rejected'

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const companyId = parseInt(id);

    if (Number.isNaN(companyId)) {
      return res.status(400).json({ message: "Invalid company id" });
    }

    const [existingCompany] = await db
      .select()
      .from(realEstateCompanies)
      .where(eq(realEstateCompanies.id, companyId));

    if (!existingCompany) {
      return res.status(404).json({ message: "Company not found" });
    }

    const [updatedCompany] = await db.update(realEstateCompanies)
      .set({ 
        verificationStatus: status,
        isVerified: status === 'Approved',
        updatedAt: new Date(),
      })
      .where(eq(realEstateCompanies.id, companyId))
      .returning();

    if (!updatedCompany) return res.status(404).json({ message: "Company not found" });

    if (status === 'Approved') {
      try {
        const api: any = (auth as any).api;
        const payload = {
          body: {
            email: updatedCompany.email,
            redirectTo: `${process.env.CLIENT_URL}/auth/reset-password`,
          },
          headers: req.headers as any,
        };

        if (typeof api?.forgetPassword === "function") {
          await api.forgetPassword(payload);
        } else if (typeof api?.forgotPassword === "function") {
          await api.forgotPassword(payload);
        } else if (typeof api?.resetPassword === "function") {
          await api.resetPassword(payload);
        }
      } catch (error) {
        console.error("Error sending password setup email for real estate company:", error);
      }
    }

    try {
      await db.insert(adminAuditLogs).values({
        adminUserId: req.user?.id || "system",
        action: "UPDATE_REAL_ESTATE_COMPANY_STATUS",
        targetUserId: existingCompany.userId,
        details: {
          companyId: existingCompany.id,
          previousStatus: existingCompany.verificationStatus,
          newStatus: status,
          passwordEmailSent: status === "Approved",
        },
        ipAddress: req.ip || (req.socket.remoteAddress as string),
      });
    } catch (auditError) {
      console.error("Failed to create audit log for company status update:", auditError);
    }

    res.json(updatedCompany);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
