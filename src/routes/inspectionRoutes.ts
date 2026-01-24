import express from "express";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/authMiddleware";
import { sendInspectionRequestEmail, sendInspectionApprovedEmail } from "../utils/emailSubscriptionService";
import { db } from "../utils/database";
import { inspectionLimits, inspections, properties, agents, locations } from "../db/schema";

const router = express.Router();

// Get tenant's inspection limit
router.get("/limit/:tenantCognitoId", authMiddleware(["tenant"]), async (req, res) => {
  try {
    const { tenantCognitoId } = req.params;
    
    let [inspectionLimit] = await db.select().from(inspectionLimits)
      .where(eq(inspectionLimits.tenantCognitoId, tenantCognitoId))
      .limit(1);
    
    if (!inspectionLimit) {
      [inspectionLimit] = await db.insert(inspectionLimits)
        .values({
          tenantCognitoId,
          freeInspections: 2,
          usedInspections: 0,
          hasUnlimited: false
        })
        .returning();
    }
    
    res.json(inspectionLimit);
  } catch (error) {
    console.error("Error fetching inspection limit:", error);
    res.status(500).json({ error: "Failed to fetch inspection limit" });
  }
});

// Create inspection request
router.post("/request", authMiddleware(["tenant"]), async (req, res) => {
  try {
    const {
      propertyId,
      tenantCognitoId,
      tenantName,
      tenantEmail,
      tenantPhone,
      preferredTime,
      message,
      depositPaid = false,
      depositAmount,
      paymentReference
    } = req.body;

    // Calculate scheduled date (3 days ahead)
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 3);

    // Check inspection limit
    let [inspectionLimit] = await db.select().from(inspectionLimits)
      .where(eq(inspectionLimits.tenantCognitoId, tenantCognitoId))
      .limit(1);

    if (!inspectionLimit) {
      [inspectionLimit] = await db.insert(inspectionLimits)
        .values({
          tenantCognitoId,
          freeInspections: 2,
          usedInspections: 0,
          hasUnlimited: false
        })
        .returning();
    }

    // Check if tenant can request inspection
    const canRequestFree = inspectionLimit.usedInspections < inspectionLimit.freeInspections;
    const hasUnlimited = inspectionLimit.hasUnlimited && 
      (inspectionLimit.unlimitedUntil ? new Date() < inspectionLimit.unlimitedUntil : true);

    if (!canRequestFree && !hasUnlimited && !depositPaid) {
      res.status(400).json({ 
        error: "Free inspection limit exceeded. Deposit payment required.",
        requiresDeposit: true,
        depositAmount: 0.4 // 40% of property price
      });
      return;
    }

    // Get property details to find nearest agent
    const [property] = await db.select().from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!property) {
      res.status(404).json({ error: "Property not found" });
      return;
    }

    // Find nearest agent (simplified - in real implementation, use geolocation)
    const [nearestAgent] = await db.select().from(agents)
      .limit(1);

    // Create inspection
    const [inspection] = await db.insert(inspections)
      .values({
        propertyId,
        tenantCognitoId,
        scheduledDate,
        tenantName,
        tenantEmail,
        tenantPhone,
        preferredTime,
        message,
        agentId: nearestAgent?.id,
        depositPaid,
        depositAmount,
        paymentReference
      })
      .returning();

    // Update inspection limit if using free inspection
    if (!depositPaid && canRequestFree) {
      await db.update(inspectionLimits)
        .set({
          usedInspections: inspectionLimit.usedInspections + 1
        })
        .where(eq(inspectionLimits.tenantCognitoId, tenantCognitoId));
    }

    // Send email notification to tenant about pending request
    try {
      // Get property location for email
      const [propertyLocation] = await db.select({
        address: locations.address
      })
      .from(properties)
      .innerJoin(locations, eq(properties.locationId, locations.id))
      .where(eq(properties.id, propertyId))
      .limit(1);
      
      if (propertyLocation) {
        await sendInspectionRequestEmail(
          tenantEmail,
          tenantName,
          propertyLocation.address,
          scheduledDate.toLocaleDateString(),
          preferredTime
        );
        console.log(`Inspection request email sent to tenant: ${tenantEmail}`);
      }
    } catch (emailError) {
      console.error('Error sending inspection request email:', emailError);
      // Don't fail the inspection creation if email fails
    }
    
    res.status(201).json(inspection);
  } catch (error) {
    console.error("Error creating inspection:", error);
    res.status(500).json({ error: "Failed to create inspection request" });
  }
});

