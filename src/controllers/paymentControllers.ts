import { Request, Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../utils/database";
import { properties, tenants, landlords, leases, payments, locations, applications, landlordTenantRentals } from "../db/schema";
import axios from "axios";
import { sendEmail } from "../utils/emailService";
import { generateLeaseAgreement } from "../utils/leaseAgreementGenerator";
import { propertyRentedNotificationTemplate } from "../utils/emailTemplates";
import { PaymentNotificationService } from "../services/paymentNotificationService";

// Initialize Flutterwave payment
export const initializePayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { leaseId, propertyId, tenantId, amount, email, paymentType } = req.body;

    // Validate essential inputs
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      res.status(400).json({ message: "Invalid amount" });
      return;
    }
    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }
    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.error("PAYSTACK_SECRET_KEY is missing");
      res.status(500).json({ message: "Payment service configuration error" });
      return;
    }

    let lease = null;
    let property = null;

    if (paymentType === "initial_payment" || paymentType === "deposit") {
      if (!propertyId) {
        res.status(400).json({ message: "Property ID is required for this payment type" });
        return;
      }

      // For initial payment and deposit, validate property exists
      const propertyResult = await db.select()
        .from(properties)
        .leftJoin(locations, eq(properties.locationId, locations.id))
        .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
        .where(eq(properties.id, Number(propertyId)))
        .limit(1);
      
      property = propertyResult[0] ? {
        ...propertyResult[0].Property,
        location: propertyResult[0].Location,
        landlord: propertyResult[0].Landlord
      } : null;

      if (!property) {
        res.status(404).json({ message: "Property not found" });
        return;
      }
      // Validate inventory availability before initializing payment
      if (paymentType === "initial_payment" && (property.availableUnits <= 0 || property.status !== 'Available')) {
        res.status(409).json({ message: "This property is no longer available" });
        return;
      }
    } else {
      if (!leaseId) {
        res.status(400).json({ message: "Lease ID is required for this payment type" });
        return;
      }

      // For other payment types, validate lease exists
      const leaseResult = await db.select()
        .from(leases)
        .leftJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
        .leftJoin(properties, eq(leases.propertyId, properties.id))
        .leftJoin(locations, eq(properties.locationId, locations.id))
        .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
        .where(eq(leases.id, Number(leaseId)))
        .limit(1);
      
      lease = leaseResult[0] ? {
        ...leaseResult[0].Lease,
        tenant: leaseResult[0].Tenant,
        property: {
          ...leaseResult[0].Property,
          location: leaseResult[0].Location,
          landlord: leaseResult[0].Landlord
        }
      } : null;

      if (!lease) {
        res.status(404).json({ message: "Lease not found" });
        return;
      }
    }

    // Create payment record
    const [payment] = await db.insert(payments).values({
      amountDue: Number(amount),
      amountPaid: 0,
      dueDate: new Date(),
      paymentDate: new Date(),
      paymentStatus: "Pending",
      paystackReference: `payment_${Date.now()}_${Math.floor(Math.random() * 1000)}`, // Temporary ref, will update below
      leaseId: (paymentType === "initial_payment" || paymentType === "deposit") ? null : Number(leaseId),
      applicationId: null // will be linked later
    }).returning();

    // Initialize Paystack payment
    const reference = `payment_${payment.id}_${Date.now()}`;
    
    // Update payment with actual reference
    await db.update(payments)
      .set({ paystackReference: reference })
      .where(eq(payments.id, payment.id));

    const amountInKobo = Math.round(Number(amount) * 100);
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        reference,
        amount: amountInKobo,
        currency: "NGN",
        email: email,
        callback_url: `${process.env.CLIENT_URL}/payment/callback`,
        metadata: {
          paymentId: payment.id,
          leaseId: (paymentType === "initial_payment" || paymentType === "deposit") ? null : Number(leaseId),
          propertyId: (paymentType === "initial_payment" || paymentType === "deposit") ? Number(propertyId) : null,
          paymentType: paymentType,
          tenantId: (paymentType === "initial_payment" || paymentType === "deposit") ? tenantId : lease?.tenantCognitoId
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({
      paymentId: payment.id,
      url: paystackResponse.data?.data?.authorization_url,
      reference
    });
  } catch (error: any) {
    console.error("Payment initialization error:", error);
    if (axios.isAxiosError(error)) {
      console.error("Paystack API Error:", error.response?.data);
      res.status(500).json({ message: `Payment Gateway Error: ${error.response?.data?.message || error.message}` });
      return;
    }
    res.status(500).json({ message: `Error initializing payment: ${error.message}` });
  }
};

