import { Request, Response } from "express";
import { db } from "../utils/database";
import { realEstateCompanies } from "../db/schema";
import { eq, like, and } from "drizzle-orm";
import { uploadBufferToCloudinary } from "../utils/cloudinaryService";

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

    const [updatedCompany] = await db.update(realEstateCompanies)
      .set({ 
        verificationStatus: status,
        isVerified: status === 'Approved'
      })
      .where(eq(realEstateCompanies.id, parseInt(id)))
      .returning();

    if (!updatedCompany) return res.status(404).json({ message: "Company not found" });

    res.json(updatedCompany);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
