import { Request, Response } from "express";
import { db } from "../utils/database";
import { saleListings, saleListingAuditLog, saleListingDocuments, saleSellers, saleVerifications, users } from "../db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { uploadBufferToCloudinary, uploadMultipleBuffersToCloudinary } from "../utils/cloudinaryService";
import multer from "multer";

const storage = multer.memoryStorage();
export const saleUpload = multer({ storage });

// Validation helper
function validateListingPayload(body: any) {
  const errors: string[] = [];
  if (!body.type || !["Land", "Property"].includes(body.type)) errors.push("Invalid type");
  if (!body.title) errors.push("Title is required");
  if (!body.locationAddress) errors.push("Location address is required");
  if (!body.city) errors.push("City is required");
  if (!body.state) errors.push("State is required");
  if (body.price === undefined || body.price === null || isNaN(Number(body.price))) errors.push("Valid price (naira) is required");
  return errors;
}

export const createSaleListing = async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const errors = validateListingPayload(body);
    if (errors.length) return res.status(400).json({ errors });

    const createdByUserId = req.user?.id as string;

    // Handle uploads if provided
    let proofUrl: string | null = null;
    if (req.files && (req.files as any).proof) {
      const proofFile = (req.files as any).proof[0];
      const uploadRes = await uploadBufferToCloudinary(
        proofFile.buffer,
        proofFile.originalname,
        "documents/proof",
        "raw"
      );
      proofUrl = uploadRes.url;
    }

    let imageUrls: string[] = [];
    if (req.files && (req.files as any).images) {
      const images = (req.files as any).images as Express.Multer.File[];
      const fileData = images.map((f) => ({
        buffer: f.buffer,
        fileName: f.originalname,
        resourceType: "image" as const,
      }));
      const uploadRes = await uploadMultipleBuffersToCloudinary(fileData, "properties/photos");
      imageUrls = uploadRes.map((u) => u.url);
    }

    let videoUrls: string[] = [];
    if (req.files && (req.files as any).videos) {
      const videos = (req.files as any).videos as Express.Multer.File[];
      const fileData = videos.map((f) => ({
        buffer: f.buffer,
        fileName: f.originalname,
        resourceType: "video" as const,
      }));
      const uploadRes = await uploadMultipleBuffersToCloudinary(fileData, "properties/videos");
      videoUrls = uploadRes.map((u) => u.url);
    }

    const [inserted] = await db.insert(saleListings).values({
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
      submittedByRole: body.submittedByRole || null,
      // Extended fields
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
      id: saleListings.id,
      type: saleListings.type,
      title: saleListings.title,
      description: saleListings.description,
      locationAddress: saleListings.locationAddress,
      city: saleListings.city,
      state: saleListings.state,
      country: saleListings.country,
      coordinates: saleListings.coordinates,
      size: saleListings.size,
      sizeUnit: saleListings.sizeUnit,
      price: saleListings.price,
      currency: saleListings.currency,
      features: saleListings.features,
      imageUrls: saleListings.imageUrls,
      videoUrls: saleListings.videoUrls,
      proofOfOwnershipUrl: saleListings.proofOfOwnershipUrl,
      status: saleListings.status,
      createdByUserId: saleListings.createdByUserId,
      approvedByAdminId: saleListings.approvedByAdminId,
      approvedAt: saleListings.approvedAt,
      rejectionReason: saleListings.rejectionReason,
      createdAt: saleListings.createdAt,
      updatedAt: saleListings.updatedAt,
    });

    await db.insert(saleListingAuditLog).values({
      listingId: inserted.id,
      action: "Submitted",
      actorUserId: createdByUserId,
      metadata: { title: inserted.title, type: inserted.type },
    });

    // Handle survey plan upload
    if (req.files && (req.files as any).surveyPlan) {
      const survey = (req.files as any).surveyPlan[0];
      const uploadRes = await uploadBufferToCloudinary(
        survey.buffer,
        survey.originalname,
        "documents/survey",
        "raw"
      );
      await db.insert(saleListingDocuments).values({
        listingId: inserted.id,
        docType: "SURVEY_PLAN",
        fileUrl: uploadRes.url,
      });
    }

    // Handle title documents upload (expects optional body.titleDocTypes as JSON array aligned with files)
    if (req.files && (req.files as any).titleDocs) {
      const titleFiles = (req.files as any).titleDocs as Express.Multer.File[];
      const types: string[] = body.titleDocTypes ? JSON.parse(body.titleDocTypes) : [];
      for (let i = 0; i < titleFiles.length; i++) {
        const f = titleFiles[i];
        const uploadRes = await uploadBufferToCloudinary(
          f.buffer,
          f.originalname,
          "documents/title",
          "raw"
        );
        await db.insert(saleListingDocuments).values({
          listingId: inserted.id,
          docType: types[i] || "OTHER",
          fileUrl: uploadRes.url,
          otherText: types[i] ? null : (body.otherTitleDocText || null),
        });
      }
    }

    // Handle seller information (required fields)
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
      signatureUrl: null as string | null,
      idFileUrl: null as string | null,
    };

    // Upload ID file
    if (req.files && (req.files as any).idUpload) {
      const idF = (req.files as any).idUpload[0];
      const uploadRes = await uploadBufferToCloudinary(idF.buffer, idF.originalname, "documents/id", "raw");
      sellerPayload.idFileUrl = uploadRes.url;
    }

    // Upload seller signature
    if (req.files && (req.files as any).signature) {
      const sig = (req.files as any).signature[0];
      const uploadRes = await uploadBufferToCloudinary(sig.buffer, sig.originalname, "documents/signature", "image");
      sellerPayload.signatureUrl = uploadRes.url;
    }

    await db.insert(saleSellers).values(sellerPayload);

    return res.status(201).json(inserted);
  } catch (error) {
    console.error("Error creating sale listing:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getSaleListings = async (req: Request, res: Response) => {
  try {
    const { type, status, minPrice, maxPrice, city, state } = req.query as any;
    let whereClauses: any[] = [];
    if (type) whereClauses.push(eq(saleListings.type, type));
    if (status) whereClauses.push(eq(saleListings.status, status));
    if (city) whereClauses.push(eq(saleListings.city, city));
    if (state) whereClauses.push(eq(saleListings.state, state));
    if (minPrice) whereClauses.push(gte(saleListings.price, Number(minPrice)));
    if (maxPrice) whereClauses.push(lte(saleListings.price, Number(maxPrice)));

    const listings = await db
      .select({
        id: saleListings.id,
        type: saleListings.type,
        title: saleListings.title,
        description: saleListings.description,
        locationAddress: saleListings.locationAddress,
        city: saleListings.city,
        state: saleListings.state,
        country: saleListings.country,
        coordinates: saleListings.coordinates,
        size: saleListings.size,
        sizeUnit: saleListings.sizeUnit,
        price: saleListings.price,
        currency: saleListings.currency,
        features: saleListings.features,
        imageUrls: saleListings.imageUrls,
        videoUrls: saleListings.videoUrls,
        proofOfOwnershipUrl: saleListings.proofOfOwnershipUrl,
        status: saleListings.status,
        createdByUserId: saleListings.createdByUserId,
        approvedByAdminId: saleListings.approvedByAdminId,
        approvedAt: saleListings.approvedAt,
        rejectionReason: saleListings.rejectionReason,
        createdAt: saleListings.createdAt,
        updatedAt: saleListings.updatedAt,
      })
      .from(saleListings)
      .where(whereClauses.length ? and(...whereClauses) : undefined);
    return res.status(200).json({ listings });
  } catch (error) {
    console.error("Error fetching sale listings:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getSaleListing = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [listing] = await db
      .select({
        id: saleListings.id,
        type: saleListings.type,
        title: saleListings.title,
        description: saleListings.description,
        locationAddress: saleListings.locationAddress,
        city: saleListings.city,
        state: saleListings.state,
        country: saleListings.country,
        coordinates: saleListings.coordinates,
        size: saleListings.size,
        sizeUnit: saleListings.sizeUnit,
        price: saleListings.price,
        currency: saleListings.currency,
        features: saleListings.features,
        imageUrls: saleListings.imageUrls,
        videoUrls: saleListings.videoUrls,
        proofOfOwnershipUrl: saleListings.proofOfOwnershipUrl,
        status: saleListings.status,
        createdByUserId: saleListings.createdByUserId,
        approvedByAdminId: saleListings.approvedByAdminId,
        approvedAt: saleListings.approvedAt,
        rejectionReason: saleListings.rejectionReason,
        createdAt: saleListings.createdAt,
        updatedAt: saleListings.updatedAt,
      })
      .from(saleListings)
      .where(eq(saleListings.id, id))
      .limit(1);
    if (!listing) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(listing);
  } catch (error) {
    console.error("Error fetching sale listing:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateSaleListing = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const [existing] = await db.select().from(saleListings).where(eq(saleListings.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });

    const [updated] = await db.update(saleListings).set({
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
    }).where(eq(saleListings.id, id)).returning({
      id: saleListings.id,
      type: saleListings.type,
      title: saleListings.title,
      description: saleListings.description,
      locationAddress: saleListings.locationAddress,
      city: saleListings.city,
      state: saleListings.state,
      price: saleListings.price,
      imageUrls: saleListings.imageUrls,
      videoUrls: saleListings.videoUrls,
      proofOfOwnershipUrl: saleListings.proofOfOwnershipUrl,
      status: saleListings.status,
      createdByUserId: saleListings.createdByUserId,
      approvedByAdminId: saleListings.approvedByAdminId,
      approvedAt: saleListings.approvedAt,
      rejectionReason: saleListings.rejectionReason,
    });

    await db.insert(saleListingAuditLog).values({
      listingId: id,
      action: "Updated",
      actorUserId: req.user?.id as string,
      metadata: { fields: Object.keys(body || {}) },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating sale listing:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const approveSaleListing = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const adminUserId = req.user?.id as string;
    const [updated] = await db.update(saleListings).set({
      status: "Approved",
      approvedByAdminId: undefined,
      approvedAt: new Date(),
      rejectionReason: null,
    }).where(eq(saleListings.id, id)).returning({
      id: saleListings.id,
      type: saleListings.type,
      title: saleListings.title,
      description: saleListings.description,
      locationAddress: saleListings.locationAddress,
      city: saleListings.city,
      state: saleListings.state,
      price: saleListings.price,
      imageUrls: saleListings.imageUrls,
      videoUrls: saleListings.videoUrls,
      proofOfOwnershipUrl: saleListings.proofOfOwnershipUrl,
      status: saleListings.status,
      createdByUserId: saleListings.createdByUserId,
      approvedByAdminId: saleListings.approvedByAdminId,
      approvedAt: saleListings.approvedAt,
      rejectionReason: saleListings.rejectionReason,
    });

    await db.insert(saleListingAuditLog).values({
      listingId: id,
      action: "Approved",
      actorUserId: adminUserId,
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error approving sale listing:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const rejectSaleListing = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const adminUserId = req.user?.id as string;
    const reason = (req.body && req.body.reason) || "";
    const [updated] = await db.update(saleListings).set({
      status: "Rejected",
      approvedByAdminId: undefined,
      approvedAt: null,
      rejectionReason: reason,
    }).where(eq(saleListings.id, id)).returning({
      id: saleListings.id,
      type: saleListings.type,
      title: saleListings.title,
      description: saleListings.description,
      locationAddress: saleListings.locationAddress,
      city: saleListings.city,
      state: saleListings.state,
      price: saleListings.price,
      imageUrls: saleListings.imageUrls,
      videoUrls: saleListings.videoUrls,
      proofOfOwnershipUrl: saleListings.proofOfOwnershipUrl,
      status: saleListings.status,
      createdByUserId: saleListings.createdByUserId,
      approvedByAdminId: saleListings.approvedByAdminId,
      approvedAt: saleListings.approvedAt,
      rejectionReason: saleListings.rejectionReason,
    });

    await db.insert(saleListingAuditLog).values({
      listingId: id,
      action: "Rejected",
      actorUserId: adminUserId,
      metadata: { reason },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error rejecting sale listing:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const verifySaleListing = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const adminUserId = req.user?.id as string;
    const outcome = (req.body && req.body.outcome) || "UnderInvestigation";
    const notes = (req.body && req.body.notes) || null;

    const [verification] = await db.insert(saleVerifications).values({
      listingId: id,
      verifiedByUserId: adminUserId,
      outcome,
      notes,
    }).returning();

    // Upload supporting documents if provided
    if (req.files && (req.files as any).supportingDocs) {
      const docs = (req.files as any).supportingDocs as Express.Multer.File[];
      for (const d of docs) {
        const uploadRes = await uploadBufferToCloudinary(d.buffer, d.originalname, "documents/supporting", "raw");
        await db.insert(saleListingDocuments).values({
          listingId: id,
          docType: "SUPPORTING",
          fileUrl: uploadRes.url,
        });
      }
    }

    await db.insert(saleListingAuditLog).values({
      listingId: id,
      action: "Verified",
      actorUserId: adminUserId,
      metadata: { outcome, verificationId: verification.id },
    });

    return res.status(201).json(verification);
  } catch (error) {
    console.error("Error verifying sale listing:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const submitSaleNegotiation = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [listing] = await db.select().from(saleListings).where(eq(saleListings.id, id)).limit(1);
    if (!listing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const actorUserId = req.user?.id as string;
    const {
      nameOrCompany,
      phone,
      email,
      address,
      proposedPrice,
    } = req.body || {};

    if (!nameOrCompany || !phone || !email || !address) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const [log] = await db
      .insert(saleListingAuditLog)
      .values({
        listingId: id,
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
  } catch (error: any) {
    console.error("Error submitting negotiation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getSaleNegotiations = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const logs = await db
      .select()
      .from(saleListingAuditLog)
      .where(eq(saleListingAuditLog.listingId, id))
      .orderBy(saleListingAuditLog.createdAt);

    const negotiations = logs.filter((l: any) => l.action === "NegotiationRequested");
    res.json(negotiations);
  } catch (error: any) {
    console.error("Error fetching negotiations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const submitSaleFullPayment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [listing] = await db.select().from(saleListings).where(eq(saleListings.id, id)).limit(1);
    if (!listing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const actorUserId = req.user?.id as string;
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ error: "Receipt file is required" });
      return;
    }

    const uploadRes = await uploadBufferToCloudinary(
      file.buffer,
      file.originalname,
      "documents/payments",
      "raw"
    );

    const [doc] = await db
      .insert(saleListingDocuments)
      .values({
        listingId: id,
        docType: "PAYMENT_RECEIPT",
        fileUrl: uploadRes.url,
      })
      .returning();

    const { amount, nameOrCompany, phone, email, address } = req.body || {};
    await db.insert(saleListingAuditLog).values({
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
  } catch (error: any) {
    console.error("Error submitting full payment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getSaleFullPayments = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const docs = await db
      .select()
      .from(saleListingDocuments)
      .where(eq(saleListingDocuments.listingId, id));

    const receipts = docs.filter((d: any) => d.docType === "PAYMENT_RECEIPT");
    res.json(receipts);
  } catch (error: any) {
    console.error("Error fetching full payments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};