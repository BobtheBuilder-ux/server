"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProperty = exports.getProperty = exports.getProperties = void 0;
const tslib_1 = require("tslib");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const cloudinaryService_1 = require("../utils/cloudinaryService");
const axios_1 = tslib_1.__importDefault(require("axios"));
const getProperties = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        let whereConditions = [];
        whereConditions.push((0, drizzle_orm_1.eq)(schema_1.properties.status, 'Available'));
        whereConditions.push((0, drizzle_orm_1.gte)(schema_1.properties.availableUnits, 1));
        if (req.query.priceMin) {
            whereConditions.push((0, drizzle_orm_1.gte)(schema_1.properties.pricePerYear, parseFloat(req.query.priceMin)));
        }
        if (req.query.priceMax) {
            whereConditions.push((0, drizzle_orm_1.lte)(schema_1.properties.pricePerYear, parseFloat(req.query.priceMax)));
        }
        if (req.query.beds) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.properties.beds, parseInt(req.query.beds)));
        }
        if (req.query.baths) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.properties.baths, parseInt(req.query.baths)));
        }
        if (req.query.propertyType) {
            const validPropertyTypes = ['SelfContain', 'Apartment', 'Bungalow', 'Duplex'];
            const propertyType = req.query.propertyType;
            if (validPropertyTypes.includes(propertyType)) {
                whereConditions.push((0, drizzle_orm_1.eq)(schema_1.properties.propertyType, propertyType));
            }
        }
        if (req.query.name) {
            whereConditions.push((0, drizzle_orm_1.like)(schema_1.properties.name, `%${req.query.name}%`));
        }
        if (req.query.location) {
            const locationName = req.query.location;
            const locationId = parseInt(locationName);
            if (!isNaN(locationId)) {
                whereConditions.push((0, drizzle_orm_1.eq)(schema_1.properties.locationId, locationId));
            }
            else {
                whereConditions.push((0, drizzle_orm_1.like)(schema_1.locations.city, `%${locationName}%`));
            }
        }
        const finalWhereClause = whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined;
        const sortBy = req.query.sortBy || 'postedDate';
        const sortOrder = req.query.sortOrder || 'desc';
        let orderByColumn;
        switch (sortBy) {
            case 'name':
                orderByColumn = schema_1.properties.name;
                break;
            case 'pricePerYear':
                orderByColumn = schema_1.properties.pricePerYear;
                break;
            case 'beds':
                orderByColumn = schema_1.properties.beds;
                break;
            case 'baths':
                orderByColumn = schema_1.properties.baths;
                break;
            case 'postedDate':
            default:
                orderByColumn = schema_1.properties.postedDate;
                break;
        }
        const orderByClause = sortOrder === 'desc' ? (0, drizzle_orm_1.desc)(orderByColumn) : (0, drizzle_orm_1.asc)(orderByColumn);
        const [propertiesList, totalCount] = await Promise.all([
            database_1.db.select({
                id: schema_1.properties.id,
                name: schema_1.properties.name,
                description: schema_1.properties.description,
                pricePerYear: schema_1.properties.pricePerYear,
                serviceCharge: schema_1.properties.serviceCharge,
                beds: schema_1.properties.beds,
                baths: schema_1.properties.baths,
                propertyType: schema_1.properties.propertyType,
                locationId: schema_1.properties.locationId,
                photoUrls: schema_1.properties.photoUrls,
                amenities: schema_1.properties.amenities,
                postedDate: schema_1.properties.postedDate,
                landlordCognitoId: schema_1.properties.landlordCognitoId,
                availableUnits: schema_1.properties.availableUnits,
                landlord: {
                    id: schema_1.landlords.id,
                    name: schema_1.landlords.name,
                    email: schema_1.landlords.email,
                    phoneNumber: schema_1.landlords.phoneNumber
                },
                location: {
                    id: schema_1.locations.id,
                    address: schema_1.locations.address,
                    city: schema_1.locations.city,
                    state: schema_1.locations.state,
                    country: schema_1.locations.country,
                    coordinates: schema_1.locations.coordinates
                }
            })
                .from(schema_1.properties)
                .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
                .where(finalWhereClause)
                .orderBy(orderByClause)
                .offset(skip)
                .limit(limit),
            database_1.db.select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.properties)
                .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
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
    }
    catch (error) {
        console.error('Error retrieving properties:', error);
        res
            .status(500)
            .json({ message: `Error retrieving properties: ${error.message}` });
    }
};
exports.getProperties = getProperties;
const getProperty = async (req, res) => {
    try {
        const { id } = req.params;
        const propertyResult = await database_1.db.select({
            id: schema_1.properties.id,
            name: schema_1.properties.name,
            description: schema_1.properties.description,
            pricePerYear: schema_1.properties.pricePerYear,
            serviceCharge: schema_1.properties.serviceCharge,
            beds: schema_1.properties.beds,
            baths: schema_1.properties.baths,
            propertyType: schema_1.properties.propertyType,
            photoUrls: schema_1.properties.photoUrls,
            amenities: schema_1.properties.amenities,
            postedDate: schema_1.properties.postedDate,
            availableUnits: schema_1.properties.availableUnits,
            locationId: schema_1.properties.locationId,
            landlord: {
                id: schema_1.landlords.id,
                name: schema_1.landlords.name,
                email: schema_1.landlords.email,
                phoneNumber: schema_1.landlords.phoneNumber
            },
            locationData: {
                id: schema_1.locations.id,
                address: schema_1.locations.address,
                state: schema_1.locations.state,
                country: schema_1.locations.country
            }
        })
            .from(schema_1.properties)
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .where((0, drizzle_orm_1.eq)(schema_1.properties.id, Number(id)))
            .limit(1);
        if (propertyResult.length === 0) {
            res.status(404).json({ error: 'Property not found' });
            return;
        }
        const property = {
            ...propertyResult[0],
            location: propertyResult[0].locationData
        };
        delete property.locationData;
        res.json(property);
    }
    catch (err) {
        res
            .status(500)
            .json({ message: `Error retrieving property: ${err.message}` });
    }
};
exports.getProperty = getProperty;
const createProperty = async (req, res) => {
    try {
        console.log('Creating property with data:', req.body);
        console.log('Files received:', req.files);
        console.log('Authenticated user:', req.user);
        const files = req.files;
        const { address, city, state, country, postalCode, ...propertyData } = req.body;
        if (!req.user || req.user.role !== 'landlord') {
            res.status(403).json({ message: "Only landlords can create properties" });
            return;
        }
        const [landlordProfile] = await database_1.db.select().from(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.userId, req.user.id)).limit(1);
        if (!landlordProfile) {
            res.status(404).json({ message: "Landlord profile not found" });
            return;
        }
        const landlordCognitoId = landlordProfile.cognitoId;
        let photoUrls = [];
        if (files?.photos && files.photos.length > 0) {
            try {
                const fileData = files.photos.map(file => ({
                    buffer: file.buffer,
                    fileName: file.originalname,
                    resourceType: file.mimetype.startsWith('image/') ? 'image' : 'raw',
                }));
                const uploadResults = await (0, cloudinaryService_1.uploadMultipleBuffersToCloudinary)(fileData, 'properties/photos');
                photoUrls = uploadResults.map(result => result.url);
                console.log(`Successfully uploaded ${photoUrls.length} property photos`);
            }
            catch (uploadError) {
                console.error('Error uploading property photos:', uploadError);
                photoUrls = [];
            }
        }
        let videoUrl = null;
        if (files?.video && files.video.length > 0) {
            try {
                const videoFile = files.video[0];
                const uploadResult = await (0, cloudinaryService_1.uploadBufferToCloudinary)(videoFile.buffer, videoFile.originalname, 'properties/videos', 'video');
                videoUrl = uploadResult.url;
                console.log('Successfully uploaded property video');
            }
            catch (uploadError) {
                console.error('Error uploading property video:', uploadError);
                videoUrl = null;
            }
        }
        const geocodingUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
            street: address,
            city,
            country,
            postalcode: postalCode,
            format: "json",
            limit: "1",
        }).toString()}`;
        const geocodingResponse = await axios_1.default.get(geocodingUrl, {
            headers: {
                "User-Agent": "RealEstateApp (justsomedummyemail@gmail.com",
            },
        });
        const [longitude, latitude] = geocodingResponse.data && geocodingResponse.data.length > 0 && geocodingResponse.data[0]?.lon && geocodingResponse.data[0]?.lat
            ? [
                parseFloat(geocodingResponse.data[0]?.lon),
                parseFloat(geocodingResponse.data[0]?.lat),
            ]
            : [0, 0];
        const [location] = await database_1.db.insert(schema_1.locations).values({
            address,
            city,
            state,
            country,
            postalCode,
            coordinates: `POINT(${longitude} ${latitude})`
        }).returning();
        const [newPropertyData] = await database_1.db.insert(schema_1.properties).values({
            ...propertyData,
            photoUrls,
            videoUrl,
            locationId: location.id,
            landlordCognitoId,
            status: 'PendingApproval',
            amenities: typeof propertyData.amenities === "string"
                ? propertyData.amenities
                : Array.isArray(propertyData.amenities)
                    ? propertyData.amenities.join(", ")
                    : null,
            isParkingIncluded: propertyData.isParkingIncluded === "true",
            pricePerYear: parseFloat(propertyData.pricePerYear),
            serviceCharge: Math.max(0, parseFloat(propertyData.serviceCharge ?? '0')),
            securityDeposit: parseFloat(propertyData.pricePerYear) * 0.15,
            applicationFee: parseFloat(propertyData.pricePerYear) * 0.10,
            beds: parseInt(propertyData.beds),
            baths: parseFloat(propertyData.baths),
            squareFeet: parseInt(propertyData.squareFeet),
            availableUnits: Math.max(0, parseInt(propertyData.availableUnits ?? '1')),
        }).returning();
        const newProperty = await database_1.db.select()
            .from(schema_1.properties)
            .leftJoin(schema_1.locations, (0, drizzle_orm_1.eq)(schema_1.properties.locationId, schema_1.locations.id))
            .leftJoin(schema_1.landlords, (0, drizzle_orm_1.eq)(schema_1.properties.landlordCognitoId, schema_1.landlords.cognitoId))
            .where((0, drizzle_orm_1.eq)(schema_1.properties.id, newPropertyData.id))
            .limit(1)
            .then(result => {
            if (result.length === 0)
                return null;
            const row = result[0];
            return {
                ...row.Property,
                location: row.Location,
                landlord: row.Landlord
            };
        });
        res.status(201).json(newProperty);
    }
    catch (err) {
        console.error('Error creating property:', err);
        res
            .status(500)
            .json({ message: `Error creating property: ${err.message}` });
    }
};
exports.createProperty = createProperty;
