import dotenv from 'dotenv';
dotenv.config();

import { db } from '../utils/database';
import { landlords, properties, locations } from '../db/schema';
import { eq } from 'drizzle-orm';

async function seed() {
  try {
    console.log('Starting seed: 1 landlord, 10 properties');

    // 1) Upsert landlord
    const landlordCognitoId = `seed-landlord-${Date.now()}`;
    const landlordEmail = 'seed.landlord@homematch.com';

    const existingLandlord = await db
      .select()
      .from(landlords)
      .where(eq(landlords.email, landlordEmail));

    let landlordRecord = existingLandlord[0];

    if (!landlordRecord) {
      const [created] = await db
        .insert(landlords)
        .values({
          cognitoId: landlordCognitoId,
          name: 'Seed Landlord',
          email: landlordEmail,
          phoneNumber: '+2348012345678',
          currentAddress: '10 Adeola Odeku St, Victoria Island',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria',
          postalCode: '100001',
          isOnboardingComplete: true,
          onboardedAt: new Date(),
        })
        .returning();
      landlordRecord = created;
      console.log('Created landlord:', landlordRecord);
    } else {
      console.log('Landlord already exists:', landlordRecord);
    }

    // 2) Create 10 locations and properties for this landlord
    const sampleAddresses = [
      '1 Admiralty Way, Lekki Phase 1',
      '22 Bourdillon Rd, Ikoyi',
      '15 Idowu Martins St, Victoria Island',
      '8 Mobolaji Bank Anthony Way, Ikeja',
      '33 Herbert Macaulay Way, Yaba',
      '12 Glover Rd, Ikoyi',
      '5 Kingsway Rd, Ikoyi',
      '18 Adewale Kolawole St, Lekki',
      '7 Akin Adesola St, Victoria Island',
      '20 Ozumba Mbadiwe Ave, Victoria Island',
    ];

    const propertyTypes: Array<'SelfContain' | 'Apartment' | 'Bungalow' | 'Duplex'> = [
      'Apartment', 'Duplex', 'SelfContain', 'Bungalow', 'Apartment',
      'Apartment', 'Duplex', 'SelfContain', 'Apartment', 'Bungalow',
    ];

    const photoPools: string[][] = [
      ['/landing-i1.png'],
      ['/landing-i2.png'],
      ['/landing-i3.png'],
      ['/landing-i4.png'],
      ['/landing-i5.png'],
      ['/landing-i6.png'],
      ['/landing-i7.png'],
      ['/singlelisting-2.jpg'],
      ['/singlelisting-3.jpg'],
      ['/placeholder.jpg'],
    ];

    for (let i = 0; i < 10; i++) {
      const address = sampleAddresses[i];
      const city = 'Lagos';
      const state = 'Lagos';
      const country = 'Nigeria';
      const postalCode = '100001';

      const [loc] = await db
        .insert(locations)
        .values({
          address,
          city,
          state,
          country,
          postalCode,
          coordinates: null,
        })
        .returning();

      const pricePerYear = 800_000 + i * 50_000; // Naira per year
      const securityDeposit = Math.round(pricePerYear * 0.1);
      const applicationFee = 10_000;
      const beds = 1 + (i % 4);
      const baths = 1 + (i % 3);
      const squareFeet = 500 + i * 50;
      const propertyType = propertyTypes[i];
      const photoUrls = photoPools[i];

      const [prop] = await db
        .insert(properties)
        .values({
          name: `Seed Property ${i + 1}`,
          description: `Spacious ${propertyType} in ${city}, suitable for yearly rentals.`,
          pricePerYear,
          securityDeposit,
          applicationFee,
          photoUrls,
          videoUrl: null,
          amenities: 'Air Conditioning, Gated Estate, Security',
          isParkingIncluded: i % 2 === 0,
          beds,
          baths,
          squareFeet,
          propertyType,
          locationId: loc.id,
          landlordCognitoId: landlordRecord.cognitoId,
        })
        .returning();

      console.log(`Created property ${prop.id}: ${prop.name} at ${address}`);
    }

    console.log('Seeding completed successfully');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  }
}

seed().then(() => process.exit(0)).catch(() => process.exit(1));