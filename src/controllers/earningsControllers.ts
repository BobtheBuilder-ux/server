import { Request, Response } from "express";
import { eq, and, desc, inArray, count } from "drizzle-orm";
import { db } from "../utils/database";
import { properties, leases, payments, landlords, withdrawals } from "../db/schema";

// Get landlord earnings statistics
export const getLandlordEarnings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId: cognitoId } = req.params;

    // Get all properties managed by the landlord with leases and payments
    const propertiesResult = await db.select()
      .from(properties)
      .leftJoin(leases, eq(leases.propertyId, properties.id))
      .leftJoin(payments, and(
        eq(payments.leaseId, leases.id),
        eq(payments.paymentStatus, "Paid")
      ))
      .where(eq(properties.landlordCognitoId, cognitoId));

    // Group the results by property
    const propertiesWithLeases = propertiesResult.reduce((acc: any[], result) => {
      const property = result.Property;
      const lease = result.Lease;
      const payment = result.Payment;
      
      let existingProperty = acc.find(p => p.id === property.id);
      if (!existingProperty) {
        existingProperty = {
          ...property,
          leases: []
        };
        acc.push(existingProperty);
      }
      
      if (lease) {
        let existingLease = existingProperty.leases.find((l: any) => l.id === lease.id);
        if (!existingLease) {
          existingLease = {
            ...lease,
            payments: []
          };
          existingProperty.leases.push(existingLease);
        }
        
        if (payment) {
          existingLease.payments.push(payment);
        }
      }
      
      return acc;
    }, []);

    // Calculate statistics
    let totalEarnings = 0;
    let totalPropertiesRented = 0;
    let activeLeases = 0;
    const monthlyEarnings: { [key: string]: number } = {};

    propertiesWithLeases.forEach((property: any) => {
      if (property.leases.length > 0) {
        totalPropertiesRented++;
        
        property.leases.forEach((lease: any) => {
          const currentDate = new Date();
          if (lease.endDate > currentDate) {
            activeLeases++;
          }

          lease.payments.forEach((payment: any) => {
            totalEarnings += payment.amountPaid;
            
            // Group by month for monthly earnings
            const monthKey = payment.paymentDate.toISOString().substring(0, 7); // YYYY-MM
            monthlyEarnings[monthKey] = (monthlyEarnings[monthKey] || 0) + payment.amountPaid;
          });
        });
      }
    });

    // Get pending withdrawals
    const pendingWithdrawals = await db.select()
      .from(withdrawals)
      .where(and(
        eq(withdrawals.landlordCognitoId, cognitoId),
        inArray(withdrawals.status, ["Pending", "Processing"])
      ));

    const totalPendingWithdrawals = pendingWithdrawals.reduce(
      (sum: number, withdrawal: any) => sum + withdrawal.amount, 0
    );

    // Calculate available balance (total earnings minus pending withdrawals)
    const availableBalance = totalEarnings - totalPendingWithdrawals;

    res.json({
      totalEarnings,
      availableBalance,
      totalPropertiesRented,
      activeLeases,
      totalProperties: propertiesWithLeases.length,
      monthlyEarnings,
      pendingWithdrawals: totalPendingWithdrawals
    });
  } catch (error: any) {
    res.status(500).json({ 
      message: `Error retrieving landlord earnings: ${error.message}` 
    });
  }
};

// Create withdrawal request
export const createWithdrawalRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId: cognitoId } = req.params;
    const { amount, bankName, accountNumber, accountName } = req.body;

    // Validate required fields
    if (!amount || !bankName || !accountNumber || !accountName) {
      res.status(400).json({ 
        message: "Amount, bank name, account number, and account name are required" 
      });
      return;
    }

    // Check if landlord exists
    const landlordResult = await db.select()
      .from(landlords)
      .where(eq(landlords.cognitoId, cognitoId))
      .limit(1);
    
    const landlord = landlordResult[0];

    if (!landlord) {
      res.status(404).json({ message: "Landlord not found" });
      return;
    }

    // Get current earnings and pending withdrawals
    const earnings = await getLandlordEarningsData(cognitoId);
    
    if (amount > earnings.availableBalance) {
      res.status(400).json({ 
        message: "Insufficient balance for withdrawal" 
      });
      return;
    }

    // Generate unique reference
    const reference = `WD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create withdrawal request
    const withdrawalResult = await db.insert(withdrawals)
      .values({
        amount,
        landlordCognitoId: cognitoId,
        bankName,
        accountNumber,
        accountName,
        reference,
        status: "Pending"
      })
      .returning();
    
    const withdrawal = withdrawalResult[0];

    res.status(201).json({
      message: "Withdrawal request created successfully",
      withdrawal
    });
  } catch (error: any) {
    res.status(500).json({ 
      message: `Error creating withdrawal request: ${error.message}` 
    });
  }
};

// Get landlord withdrawal history
export const getLandlordWithdrawals = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { authId: cognitoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const withdrawalsList = await db.select()
      .from(withdrawals)
      .where(eq(withdrawals.landlordCognitoId, cognitoId))
      .orderBy(desc(withdrawals.createdAt))
      .offset(skip)
      .limit(Number(limit));

    const [totalWithdrawalsResult] = await db.select({ count: count() })
      .from(withdrawals)
      .where(eq(withdrawals.landlordCognitoId, cognitoId));
    
    const totalWithdrawals = totalWithdrawalsResult.count;

    res.json({
      withdrawals: withdrawalsList,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalWithdrawals,
        pages: Math.ceil(totalWithdrawals / Number(limit))
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      message: `Error retrieving withdrawal history: ${error.message}` 
    });
  }
};

// Helper function to get earnings data
const getLandlordEarningsData = async (cognitoId: string) => {
  // Get all properties managed by the landlord with leases and payments
  const propertiesResult = await db.select()
    .from(properties)
    .leftJoin(leases, eq(leases.propertyId, properties.id))
    .leftJoin(payments, and(
      eq(payments.leaseId, leases.id),
      eq(payments.paymentStatus, "Paid")
    ))
    .where(eq(properties.landlordCognitoId, cognitoId));

  let totalEarnings = 0;
  propertiesResult.forEach((result) => {
    if (result.Payment) {
      totalEarnings += result.Payment.amountPaid;
    }
  });

  const pendingWithdrawals = await db.select()
    .from(withdrawals)
    .where(and(
      eq(withdrawals.landlordCognitoId, cognitoId),
      inArray(withdrawals.status, ["Pending", "Processing"])
    ));

  const totalPendingWithdrawals = pendingWithdrawals.reduce(
    (sum: number, withdrawal: any) => sum + withdrawal.amount, 0
  );

  return {
    totalEarnings,
    availableBalance: totalEarnings - totalPendingWithdrawals
  };
};