// Get tenant's inspections
router.get("/tenant/:tenantCognitoId", authMiddleware(["tenant"]), async (req, res) => {
  try {
    const { tenantCognitoId } = req.params;
    
    const inspectionsList = await db.select().from(inspections)
      .where(eq(inspections.tenantCognitoId, tenantCognitoId))
      .orderBy(inspections.createdAt);
    
    res.json(inspectionsList);
    

  } catch (error) {
    console.error("Error fetching tenant inspections:", error);
    res.status(500).json({ error: "Failed to fetch inspections" });
  }
});

// Get all inspections (admin)
router.get("/admin", authMiddleware(["admin"]), async (_req, res) => {
  try {
    const inspectionsList = await db.select().from(inspections)
      .orderBy(inspections.createdAt);
    
    res.json(inspectionsList);
  } catch (error) {
    console.error("Error fetching admin inspections:", error);
    res.status(500).json({ error: "Failed to fetch inspections" });
  }
});

// Update inspection status (admin)
router.put("/:id/status", authMiddleware(["admin", "agent"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    
    const [inspection] = await db.update(inspections)
      .set({
        status,
        adminNotes,
        updatedAt: new Date()
      })
      .where(eq(inspections.id, parseInt(id)))
      .returning();
    
    // Send notification emails based on status change
    if (status === 'Approved' && inspection.agentId) {
      try {
        // Get property and location details
        const [propertyWithLocation] = await db.select({
          address: locations.address
        })
        .from(properties)
        .innerJoin(locations, eq(properties.locationId, locations.id))
        .where(eq(properties.id, inspection.propertyId))
        .limit(1);
        
        // Get agent details
        const [agent] = await db.select({
          name: agents.name,
          phoneNumber: agents.phoneNumber
        })
        .from(agents)
        .where(eq(agents.id, inspection.agentId))
        .limit(1);
        
        if (propertyWithLocation && agent) {
          await sendInspectionApprovedEmail(
            inspection.tenantEmail,
            inspection.tenantName,
            propertyWithLocation.address,
            inspection.scheduledDate.toLocaleDateString(),
            inspection.preferredTime,
            agent.name,
            agent.phoneNumber || 'N/A'
          );
        }
        console.log(`Inspection approved email sent to tenant: ${inspection.tenantEmail}`);
      } catch (emailError) {
        console.error('Error sending inspection approved email:', emailError);
        // Don't fail the status update if email fails
      }
    }
    
    res.json(inspection);
  } catch (error) {
    console.error("Error updating inspection status:", error);
    res.status(500).json({ error: "Failed to update inspection status" });
  }
});

// Process deposit payment for unlimited inspections
router.post("/deposit/payment", authMiddleware(["tenant"]), async (req, res) => {
  try {
    const {
      tenantCognitoId,
      propertyId,
      paymentReference,
      amount
    } = req.body;

    // Get property price for deposit calculation
    const [property] = await db.select().from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!property) {
      res.status(404).json({ error: "Property not found" });
      return;
    }

    const requiredDeposit = property.pricePerYear * 0.4; // 40% deposit

    if (amount < requiredDeposit) {
      res.status(400).json({ 
        error: "Insufficient deposit amount",
        required: requiredDeposit,
        provided: amount
      });
      return;
    }

    // Log payment reference for audit purposes
    console.log(`Processing deposit payment with reference: ${paymentReference}`);

    // Update inspection limit to unlimited
    const unlimitedUntil = new Date();
    unlimitedUntil.setFullYear(unlimitedUntil.getFullYear() + 1); // 1 year unlimited

    const [inspectionLimit] = await db.insert(inspectionLimits)
      .values({
        tenantCognitoId,
        freeInspections: 2,
        usedInspections: 0,
        hasUnlimited: true,
        unlimitedUntil
      })
      .onConflictDoUpdate({
        target: inspectionLimits.tenantCognitoId,
        set: {
          hasUnlimited: true,
          unlimitedUntil
        }
      })
      .returning();

    res.json({
      success: true,
      inspectionLimit,
      paymentReference,
      message: "Deposit processed successfully. You now have unlimited inspections for 1 year."
    });
  } catch (error) {
    console.error("Error processing deposit payment:", error);
    res.status(500).json({ error: "Failed to process deposit payment" });
  }
});

export default router;