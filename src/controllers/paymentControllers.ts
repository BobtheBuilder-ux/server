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

    let lease = null;
    let property = null;

    if (paymentType === "initial_payment" || paymentType === "deposit") {
      // For initial payment and deposit, validate property exists
      const propertyResult = await db.select()
        .from(properties)
        .leftJoin(locations, eq(properties.locationId, locations.id))
        .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
        .where(eq(properties.id, propertyId))
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
      // For other payment types, validate lease exists
      const leaseResult = await db.select()
        .from(leases)
        .leftJoin(tenants, eq(leases.tenantCognitoId, tenants.cognitoId))
        .leftJoin(properties, eq(leases.propertyId, properties.id))
        .leftJoin(locations, eq(properties.locationId, locations.id))
        .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
        .where(eq(leases.id, leaseId))
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
      amountDue: amount,
      amountPaid: 0,
      dueDate: new Date(),
      paymentDate: new Date(),
      paymentStatus: "Pending",
      leaseId: (paymentType === "initial_payment" || paymentType === "deposit") ? null : leaseId
    }).returning();

    // Initialize Paystack payment
    const reference = `payment_${payment.id}_${Date.now()}`;
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
          leaseId: (paymentType === "initial_payment" || paymentType === "deposit") ? null : leaseId,
          propertyId: (paymentType === "initial_payment" || paymentType === "deposit") ? propertyId : null,
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
        if (paymentType === "initial_payment") {
          // Ensure lease data is available
          if (!updatedPayment.lease.tenant || !updatedPayment.lease.property) {
            throw new Error("Incomplete lease data for PDF generation");
          }

          // Generate lease agreement PDF
          const leaseAgreementPDF = await generateLeaseAgreement({
            tenantName: updatedPayment.lease.tenant.name,
            tenantEmail: updatedPayment.lease.tenant.email,
            tenantPhone: updatedPayment.lease.tenant.phoneNumber,
            propertyAddress: updatedPayment.lease?.property?.location?.address || 'N/A',
            propertyName: updatedPayment.lease?.property?.name || 'Property',
            landlordName: updatedPayment.lease?.property?.landlord?.name || 'N/A',
            landlordEmail: updatedPayment.lease?.property?.landlord?.email || 'N/A',
            landlordPhone: updatedPayment.lease?.property?.landlord?.phoneNumber || 'N/A',
            rentAmount: updatedPayment.lease.rent,
            securityDeposit: updatedPayment.lease.deposit,
            leaseStartDate: updatedPayment.lease.startDate,
            leaseEndDate: updatedPayment.lease.endDate,
            paymentDate: new Date(),
            paymentReference: reference
          });

          // Send congratulatory email with lease agreement
          await sendEmail({
            to: updatedPayment.lease.tenant.email,
            subject: "🎉 Congratulations! Your Property Payment is Complete - Homematch",
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-size: 24px;">🎉 Congratulations!</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px;">Your property payment has been successfully completed!</p>
                </div>
                
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <h2 style="color: #1f2937; margin-top: 0;">Dear ${updatedPayment.lease.tenant.name},</h2>
                  
                  <p style="color: #4b5563; line-height: 1.6;">We're thrilled to confirm that your payment has been successfully processed! The property is now officially yours, and it has been removed from our search listings.</p>
                  
                  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #1f2937; margin-top: 0;">📋 Payment Summary</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Property:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${updatedPayment.lease.property.name}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Address:</td>
                        <td style="padding: 8px 0; color: #1f2937;">${updatedPayment.lease?.property?.location?.address || 'N/A'}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Yearly Rent:</td>
                        <td style="padding: 8px 0; color: #1f2937;">₦${updatedPayment.lease?.property?.pricePerYear?.toLocaleString?.() || updatedPayment.lease?.property?.pricePerYear}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Application Fee (10%):</td>
                        <td style="padding: 8px 0; color: #1f2937;">₦${updatedPayment.lease?.property?.applicationFee?.toLocaleString?.() || (((updatedPayment.lease?.property?.pricePerYear ?? 0) * 0.10).toLocaleString())}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Caution Fee (15%):</td>
                        <td style="padding: 8px 0; color: #1f2937;">₦${updatedPayment.lease?.property?.securityDeposit?.toLocaleString?.() || (((updatedPayment.lease?.property?.pricePerYear ?? 0) * 0.15).toLocaleString())}</td>
                      </tr>
                      ${updatedPayment.lease?.property?.serviceCharge && updatedPayment.lease.property.serviceCharge > 0 ? `
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Service Charge:</td>
                        <td style="padding: 8px 0; color: #1f2937;">₦${updatedPayment.lease.property.serviceCharge.toLocaleString()}</td>
                      </tr>` : ''}
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Total Amount Paid:</td>
                        <td style="padding: 8px 0; color: #10b981; font-weight: bold; font-size: 18px;">₦${updatedPayment.amountPaid.toLocaleString()}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Payment Date:</td>
                        <td style="padding: 8px 0; color: #1f2937;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 0; color: #6b7280;">Lease Period:</td>
                        <td style="padding: 8px 0; color: #1f2937;">${updatedPayment.lease.startDate.toLocaleDateString()} - ${updatedPayment.lease.endDate.toLocaleDateString()}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Reference:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-family: monospace;">${reference}</td>
                      </tr>
                    </table>
                  </div>
                  
                  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                    <h4 style="color: #92400e; margin: 0 0 10px 0;">📄 Tenancy Agreement Attached</h4>
                    <p style="color: #92400e; margin: 0; font-size: 14px;">Your personalized tenancy agreement is attached to this email. Please review, sign, and keep it for your records.</p>
                  </div>
                  
                  <h3 style="color: #1f2937;">🏠 What's Next?</h3>
                  <ul style="color: #4b5563; line-height: 1.6;">
                    <li>Review and sign your tenancy agreement</li>
                    <li>The property has been removed from search listings</li>
                    <li>You can now access your property details in your dashboard</li>
                    <li>Contact your landlord for move-in arrangements</li>
                  </ul>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.CLIENT_URL}/tenants/residences" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Your Dashboard</a>
                  </div>
                  
                  <p style="color: #4b5563; line-height: 1.6;">If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                  
                  <p style="color: #4b5563; margin-bottom: 0;">Welcome to your new home!</p>
                  <p style="color: #10b981; font-weight: bold;">The Homematch Team</p>
                </div>
              </div>
            `,
            attachments: [{
              filename: `Lease_Agreement_${updatedPayment.lease?.property?.name?.replace(/\s+/g, '_') || 'Property'}_${new Date().toISOString().split('T')[0]}.pdf`,
              content: leaseAgreementPDF,
              contentType: 'application/pdf'
            }]
          });
        } else {
          // Regular payment confirmation
          await sendEmail({
            to: updatedPayment.lease?.tenant?.email || '',
            subject: "Payment Confirmation - Homematch",
            body: `
              <h2>Payment Successful!</h2>
              <p>Dear ${updatedPayment.lease?.tenant?.name || 'Tenant'},</p>
              <p>Your payment of ₦${updatedPayment.amountPaid} has been successfully processed.</p>
              <p>Payment Details:</p>
              <ul>
                <li>Amount: ₦${updatedPayment.amountPaid}</li>
                <li>Property: ${updatedPayment.lease?.property?.location?.address || 'N/A'}</li>
                <li>Payment Date: ${new Date().toLocaleDateString()}</li>
                <li>Reference: ${reference}</li>
              </ul>
              <p>Thank you for choosing Homematch!</p>
            `
          });
        }

        // Send SMS notifications for payment confirmation
        try {
          const paymentNotificationService = new PaymentNotificationService();
          await paymentNotificationService.processPaymentNotifications(updatedPayment.id);
        } catch (smsError) {
          console.error("SMS notification error:", smsError);
          // Don't fail the payment verification if SMS fails
        }
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