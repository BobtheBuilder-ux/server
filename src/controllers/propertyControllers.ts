import { Request, Response } from "express";
import { eq, and, gte, lte, desc, asc, like, count } from "drizzle-orm";
import { db } from "../utils/database";
import { properties, landlords, locations } from "../db/schema";
import { uploadMultipleBuffersToCloudinary, uploadBufferToCloudinary } from "../utils/cloudinaryService";

import axios from "axios";

// S3 client moved to s3Service utility

export const getProperties = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    let whereConditions: any[] = [];
    // Only show properties that are available and have inventory
    whereConditions.push(eq(properties.status, 'Available'));
    whereConditions.push(gte(properties.availableUnits, 1));
    
    if (req.query.priceMin) {
      whereConditions.push(gte(properties.pricePerYear, parseFloat(req.query.priceMin as string)));
    }
    if (req.query.priceMax) {
      whereConditions.push(lte(properties.pricePerYear, parseFloat(req.query.priceMax as string)));
    }
    if (req.query.beds) {
      whereConditions.push(eq(properties.beds, parseInt(req.query.beds as string)));
    }
    if (req.query.baths) {
      whereConditions.push(eq(properties.baths, parseInt(req.query.baths as string)));
    }
    if (req.query.propertyType) {
      const validPropertyTypes = ['SelfContain', 'Apartment', 'Bungalow', 'Duplex'];
      const propertyType = req.query.propertyType as string;
      if (validPropertyTypes.includes(propertyType)) {
        whereConditions.push(eq(properties.propertyType, propertyType as 'SelfContain' | 'Apartment' | 'Bungalow' | 'Duplex'));
      }
    }
    if (req.query.name) {
      whereConditions.push(like(properties.name, `%${req.query.name}%`));
    }
    if (req.query.location) {
      // Handle location as a string (city name) instead of numeric locationId
      const locationName = req.query.location as string;
      // We'll need to join with locations table to filter by city name
      // For now, let's check if it's a number (locationId) or string (city name)
      const locationId = parseInt(locationName);
      if (!isNaN(locationId)) {
        // If it's a valid number, use it as locationId
        whereConditions.push(eq(properties.locationId, locationId));
      } else {
        // If it's a string, we'll handle it in the query by joining with locations table
        // Add location city filter
        whereConditions.push(like(locations.city, `%${locationName}%`));
      }
    }

    // Build the final where clause with all conditions
    const finalWhereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Build orderBy clause
    const sortBy = req.query.sortBy as string || 'postedDate';
    const sortOrder = req.query.sortOrder as string || 'desc';
    
    let orderByColumn;
    switch (sortBy) {
      case 'name':
        orderByColumn = properties.name;
        break;
      case 'pricePerYear':
        orderByColumn = properties.pricePerYear;
        break;
      case 'beds':
        orderByColumn = properties.beds;
        break;
      case 'baths':
        orderByColumn = properties.baths;
        break;
      case 'postedDate':
      default:
        orderByColumn = properties.postedDate;
        break;
    }
    
    const orderByClause = sortOrder === 'desc' ? desc(orderByColumn) : asc(orderByColumn);

    const [propertiesList, totalCount] = await Promise.all([
      db.select({
        id: properties.id,
        name: properties.name,
        description: properties.description,
        pricePerYear: properties.pricePerYear,
        serviceCharge: properties.serviceCharge,
        beds: properties.beds,
        baths: properties.baths,
        propertyType: properties.propertyType,
        locationId: properties.locationId,
        photoUrls: properties.photoUrls,
        amenities: properties.amenities,
        postedDate: properties.postedDate,
        landlordCognitoId: properties.landlordCognitoId,
        availableUnits: properties.availableUnits,
        landlord: {
          id: landlords.id,
          name: landlords.name,
          email: landlords.email,
          phoneNumber: landlords.phoneNumber
        },
        location: {
          id: locations.id,
          address: locations.address,
          city: locations.city,
          state: locations.state,
          country: locations.country,
          coordinates: locations.coordinates
        }
      })
      .from(properties)
      .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .where(finalWhereClause)
      .orderBy(orderByClause)
      .offset(skip)
      .limit(limit),
      
      db.select({ count: count() })
      .from(properties)
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .where(finalWhereClause)
    ]);

    const total = totalCount[0]?.count || 0;

    res.json({
      properties: propertiesList,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Error retrieving properties:', error);
    res
      .status(500)
      .json({ message: `Error retrieving properties: ${error.message}` });
  }
};

export const getProperty = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const propertyResult = await db.select({
      id: properties.id,
      name: properties.name,
      description: properties.description,
      pricePerYear: properties.pricePerYear,
      serviceCharge: properties.serviceCharge,
      beds: properties.beds,
      baths: properties.baths,
      propertyType: properties.propertyType,
      photoUrls: properties.photoUrls,
      amenities: properties.amenities,
      postedDate: properties.postedDate,
      availableUnits: properties.availableUnits,

      locationId: properties.locationId,
      landlord: {
        id: landlords.id,
        name: landlords.name,
        email: landlords.email,
        phoneNumber: landlords.phoneNumber
      },
      locationData: {
        id: locations.id,
        address: locations.address,
        state: locations.state,
        country: locations.country
      }
    })
    .from(properties)
    .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
    .leftJoin(locations, eq(properties.locationId, locations.id))
    .where(eq(properties.id, Number(id)))
    .limit(1);

    if (propertyResult.length === 0) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const property = {
      ...propertyResult[0],
      location: propertyResult[0].locationData
    };
    delete (property as any).locationData;

    res.json(property);
  } catch (err: any) {
    res
      .status(500)
      .json({ message: `Error retrieving property: ${err.message}` });
  }
};