// Verify Flutterwave payment
export const verifyPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { reference } = req.params;

    // Verify payment with Paystack
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const paystackData = paystackResponse.data;
    const data = paystackData?.data;

    if (paystackData?.status === true && data?.status === "success") {
      const paymentId = parseInt(data?.metadata?.paymentId, 10);
      const leaseId = data?.metadata?.leaseId ? parseInt(data.metadata.leaseId, 10) : null;
      const propertyId = data?.metadata?.propertyId ? parseInt(data.metadata.propertyId, 10) : null;
      const paymentType = data?.metadata?.paymentType;
      const tenantId = data?.metadata?.tenantId;

      // Validate that paymentId is a valid number
      if (isNaN(paymentId)) {
        res.status(400).json({ success: false, message: "Invalid payment ID" });
        return;
      }

      // Validate propertyId if it exists and is required for the payment type
      if ((paymentType === "initial_payment" || paymentType === "deposit") && (!propertyId || isNaN(propertyId))) {
        res.status(400).json({ success: false, message: "Invalid or missing property ID for this payment type" });
        return;
      }

      // Validate leaseId if it exists
      if (data?.metadata?.leaseId && isNaN(leaseId!)) {
        res.status(400).json({ success: false, message: "Invalid lease ID" });
        return;
      }

      let updatedPayment;

      if (paymentType === "initial_payment") {
        // For initial payment, we need to create a lease first
        const propertyResult = await db.select()
          .from(properties)
          .leftJoin(locations, eq(properties.locationId, locations.id))
          .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
          .where(eq(properties.id, propertyId!))
          .limit(1);
        
        const property = propertyResult[0] ? {
          ...propertyResult[0].Property,
          location: propertyResult[0].Location,
          landlord: propertyResult[0].Landlord
      } : null;

      if (!property) {
        res.status(404).json({ success: false, message: "Property not found" });
        return;
      }

        // Get tenant information from the request or session
         // For now, we'll need to get tenant info from the payment metadata or request
         const tenantResult = await db.select()
           .from(tenants)
           .where(eq(tenants.cognitoId, tenantId || data.customer.email))
           .limit(1);
         
         const tenant = tenantResult[0] || null;

        if (!tenant) {
          res.status(404).json({ success: false, message: "Tenant not found" });
         return;
       }

       // Create lease
         const newLeaseResult = await db.insert(leases).values({
           rent: property.pricePerYear,
           deposit: property.securityDeposit,
           startDate: new Date(),
           endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
           tenantCognitoId: tenant.cognitoId,
           propertyId: property.id
         }).returning();
         
         const newLease = {
           ...newLeaseResult[0],
           tenant: tenant,
           property: property
         };

        // Also create a LandlordTenantRental record so the residence tab populates
        try {
          // Compute sensible defaults for rental
          const nextRentDueDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
          const leaseStartDate = new Date();
          const leaseEndDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1));

          // Ensure we have the landlord's numeric id from joined property
          const landlordIdNumeric = property.landlord?.id;
          const tenantIdNumeric = tenant.id;

          if (landlordIdNumeric && tenantIdNumeric) {
            await db.insert(landlordTenantRentals).values({
              tenantId: tenantIdNumeric,
              landlordId: landlordIdNumeric,
              rentAmount: property.pricePerYear,
              rentDueDate: nextRentDueDate,
              leaseStartDate,
              leaseEndDate,
              paymentMethod: 'Paystack',
              propertyAddress: property?.location?.address || 'N/A',
              isRentOverdue: false,
              applicationFeeAdded: false,
              securityDepositAdded: !!property.securityDeposit,
              hasBeenEditedByLandlord: false,
            }).onConflictDoNothing();
          }
        } catch (rentalErr) {
          // Do not fail payment verification if rental creation fails
          console.error('Failed to create LandlordTenantRental record:', rentalErr);
        }

        // Update payment record with the new lease
        await db.update(payments)
          .set({
            amountPaid: Number(data.amount) / 100,
            paymentStatus: "Paid",
            paymentDate: new Date(),
            leaseId: newLease.id
          })
          .where(eq(payments.id, paymentId));
        
        updatedPayment = {
          id: paymentId,
          amountPaid: Number(data.amount) / 100,
          paymentStatus: "Paid",
          paymentDate: new Date(),
          leaseId: newLease.id,
          lease: newLease
        };

        // Decrement available units and close listing when zero
        const currentPropertyResult = await db.select()
          .from(properties)
          .where(eq(properties.id, propertyId!))
          .limit(1);
        const currentProperty = currentPropertyResult[0] as any;
        if (currentProperty) {
          const newUnits = Math.max(0, (currentProperty.availableUnits || 0) - 1);
          await db.update(properties)
            .set({ availableUnits: newUnits, status: newUnits === 0 ? 'Closed' : 'Available' })
            .where(eq(properties.id, propertyId!));
        }

        // Attach the lease ID to the tenant's application for this property
        // and mark as Approved to reflect successful payment flow
        await db.update(applications)
          .set({ leaseId: newLease.id, status: 'Approved' })
          .where(and(
            eq(applications.propertyId, propertyId!),
            eq(applications.tenantCognitoId, tenant.cognitoId)
          ));

        // Send notification email to landlord
        if (newLease.property.landlord?.email) {
          await sendEmail({
            to: newLease.property.landlord.email,
            subject: propertyRentedNotificationTemplate.subject,
            body: propertyRentedNotificationTemplate.body(
              newLease.property.landlord.name,
              newLease.property?.location?.address || 'N/A',
              newLease.tenant.name,
              newLease.tenant.phoneNumber,
              newLease.property.pricePerYear
            )
          });
        }
      } else if (paymentType === "deposit") {
        // For deposit payment, update tenant's inspection limit
        const propertyResult = await db.select()
          .from(properties)
          .leftJoin(locations, eq(properties.locationId, locations.id))
          .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
          .where(eq(properties.id, propertyId!))
          .limit(1);
        
        const property = propertyResult[0] ? {
          ...propertyResult[0].Property,
          location: propertyResult[0].Location,
          landlord: propertyResult[0].Landlord
        } : null;

        if (!property) {
          res.status(404).json({ success: false, message: "Property not found" });
          return;
        }

        const tenantResult = await db.select()
          .from(tenants)
          .where(eq(tenants.cognitoId, tenantId))
          .limit(1);
        
        const tenant = tenantResult[0] || null;

        if (!tenant) {
          res.status(404).json({ success: false, message: "Tenant not found" });
          return;
        }

        // TODO: Update tenant's inspection limit to unlimited for one year
        // Note: InspectionLimit table needs to be added to Drizzle schema
        // const InspectionLimit = (prisma as any).inspectionLimit;
        // await InspectionLimit.upsert({
        //   where: { tenantCognitoId: tenantId },
        //   update: {
        //     hasUnlimited: true,
        //     unlimitedUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        //   },
        //   create: {
        //     tenantCognitoId: tenantId,
        //     freeInspections: 2,
        //     usedInspections: 0,
        //     hasUnlimited: true,
        //     unlimitedUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        //   }
        // });

        // Update payment record for deposit payment
        await db.update(payments)
          .set({
            amountPaid: Number(data.amount) / 100,
            paymentStatus: "Paid",
            paymentDate: new Date()
          })
          .where(eq(payments.id, paymentId));
        
        updatedPayment = {
          id: paymentId,
          amountPaid: Number(data.amount) / 100,
          paymentStatus: "Paid",
          paymentDate: new Date(),
          lease: null // No lease for deposit payments
        };
      } else {
        // Update payment record for existing lease payments
        await db.update(payments)
          .set({
            amountPaid: Number(data.amount) / 100,
            paymentStatus: "Paid",
            paymentDate: new Date()
          })
          .where(eq(payments.id, paymentId));
        
        // Get lease details for response
        const leaseResult = await db.select()
          .from(leases)
          .leftJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
          .leftJoin(properties, eq(leases.propertyId, properties.id))
          .leftJoin(locations, eq(properties.locationId, locations.id))
          .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
          .where(eq(leases.id, leaseId!))
          .limit(1);
        
        const lease = leaseResult[0] ? {
          ...leaseResult[0].Lease,
          tenant: leaseResult[0].Tenant,
          property: {
            ...leaseResult[0].Property,
            location: leaseResult[0].Location,
            landlord: leaseResult[0].Landlord
          }
        } : null;
        
        updatedPayment = {
          id: paymentId,
          amountPaid: Number(data.amount) / 100,
          paymentStatus: "Paid",
          paymentDate: new Date(),
          lease: lease
        };
      }



      // Send confirmation email
      if (paymentType === "deposit") {
        // Handle deposit payment email separately
        const tenantResult = await db.select()
          .from(tenants)
          .where(eq(tenants.cognitoId, tenantId))
          .limit(1);
        
        const propertyResult = await db.select()
          .from(properties)
          .leftJoin(locations, eq(properties.locationId, locations.id))
          .where(eq(properties.id, propertyId!))
          .limit(1);
        
        const tenant = tenantResult[0];
        const property = propertyResult[0] ? {
          ...propertyResult[0].Property,
          location: propertyResult[0].Location
        } : null;
        
        if (tenant && property) {
          await sendEmail({
            to: tenant.email,
            subject: "Deposit Payment Confirmation - Homematch",
            body: `
              <h2>Deposit Payment Successful!</h2>
              <p>Dear ${tenant.name},</p>
              <p>Your deposit payment of ₦${updatedPayment.amountPaid} has been successfully processed.</p>
              <p>Payment Details:</p>
              <ul>
                <li>Amount: ₦${updatedPayment.amountPaid}</li>
                <li>Property: ${property?.location?.address || 'N/A'}</li>
                <li>Payment Date: ${new Date().toLocaleDateString()}</li>
                <li>Reference: ${reference}</li>
              </ul>
              <p>Your inspection limit has been upgraded to unlimited for one year!</p>
              <p>Thank you for choosing Homematch!</p>
            `
          });
        }
      } else if (updatedPayment.lease) {
        // Handle existing lease payment emails (if any)
        // ...
      }

      res.json({ success: true, payment: updatedPayment });
    } else {
      res.json({ success: false, message: "Payment verification failed" });
    }
  } catch (error: any) {
    console.error("Payment verification error:", error?.response?.data || error);
    res.status(500).json({ success: false, message: `Error verifying payment: ${error.message}` });
  }
};

// Get payment history
export const getPaymentHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { tenantId } = req.params;

    const paymentsResult = await db.select()
      .from(payments)
      .leftJoin(leases, eq(payments.leaseId, leases.id))
      .leftJoin(properties, eq(leases.propertyId, properties.id))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .where(eq(leases.tenantCognitoId, tenantId))
      .orderBy(desc(payments.paymentDate));

    const formattedPayments = paymentsResult.map(result => ({
      ...result.Payment,
      lease: result.Lease ? {
        ...result.Lease,
        property: {
          ...result.Property,
          location: result.Location
        }
      } : null
    }));

    res.json(formattedPayments);
  } catch (error: any) {
    res.status(500).json({ message: `Error fetching payment history: ${error.message}` });
  }
};

// Create payment
export const createPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { leaseId, amount, dueDate } = req.body;

    const newPayment = await db.insert(payments).values({
      leaseId,
      amountDue: amount,
      amountPaid: 0,
      dueDate: new Date(dueDate),
      paymentDate: new Date(),
      paymentStatus: "Pending"
    }).returning();

    res.status(201).json(newPayment[0]);
  } catch (error: any) {
    res.status(500).json({ message: `Error creating payment: ${error.message}` });
  }
};