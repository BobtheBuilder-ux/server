import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../utils/database";
import { leases, tenants, properties, payments } from "../db/schema";

export const getLeases = async (_req: Request, res: Response): Promise<void> => {
  try {
    const leasesData = await db.select()
      .from(leases)
      .leftJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
      .leftJoin(properties, eq(leases.propertyId, properties.id));

    const leasesWithRelations = leasesData.map(row => ({
      ...row.Lease,
      tenant: row.Tenant,
      property: row.Property
    }));

    res.json(leasesWithRelations);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving leases: ${error.message}` });
  }
};

export const getPropertyLeases = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { propertyId } = req.params;
    const leasesData = await db.select()
      .from(leases)
      .leftJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
      .leftJoin(properties, eq(leases.propertyId, properties.id))
      .where(eq(leases.propertyId, Number(propertyId)));

    const leasesWithRelations = leasesData.map(row => ({
      ...row.Lease,
      tenant: row.Tenant,
      property: row.Property
    }));

    res.json(leasesWithRelations);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving property leases: ${error.message}` });
  }
};

export const getLeasePayments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const paymentsData = await db.select()
      .from(payments)
      .where(eq(payments.leaseId, Number(id)));

    res.json(paymentsData);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving lease payments: ${error.message}` });
  }
};