export const createProperty = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log('Creating property with data:', req.body);
    console.log('Files received:', req.files);
    console.log('Authenticated user:', req.user);
    
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const {
      address,
      city,
      state,
      country,
      postalCode,
      ...propertyData
    } = req.body;

    // Get landlord's cognitoId from the authenticated user's profile
    if (!req.user || req.user.role !== 'landlord') {
      res.status(403).json({ message: "Only landlords can create properties" });
      return;
    }

    // Get the landlord's cognitoId from their profile
    const [landlordProfile] = await db.select().from(landlords).where(eq(landlords.userId, req.user.id)).limit(1);
    
    if (!landlordProfile) {
      res.status(404).json({ message: "Landlord profile not found" });
      return;
    }

    const landlordCognitoId = landlordProfile.cognitoId;

    // Upload property photos to Cloudinary
    let photoUrls: string[] = [];
    if (files?.photos && files.photos.length > 0) {
      try {
        const fileData = files.photos.map(file => ({
          buffer: file.buffer,
          fileName: file.originalname,
          resourceType: file.mimetype.startsWith('image/') ? ('image' as const) : ('raw' as const),
        }));

        const uploadResults = await uploadMultipleBuffersToCloudinary(fileData, 'properties/photos');
        photoUrls = uploadResults.map(result => result.url);
        console.log(`Successfully uploaded ${photoUrls.length} property photos`);
      } catch (uploadError) {
        console.error('Error uploading property photos:', uploadError);
        // Continue with property creation even if photo upload fails
        photoUrls = [];
      }
    }

    // Upload property video to Cloudinary (optional)
    let videoUrl: string | null = null;
    if (files?.video && files.video.length > 0) {
      try {
        const videoFile = files.video[0];
        const uploadResult = await uploadBufferToCloudinary(
          videoFile.buffer,
          videoFile.originalname,
          'properties/videos',
          'video'
        );
        videoUrl = uploadResult.url;
        console.log('Successfully uploaded property video');
      } catch (uploadError) {
        console.error('Error uploading property video:', uploadError);
        // Continue with property creation even if video upload fails
        videoUrl = null;
      }
    }

    const geocodingUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams(
      {
        street: address,
        city,
        country,
        postalcode: postalCode,
        format: "json",
        limit: "1",
      }
    ).toString()}`;
    const geocodingResponse = await axios.get(geocodingUrl, {
      headers: {
        "User-Agent": "RealEstateApp (justsomedummyemail@gmail.com",
      },
    });
    const [longitude, latitude] =
      geocodingResponse.data && geocodingResponse.data.length > 0 && geocodingResponse.data[0]?.lon && geocodingResponse.data[0]?.lat
        ? [
            parseFloat(geocodingResponse.data[0]?.lon),
            parseFloat(geocodingResponse.data[0]?.lat),
          ]
        : [0, 0];

    // create location
    const [location] = await db.insert(locations).values({
      address,
      city,
      state,
      country,
      postalCode,
      coordinates: `POINT(${longitude} ${latitude})`
    }).returning();

    // create property
    const [newPropertyData] = await db.insert(properties).values({
      ...propertyData,
      photoUrls,
      videoUrl,
      locationId: location.id,
      landlordCognitoId,
      status: 'PendingApproval', // New properties require admin approval
      amenities:
        typeof propertyData.amenities === "string"
          ? propertyData.amenities
          : Array.isArray(propertyData.amenities)
          ? propertyData.amenities.join(", ")
          : null,

      isParkingIncluded: propertyData.isParkingIncluded === "true",
      pricePerYear: parseFloat(propertyData.pricePerYear),
      serviceCharge: Math.max(0, parseFloat(propertyData.serviceCharge ?? '0')),
      securityDeposit: parseFloat(propertyData.pricePerYear) * 0.15, // 15% caution fee
      applicationFee: parseFloat(propertyData.pricePerYear) * 0.10, // 10% application fee
      beds: parseInt(propertyData.beds),
      baths: parseFloat(propertyData.baths),
      squareFeet: parseInt(propertyData.squareFeet),
      availableUnits: Math.max(0, parseInt(propertyData.availableUnits ?? '1')),
    }).returning();

    // Get the complete property with relations
    const newProperty = await db.select()
      .from(properties)
      .leftJoin(locations, eq(properties.locationId, locations.id))
      .leftJoin(landlords, eq(properties.landlordCognitoId, landlords.cognitoId))
      .where(eq(properties.id, newPropertyData.id))
      .limit(1)
      .then(result => {
        if (result.length === 0) return null;
        const row = result[0];
        return {
          ...row.Property,
          location: row.Location,
          landlord: row.Landlord
        };
      });

    res.status(201).json(newProperty);
  } catch (err: any) {
    console.error('Error creating property:', err);
    res
      .status(500)
      .json({ message: `Error creating property: ${err.message}` });
  }
};
