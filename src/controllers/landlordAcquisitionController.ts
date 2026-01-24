import { Request, Response } from "express";
import { databaseService, landlordAcquisitions } from "../utils/database";
import { and, desc, ilike, eq, sql, or } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  fullName: z.string().min(1),
  phoneNumber: z.string().regex(/^(\+234|0)[7-9]\d{9}$/),
  address: z.string().min(1),
  email: z.string().email(),
  propertyTypes: z.array(z.string()).min(1),
});

export const submitAcquisition = async (req: Request, res: Response) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid data", issues: parsed.error.flatten() });
      return;
    }
    const db = databaseService.getClient();
    const payload = parsed.data;
    const [row] = await db
      .insert(landlordAcquisitions)
      .values({
        fullName: payload.fullName,
        phoneNumber: payload.phoneNumber,
        address: payload.address,
        email: payload.email,
        propertyTypes: payload.propertyTypes,
      })
      .returning();
    res.status(201).json({ success: true, id: row.id });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const listAcquisitions = async (req: Request, res: Response) => {
  try {
    const db = databaseService.getClient();
    const search = (req.query.search as string) || "";
    const status = (req.query.status as string) || undefined;
    const whereClauses: any[] = [];
    if (search) {
      const pattern = `%${search}%`;
      whereClauses.push(
        or(
          ilike(landlordAcquisitions.fullName, pattern),
          ilike(landlordAcquisitions.email, pattern),
          ilike(landlordAcquisitions.phoneNumber, pattern),
          ilike(landlordAcquisitions.address, pattern)
        )
      );
    }
    if (status) whereClauses.push(eq(landlordAcquisitions.status, status as any));
    const rows = await db
      .select()
      .from(landlordAcquisitions)
      .where(whereClauses.length ? and(...whereClauses) : undefined as any)
      .orderBy(desc(landlordAcquisitions.createdAt));
    res.json({ acquisitions: rows });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateAcquisitionStatus = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status as "Pending" | "Accepted" | "Onboarded" | "FullyIn";
    if (!id || !["Pending", "Accepted", "Onboarded", "FullyIn"].includes(status)) {
      res.status(400).json({ message: "Invalid request" });
      return;
    }
    const db = databaseService.getClient();
    const [row] = await db
      .update(landlordAcquisitions)
      .set({ status, updatedAt: sql`NOW()` })
      .where(eq(landlordAcquisitions.id, id))
      .returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
