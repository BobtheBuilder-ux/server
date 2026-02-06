"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const uuid_1 = require("uuid");
async function seed() {
    console.log("Seeding Real Estate data...");
    const companies = [
        { name: "Lagos Luxury Homes", email: "contact@lagosluxury.com", phone: "+2348012345678" },
        { name: "Abuja Estates Ltd", email: "info@abujaestates.com", phone: "+2348023456789" },
        { name: "Port Harcourt Properties", email: "sales@phproperties.com", phone: "+2348034567890" },
        { name: "Island Realty Group", email: "hello@islandrealty.ng", phone: "+2348045678901" },
        { name: "Mainland Housing Solutions", email: "support@mainlandhousing.com", phone: "+2348056789012" },
    ];
    for (const company of companies) {
        const userId = (0, uuid_1.v4)();
        const existingUsers = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, company.email));
        const existingUser = existingUsers[0];
        let finalUserId = userId;
        if (!existingUser) {
            await db_1.db.insert(schema_1.users).values({
                id: userId,
                email: company.email,
                name: company.name,
                role: "real_estate_company",
                phoneNumber: company.phone,
                emailVerified: true,
                isOnboardingComplete: true,
            });
        }
        else {
            finalUserId = existingUser.id;
        }
        const existingCompanies = await db_1.db.select().from(schema_1.realEstateCompanies).where((0, drizzle_orm_1.eq)(schema_1.realEstateCompanies.email, company.email));
        const existingCompany = existingCompanies[0];
        let companyId;
        if (!existingCompany) {
            const [newCompany] = await db_1.db.insert(schema_1.realEstateCompanies).values({
                userId: finalUserId,
                companyName: company.name,
                licenseNumber: `REC-${Math.floor(Math.random() * 10000)}`,
                email: company.email,
                phoneNumber: company.phone,
                address: "123 Sample Street, Lagos",
                description: "Leading real estate company in Nigeria providing top-notch property solutions.",
                verificationStatus: "Approved",
                isVerified: true,
            }).returning();
            companyId = newCompany.id;
        }
        else {
            companyId = existingCompany.id;
        }
        const listingTypes = ["Land", "Property"];
        const propertyTypes = ["Apartment", "Duplex", "Bungalow", "Mansion"];
        const locations = ["Lekki", "Ikoyi", "Victoria Island", "Ikeja", "Maitama", "Wuse"];
        const existingListings = await db_1.db.select().from(schema_1.saleListings).where((0, drizzle_orm_1.eq)(schema_1.saleListings.realEstateCompanyId, companyId));
        if (existingListings.length === 0) {
            for (let i = 0; i < 4; i++) {
                const type = listingTypes[Math.floor(Math.random() * listingTypes.length)];
                const location = locations[Math.floor(Math.random() * locations.length)];
                await db_1.db.insert(schema_1.saleListings).values({
                    realEstateCompanyId: companyId,
                    type: type,
                    title: `${type === "Land" ? "Prime Land" : "Luxury " + propertyTypes[Math.floor(Math.random() * propertyTypes.length)]} in ${location}`,
                    description: "Beautiful property located in a serene environment with excellent facilities.",
                    locationAddress: `Plot ${i + 1}, ${location} Phase 1`,
                    city: location === "Maitama" || location === "Wuse" ? "Abuja" : "Lagos",
                    state: location === "Maitama" || location === "Wuse" ? "FCT" : "Lagos",
                    price: 50000000 + Math.floor(Math.random() * 450000000),
                    status: "Approved",
                    createdByUserId: finalUserId,
                    submittedByRole: "real_estate_company",
                    propertyType: type === "Property" ? propertyTypes[Math.floor(Math.random() * propertyTypes.length)] : undefined,
                    size: 500 + Math.floor(Math.random() * 1000),
                    sizeUnit: "sqm",
                    imageUrls: [
                        `https://images.unsplash.com/photo-1600596542815-2250c385e381?w=800&auto=format&fit=crop&q=60`,
                        `https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=60`,
                        `https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&auto=format&fit=crop&q=60`
                    ],
                    features: ["Swimming Pool", "Gym", "24/7 Power", "Security"],
                });
            }
        }
    }
    console.log("Seeding complete!");
    process.exit(0);
}
seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
