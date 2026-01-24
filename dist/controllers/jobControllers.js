"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeneralJobStats = exports.exportJobApplications = exports.getApplicationStats = exports.getJobStats = exports.getJobApplicationRatings = exports.rateJobApplication = exports.getJobApplicationsByStatus = exports.searchJobApplications = exports.updateJobApplicationStatus = exports.getJobApplicationById = exports.getJobApplications = exports.submitJobApplication = exports.deleteJob = exports.updateJob = exports.getJobById = exports.getActiveJobs = exports.getAllJobs = exports.createJob = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const json2csv_1 = require("json2csv");
const createJob = async (req, res) => {
    try {
        const { title, description, requirements, responsibilities, jobType, experienceLevel, salaryMin, salaryMax, location, department, closingDate, createdBy, } = req.body;
        const jobResult = await database_1.db.insert(schema_1.jobs)
            .values({
            title,
            description,
            requirements,
            responsibilities,
            jobType,
            experienceLevel,
            salaryMin: salaryMin ? parseFloat(salaryMin) : null,
            salaryMax: salaryMax ? parseFloat(salaryMax) : null,
            location,
            department,
            closingDate: closingDate ? new Date(closingDate) : null,
            createdBy,
        })
            .returning();
        const job = jobResult[0];
        res.status(201).json({ success: true, data: job });
    }
    catch (error) {
        console.error("Error creating job:", error);
        res.status(500).json({ success: false, message: "Failed to create job" });
    }
};
exports.createJob = createJob;
const getAllJobs = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, department, jobType, isActive } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [];
        if (search) {
            const searchTerm = `%${search}%`;
            whereConditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(schema_1.jobs.title, searchTerm), (0, drizzle_orm_1.like)(schema_1.jobs.description, searchTerm), (0, drizzle_orm_1.like)(schema_1.jobs.location, searchTerm)));
        }
        if (department)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.jobs.department, department));
        if (jobType)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.jobs.jobType, jobType));
        if (isActive !== undefined)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.jobs.isActive, isActive === 'true'));
        const whereClause = whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined;
        const [jobsList, totalCount] = await Promise.all([
            database_1.db.select({
                id: schema_1.jobs.id,
                title: schema_1.jobs.title,
                description: schema_1.jobs.description,
                requirements: schema_1.jobs.requirements,
                responsibilities: schema_1.jobs.responsibilities,
                jobType: schema_1.jobs.jobType,
                experienceLevel: schema_1.jobs.experienceLevel,
                salaryMin: schema_1.jobs.salaryMin,
                salaryMax: schema_1.jobs.salaryMax,
                location: schema_1.jobs.location,
                department: schema_1.jobs.department,
                closingDate: schema_1.jobs.closingDate,
                isActive: schema_1.jobs.isActive,
                createdAt: schema_1.jobs.createdAt,
                createdBy: schema_1.jobs.createdBy,
                applicationCount: (0, drizzle_orm_1.count)(schema_1.jobApplications.id)
            })
                .from(schema_1.jobs)
                .leftJoin(schema_1.jobApplications, (0, drizzle_orm_1.eq)(schema_1.jobs.id, schema_1.jobApplications.jobId))
                .where(whereClause)
                .groupBy(schema_1.jobs.id)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.jobs.createdAt))
                .offset(offset)
                .limit(Number(limit)),
            database_1.db.select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.jobs)
                .where(whereClause)
        ]);
        const total = totalCount[0]?.count || 0;
        res.json({
            success: true,
            data: jobsList,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error("Error fetching jobs:", error);
        res.status(500).json({ success: false, message: "Failed to fetch jobs" });
    }
};
exports.getAllJobs = getAllJobs;
const getActiveJobs = async (_req, res) => {
    try {
        const activeJobs = await database_1.db.select({
            id: schema_1.jobs.id,
            title: schema_1.jobs.title,
            description: schema_1.jobs.description,
            requirements: schema_1.jobs.requirements,
            responsibilities: schema_1.jobs.responsibilities,
            jobType: schema_1.jobs.jobType,
            experienceLevel: schema_1.jobs.experienceLevel,
            salaryMin: schema_1.jobs.salaryMin,
            salaryMax: schema_1.jobs.salaryMax,
            location: schema_1.jobs.location,
            department: schema_1.jobs.department,
            closingDate: schema_1.jobs.closingDate,
            isActive: schema_1.jobs.isActive,
            createdAt: schema_1.jobs.createdAt,
            postedDate: schema_1.jobs.postedDate,
            createdBy: schema_1.jobs.createdBy,
            applicationCount: (0, drizzle_orm_1.count)(schema_1.jobApplications.id)
        })
            .from(schema_1.jobs)
            .leftJoin(schema_1.jobApplications, (0, drizzle_orm_1.eq)(schema_1.jobs.id, schema_1.jobApplications.jobId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.jobs.isActive, true), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(schema_1.jobs.closingDate), (0, drizzle_orm_1.gte)(schema_1.jobs.closingDate, new Date()))))
            .groupBy(schema_1.jobs.id)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.jobs.postedDate));
        res.json({ success: true, data: activeJobs });
    }
    catch (error) {
        console.error("Error fetching active jobs:", error);
        res.status(500).json({ success: false, message: "Failed to fetch active jobs" });
    }
};
exports.getActiveJobs = getActiveJobs;
const getJobById = async (req, res) => {
    try {
        const { id } = req.params;
        const jobResult = await database_1.db.select({
            id: schema_1.jobs.id,
            title: schema_1.jobs.title,
            description: schema_1.jobs.description,
            requirements: schema_1.jobs.requirements,
            responsibilities: schema_1.jobs.responsibilities,
            jobType: schema_1.jobs.jobType,
            experienceLevel: schema_1.jobs.experienceLevel,
            salaryMin: schema_1.jobs.salaryMin,
            salaryMax: schema_1.jobs.salaryMax,
            location: schema_1.jobs.location,
            department: schema_1.jobs.department,
            closingDate: schema_1.jobs.closingDate,
            isActive: schema_1.jobs.isActive,
            createdAt: schema_1.jobs.createdAt,
            postedDate: schema_1.jobs.postedDate,
            createdBy: schema_1.jobs.createdBy
        })
            .from(schema_1.jobs)
            .where((0, drizzle_orm_1.eq)(schema_1.jobs.id, id))
            .limit(1);
        if (jobResult.length === 0) {
            return res.status(404).json({ success: false, message: "Job not found" });
        }
        const job = jobResult[0];
        const applications = await database_1.db.select({
            id: schema_1.jobApplications.id,
            applicantName: schema_1.jobApplications.applicantName,
            email: schema_1.jobApplications.applicantEmail,
            phone: schema_1.jobApplications.applicantPhone,
            coverLetter: schema_1.jobApplications.coverLetter,
            resume: schema_1.jobApplications.resumeUrl,
            status: schema_1.jobApplications.status,
            appliedAt: schema_1.jobApplications.submittedAt,
            ratingId: schema_1.jobApplicationRatings.id,
            rating: schema_1.jobApplicationRatings.score,
            feedback: schema_1.jobApplicationRatings.comments
        })
            .from(schema_1.jobApplications)
            .leftJoin(schema_1.jobApplicationRatings, (0, drizzle_orm_1.eq)(schema_1.jobApplications.id, schema_1.jobApplicationRatings.jobApplicationId))
            .where((0, drizzle_orm_1.eq)(schema_1.jobApplications.jobId, id));
        const applicationsWithRatings = applications.reduce((acc, app) => {
            const existingApp = acc.find(a => a.id === app.id);
            if (existingApp) {
                if (app.ratingId) {
                    existingApp.ratings.push({
                        id: app.ratingId,
                        rating: app.rating,
                        feedback: app.feedback
                    });
                }
            }
            else {
                acc.push({
                    id: app.id,
                    applicantName: app.applicantName,
                    email: app.email,
                    phone: app.phone,
                    coverLetter: app.coverLetter,
                    resume: app.resume,
                    status: app.status,
                    appliedAt: app.appliedAt,
                    ratings: app.ratingId ? [{
                            id: app.ratingId,
                            rating: app.rating,
                            feedback: app.feedback
                        }] : []
                });
            }
            return acc;
        }, []);
        const jobWithApplications = {
            ...job,
            applications: applicationsWithRatings,
            _count: {
                applications: applicationsWithRatings.length
            }
        };
        res.json({ success: true, data: jobWithApplications });
    }
    catch (error) {
        console.error("Error fetching job:", error);
        res.status(500).json({ success: false, message: "Failed to fetch job" });
    }
};
exports.getJobById = getJobById;
const updateJob = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };
        if (updateData.salaryMin)
            updateData.salaryMin = parseFloat(updateData.salaryMin);
        if (updateData.salaryMax)
            updateData.salaryMax = parseFloat(updateData.salaryMax);
        if (updateData.closingDate)
            updateData.closingDate = new Date(updateData.closingDate);
        const jobResult = await database_1.db.update(schema_1.jobs)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.jobs.id, id))
            .returning();
        if (jobResult.length === 0) {
            return res.status(404).json({ success: false, message: "Job not found" });
        }
        res.json({ success: true, data: jobResult[0] });
    }
    catch (error) {
        console.error("Error updating job:", error);
        res.status(500).json({ success: false, message: "Failed to update job" });
    }
};
exports.updateJob = updateJob;
const deleteJob = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedJob = await database_1.db.delete(schema_1.jobs)
            .where((0, drizzle_orm_1.eq)(schema_1.jobs.id, id))
            .returning();
        if (deletedJob.length === 0) {
            return res.status(404).json({ success: false, message: "Job not found" });
        }
        res.json({ success: true, message: "Job deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting job:", error);
        res.status(500).json({ success: false, message: "Failed to delete job" });
    }
};
exports.deleteJob = deleteJob;
const submitJobApplication = async (req, res) => {
    try {
        const { id: jobId } = req.params;
        const { applicantName, applicantEmail, applicantPhone, resumeUrl, coverLetter, experience, education, skills, portfolioUrl, linkedinUrl, } = req.body;
        const jobResult = await database_1.db.select({
            id: schema_1.jobs.id,
            isActive: schema_1.jobs.isActive,
            closingDate: schema_1.jobs.closingDate
        })
            .from(schema_1.jobs)
            .where((0, drizzle_orm_1.eq)(schema_1.jobs.id, jobId))
            .limit(1);
        if (jobResult.length === 0 || !jobResult[0].isActive) {
            return res.status(400).json({ success: false, message: "Job is not available for applications" });
        }
        const job = jobResult[0];
        if (job.closingDate && new Date() > job.closingDate) {
            return res.status(400).json({ success: false, message: "Application deadline has passed" });
        }
        const applicationResult = await database_1.db.insert(schema_1.jobApplications)
            .values({
            jobId: jobId,
            applicantName,
            applicantEmail: applicantEmail,
            applicantPhone: applicantPhone,
            resumeUrl: resumeUrl,
            coverLetter,
            experience,
            education,
            skills,
            portfolioUrl,
            linkedinUrl,
        })
            .returning();
        const application = applicationResult[0];
        res.status(201).json({ success: true, data: application });
    }
    catch (error) {
        console.error("Error submitting application:", error);
        res.status(500).json({ success: false, message: "Failed to submit application" });
    }
};
exports.submitJobApplication = submitJobApplication;
const getJobApplications = async (req, res) => {
    try {
        const { id: jobId } = req.params;
        const { page = 1, limit = 10, status, search, sortBy = 'submittedAt', sortOrder = 'desc' } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = { jobId: jobId };
        if (status)
            where.status = status;
        const orderBy = {};
        orderBy[sortBy] = sortOrder;
        const whereConditions = [];
        if (search) {
            whereConditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(schema_1.jobApplications.applicantName, `%${search}%`), (0, drizzle_orm_1.like)(schema_1.jobApplications.applicantEmail, `%${search}%`), (0, drizzle_orm_1.like)(schema_1.jobApplications.skills, `%${search}%`)));
        }
        if (status)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.jobApplications.status, status));
        if (jobId)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.jobApplications.jobId, jobId));
        const applications = await database_1.db.select({
            id: schema_1.jobApplications.id,
            jobId: schema_1.jobApplications.jobId,
            applicantName: schema_1.jobApplications.applicantName,
            email: schema_1.jobApplications.applicantEmail,
            skills: schema_1.jobApplications.skills,
            experience: schema_1.jobApplications.experience,
            coverLetter: schema_1.jobApplications.coverLetter,
            resumeUrl: schema_1.jobApplications.resumeUrl,
            status: schema_1.jobApplications.status,
            submittedAt: schema_1.jobApplications.submittedAt,
            jobTitle: schema_1.jobs.title,
            jobDescription: schema_1.jobs.description,
        })
            .from(schema_1.jobApplications)
            .leftJoin(schema_1.jobs, (0, drizzle_orm_1.eq)(schema_1.jobApplications.jobId, schema_1.jobs.id))
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined)
            .offset(skip)
            .limit(Number(limit))
            .orderBy(sortOrder === 'desc' ? (0, drizzle_orm_1.desc)(schema_1.jobApplications.submittedAt) : schema_1.jobApplications.submittedAt);
        const applicationIds = applications.map(app => app.id);
        const allRatings = applicationIds.length > 0 ? await database_1.db
            .select()
            .from(schema_1.jobApplicationRatings)
            .where((0, drizzle_orm_1.inArray)(schema_1.jobApplicationRatings.jobApplicationId, applicationIds)) : [];
        const totalResult = await database_1.db.select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.jobApplications)
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined);
        const total = totalResult[0]?.count || 0;
        const applicationsWithRatings = applications.map(app => {
            const appRatings = allRatings.filter(rating => rating.jobApplicationId === app.id);
            const averageRating = appRatings.length > 0
                ? appRatings.reduce((sum, rating) => sum + rating.score, 0) / appRatings.length
                : 0;
            return {
                ...app,
                ratings: appRatings,
                averageRating: Math.round(averageRating * 100) / 100,
            };
        });
        res.json({
            success: true,
            data: applicationsWithRatings,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error("Error fetching job applications:", error);
        res.status(500).json({ success: false, message: "Failed to fetch applications" });
    }
};
exports.getJobApplications = getJobApplications;
const getJobApplicationById = async (req, res) => {
    try {
        const { id } = req.params;
        const applicationResult = await database_1.db.select({
            id: schema_1.jobApplications.id,
            jobId: schema_1.jobApplications.jobId,
            applicantName: schema_1.jobApplications.applicantName,
            applicantEmail: schema_1.jobApplications.applicantEmail,
            applicantPhone: schema_1.jobApplications.applicantPhone,
            resumeUrl: schema_1.jobApplications.resumeUrl,
            coverLetter: schema_1.jobApplications.coverLetter,
            experience: schema_1.jobApplications.experience,
            education: schema_1.jobApplications.education,
            skills: schema_1.jobApplications.skills,
            portfolioUrl: schema_1.jobApplications.portfolioUrl,
            linkedinUrl: schema_1.jobApplications.linkedinUrl,
            status: schema_1.jobApplications.status,
            submittedAt: schema_1.jobApplications.submittedAt,
            reviewedAt: schema_1.jobApplications.reviewedAt,
            reviewedBy: schema_1.jobApplications.reviewedBy,
            notes: schema_1.jobApplications.notes
        })
            .from(schema_1.jobApplications)
            .where((0, drizzle_orm_1.eq)(schema_1.jobApplications.id, parseInt(id)))
            .limit(1);
        if (applicationResult.length === 0) {
            return res.status(404).json({ success: false, message: "Job application not found" });
        }
        const application = applicationResult[0];
        const ratings = await database_1.db.select({
            id: schema_1.jobApplicationRatings.id,
            score: schema_1.jobApplicationRatings.score,
            comments: schema_1.jobApplicationRatings.comments,
            ratedBy: schema_1.jobApplicationRatings.ratedBy,
            createdAt: schema_1.jobApplicationRatings.createdAt
        })
            .from(schema_1.jobApplicationRatings)
            .where((0, drizzle_orm_1.eq)(schema_1.jobApplicationRatings.jobApplicationId, parseInt(id)));
        res.json({
            success: true,
            data: {
                ...application,
                ratings
            }
        });
    }
    catch (error) {
        console.error("Error fetching job application:", error);
        res.status(500).json({ success: false, message: "Failed to fetch job application" });
    }
};
exports.getJobApplicationById = getJobApplicationById;
const updateJobApplicationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, reviewedBy } = req.body;
        const applicationResult = await database_1.db.update(schema_1.jobApplications)
            .set({
            status,
            notes,
            reviewedBy,
            reviewedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.jobApplications.id, parseInt(id)))
            .returning();
        if (applicationResult.length === 0) {
            return res.status(404).json({ success: false, message: "Job application not found" });
        }
        res.json({ success: true, data: applicationResult[0] });
    }
    catch (error) {
        console.error("Error updating job application status:", error);
        res.status(500).json({ success: false, message: "Failed to update job application status" });
    }
};
exports.updateJobApplicationStatus = updateJobApplicationStatus;
const searchJobApplications = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status, jobId, sortBy = 'submittedAt', sortOrder = 'desc', minRating, maxRating } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {};
        if (search) {
            where.OR = [
                { applicantName: { contains: search, mode: 'insensitive' } },
                { applicantEmail: { contains: search, mode: 'insensitive' } },
                { skills: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (status)
            where.status = status;
        if (jobId)
            where.jobId = jobId;
        const orderBy = {};
        orderBy[sortBy] = sortOrder;
        const whereConditions = [];
        if (search) {
            whereConditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(schema_1.jobApplications.applicantName, `%${search}%`), (0, drizzle_orm_1.like)(schema_1.jobApplications.applicantEmail, `%${search}%`), (0, drizzle_orm_1.like)(schema_1.jobApplications.skills, `%${search}%`)));
        }
        if (status)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.jobApplications.status, status));
        if (jobId)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.jobApplications.jobId, jobId));
        const applications = await database_1.db.select({
            id: schema_1.jobApplications.id,
            jobId: schema_1.jobApplications.jobId,
            applicantName: schema_1.jobApplications.applicantName,
            email: schema_1.jobApplications.applicantEmail,
            skills: schema_1.jobApplications.skills,
            experience: schema_1.jobApplications.experience,
            status: schema_1.jobApplications.status,
            appliedAt: schema_1.jobApplications.submittedAt,
            reviewedBy: schema_1.jobApplications.reviewedBy,
            reviewedAt: schema_1.jobApplications.reviewedAt,
            notes: schema_1.jobApplications.notes,
            job: {
                title: schema_1.jobs.title,
                department: schema_1.jobs.department,
            },
        })
            .from(schema_1.jobApplications)
            .leftJoin(schema_1.jobs, (0, drizzle_orm_1.eq)(schema_1.jobApplications.jobId, schema_1.jobs.id))
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined)
            .offset(skip)
            .limit(Number(limit))
            .orderBy(sortOrder === 'desc' ? (0, drizzle_orm_1.desc)(schema_1.jobApplications.submittedAt) : schema_1.jobApplications.submittedAt);
        const totalResult = await database_1.db.select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.jobApplications)
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined);
        const total = totalResult[0]?.count || 0;
        const applicationIds = applications.map(app => app.id);
        const allRatings = applicationIds.length > 0 ? await database_1.db.select()
            .from(schema_1.jobApplicationRatings)
            .where((0, drizzle_orm_1.inArray)(schema_1.jobApplicationRatings.jobApplicationId, applicationIds)) : [];
        let applicationsWithRatings = applications.map(app => {
            const appRatings = allRatings.filter(rating => rating.jobApplicationId === app.id);
            const totalScore = appRatings.reduce((sum, rating) => sum + (rating.score * rating.weight), 0);
            const totalWeight = appRatings.length;
            const averageRating = totalWeight > 0 ? totalScore / totalWeight : 0;
            return {
                ...app,
                ratings: appRatings,
                averageRating: Math.round(averageRating * 100) / 100,
            };
        });
        if (minRating || maxRating) {
            applicationsWithRatings = applicationsWithRatings.filter(app => {
                if (minRating && app.averageRating < Number(minRating))
                    return false;
                if (maxRating && app.averageRating > Number(maxRating))
                    return false;
                return true;
            });
        }
        if (sortBy === 'rating') {
            applicationsWithRatings.sort((a, b) => {
                return sortOrder === 'desc' ? b.averageRating - a.averageRating : a.averageRating - b.averageRating;
            });
        }
        res.json({
            success: true,
            data: applicationsWithRatings,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error("Error searching applications:", error);
        res.status(500).json({ success: false, message: "Failed to search applications" });
    }
};
exports.searchJobApplications = searchJobApplications;
const getJobApplicationsByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const applications = await database_1.db.select({
            id: schema_1.jobApplications.id,
            jobId: schema_1.jobApplications.jobId,
            applicantName: schema_1.jobApplications.applicantName,
            email: schema_1.jobApplications.applicantEmail,
            skills: schema_1.jobApplications.skills,
            experience: schema_1.jobApplications.experience,
            status: schema_1.jobApplications.status,
            appliedAt: schema_1.jobApplications.submittedAt,
            reviewedBy: schema_1.jobApplications.reviewedBy,
            reviewedAt: schema_1.jobApplications.reviewedAt,
            notes: schema_1.jobApplications.notes,
            job: {
                title: schema_1.jobs.title,
                department: schema_1.jobs.department,
            },
        })
            .from(schema_1.jobApplications)
            .leftJoin(schema_1.jobs, (0, drizzle_orm_1.eq)(schema_1.jobApplications.jobId, schema_1.jobs.id))
            .where((0, drizzle_orm_1.eq)(schema_1.jobApplications.status, status))
            .offset(skip)
            .limit(Number(limit))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.jobApplications.submittedAt));
        const totalResult = await database_1.db.select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.jobApplications)
            .where((0, drizzle_orm_1.eq)(schema_1.jobApplications.status, status));
        const total = totalResult[0]?.count || 0;
        const applicationIds = applications.map(app => app.id);
        const allRatings = applicationIds.length > 0 ? await database_1.db.select()
            .from(schema_1.jobApplicationRatings)
            .where((0, drizzle_orm_1.inArray)(schema_1.jobApplicationRatings.jobApplicationId, applicationIds)) : [];
        const applicationsWithRatings = applications.map(app => {
            const appRatings = allRatings.filter(rating => rating.jobApplicationId === app.id);
            const totalScore = appRatings.reduce((sum, rating) => sum + (rating.score * rating.weight), 0);
            const totalWeight = appRatings.length;
            const averageRating = totalWeight > 0 ? totalScore / totalWeight : 0;
            return {
                ...app,
                ratings: appRatings,
                averageRating: Math.round(averageRating * 100) / 100,
            };
        });
        res.json({
            success: true,
            data: applicationsWithRatings,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error("Error fetching applications by status:", error);
        res.status(500).json({ success: false, message: "Failed to fetch applications" });
    }
};
exports.getJobApplicationsByStatus = getJobApplicationsByStatus;
const rateJobApplication = async (req, res) => {
    try {
        const { jobApplicationId } = req.params;
        const { score, comments, ratedBy } = req.body;
        if (score < 1 || score > 5) {
            return res.status(400).json({
                success: false,
                message: "Score must be between 1 and 5"
            });
        }
        const applicationExists = await database_1.db.select({ id: schema_1.jobApplications.id })
            .from(schema_1.jobApplications)
            .where((0, drizzle_orm_1.eq)(schema_1.jobApplications.id, parseInt(jobApplicationId)))
            .limit(1);
        if (applicationExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Job application not found"
            });
        }
        const existingRating = await database_1.db.select({ id: schema_1.jobApplicationRatings.id })
            .from(schema_1.jobApplicationRatings)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.jobApplicationRatings.jobApplicationId, parseInt(jobApplicationId)), (0, drizzle_orm_1.eq)(schema_1.jobApplicationRatings.ratedBy, ratedBy)))
            .limit(1);
        if (existingRating.length > 0) {
            const updatedRating = await database_1.db.update(schema_1.jobApplicationRatings)
                .set({
                score,
                comments
            })
                .where((0, drizzle_orm_1.eq)(schema_1.jobApplicationRatings.jobApplicationId, parseInt(jobApplicationId)))
                .returning();
            return res.json({ success: true, data: updatedRating[0] });
        }
        else {
            const newRating = await database_1.db.insert(schema_1.jobApplicationRatings)
                .values({
                jobApplicationId: parseInt(jobApplicationId),
                criteriaName: "Overall",
                score,
                comments,
                ratedBy
            })
                .returning();
            res.status(201).json({ success: true, data: newRating[0] });
        }
    }
    catch (error) {
        console.error("Error rating job application:", error);
        res.status(500).json({ success: false, message: "Failed to rate job application" });
    }
};
exports.rateJobApplication = rateJobApplication;
const getJobApplicationRatings = async (req, res) => {
    try {
        const { jobApplicationId } = req.params;
        const ratings = await database_1.db.select({
            id: schema_1.jobApplicationRatings.id,
            score: schema_1.jobApplicationRatings.score,
            comments: schema_1.jobApplicationRatings.comments,
            ratedBy: schema_1.jobApplicationRatings.ratedBy,
            createdAt: schema_1.jobApplicationRatings.createdAt
        })
            .from(schema_1.jobApplicationRatings)
            .where((0, drizzle_orm_1.eq)(schema_1.jobApplicationRatings.jobApplicationId, parseInt(jobApplicationId)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.jobApplicationRatings.createdAt));
        res.json({ success: true, data: ratings });
    }
    catch (error) {
        console.error("Error fetching job application ratings:", error);
        res.status(500).json({ success: false, message: "Failed to fetch job application ratings" });
    }
};
exports.getJobApplicationRatings = getJobApplicationRatings;
const getJobStats = async (req, res) => {
    try {
        const { jobId } = req.params;
        const totalApplications = await database_1.db.select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.jobApplications)
            .where((0, drizzle_orm_1.eq)(schema_1.jobApplications.jobId, jobId));
        const applicationsByStatus = await database_1.db.select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.jobApplications)
            .where((0, drizzle_orm_1.eq)(schema_1.jobApplications.jobId, jobId));
        res.json({
            success: true,
            data: {
                totalApplications: totalApplications[0].count,
                applicationsByStatus: applicationsByStatus[0].count
            }
        });
    }
    catch (error) {
        console.error("Error fetching job stats:", error);
        res.status(500).json({ success: false, message: "Failed to fetch job stats" });
    }
};
exports.getJobStats = getJobStats;
const getApplicationStats = async (_req, res) => {
    try {
        const [totalApplicationsResult, statusStats, activeJobsResult] = await Promise.all([
            database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.jobApplications),
            database_1.db.select({
                status: schema_1.jobApplications.status,
                count: (0, drizzle_orm_1.count)(schema_1.jobApplications.id),
            })
                .from(schema_1.jobApplications)
                .groupBy(schema_1.jobApplications.status),
            database_1.db.select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.jobs)
                .where((0, drizzle_orm_1.eq)(schema_1.jobs.isActive, true)),
        ]);
        const totalApplications = totalApplicationsResult[0]?.count || 0;
        const activeJobs = activeJobsResult[0]?.count || 0;
        res.json({
            success: true,
            data: {
                totalApplications,
                activeJobs,
                statusBreakdown: statusStats,
            }
        });
    }
    catch (error) {
        console.error("Error fetching application stats:", error);
        res.status(500).json({ success: false, message: "Failed to fetch application statistics" });
    }
};
exports.getApplicationStats = getApplicationStats;
const exportJobApplications = async (req, res) => {
    try {
        const { jobId, status, format = 'csv' } = req.query;
        const where = {};
        if (jobId)
            where.jobId = jobId;
        if (status)
            where.status = status;
        const whereConditions = [];
        if (jobId)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.jobApplications.jobId, jobId));
        if (status)
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.jobApplications.status, status));
        const applications = await database_1.db.select({
            id: schema_1.jobApplications.id,
            jobId: schema_1.jobApplications.jobId,
            applicantName: schema_1.jobApplications.applicantName,
            email: schema_1.jobApplications.applicantEmail,
            phone: schema_1.jobApplications.applicantPhone,
            status: schema_1.jobApplications.status,
            appliedAt: schema_1.jobApplications.submittedAt,
            reviewedAt: schema_1.jobApplications.reviewedAt,
            job: {
                title: schema_1.jobs.title,
                department: schema_1.jobs.department,
            },
        })
            .from(schema_1.jobApplications)
            .leftJoin(schema_1.jobs, (0, drizzle_orm_1.eq)(schema_1.jobApplications.jobId, schema_1.jobs.id))
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined);
        const applicationIds = applications.map(app => app.id);
        const allRatings = applicationIds.length > 0 ? await database_1.db.select()
            .from(schema_1.jobApplicationRatings)
            .where((0, drizzle_orm_1.inArray)(schema_1.jobApplicationRatings.jobApplicationId, applicationIds)) : [];
        const applicationsWithRatings = applications.map(app => {
            const appRatings = allRatings.filter(rating => rating.jobApplicationId === app.id);
            const totalScore = appRatings.reduce((sum, rating) => sum + (rating.score * rating.weight), 0);
            const totalWeight = appRatings.length;
            const averageRating = totalWeight > 0 ? totalScore / totalWeight : 0;
            return {
                id: app.id,
                jobTitle: app.job?.title || 'N/A',
                department: app.job?.department || 'N/A',
                applicantName: app.applicantName,
                applicantEmail: app.email,
                applicantPhone: app.phone,
                status: app.status,
                averageRating: Math.round(averageRating * 100) / 100,
                submittedAt: app.appliedAt,
                reviewedAt: app.reviewedAt,
            };
        });
        if (format === 'csv') {
            const parser = new json2csv_1.Parser();
            const csv = parser.parse(applicationsWithRatings);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=job_applications.csv');
            res.send(csv);
        }
        else {
            res.json({ success: true, data: applicationsWithRatings });
        }
    }
    catch (error) {
        console.error("Error exporting applications:", error);
        res.status(500).json({ success: false, message: "Failed to export applications" });
    }
};
exports.exportJobApplications = exportJobApplications;
const getGeneralJobStats = async (_req, res) => {
    try {
        const [totalJobsResult, activeJobsResult, totalApplicationsResult, pendingApplicationsResult, shortlistedApplicationsResult, hiredApplicationsResult] = await Promise.all([
            database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.jobs),
            database_1.db.select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.jobs)
                .where((0, drizzle_orm_1.eq)(schema_1.jobs.isActive, true)),
            database_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.jobApplications),
            database_1.db.select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.jobApplications)
                .where((0, drizzle_orm_1.eq)(schema_1.jobApplications.status, 'Submitted')),
            database_1.db.select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.jobApplications)
                .where((0, drizzle_orm_1.eq)(schema_1.jobApplications.status, 'Shortlisted')),
            database_1.db.select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.jobApplications)
                .where((0, drizzle_orm_1.eq)(schema_1.jobApplications.status, 'Hired')),
        ]);
        const totalJobs = totalJobsResult[0]?.count || 0;
        const activeJobs = activeJobsResult[0]?.count || 0;
        const totalApplications = totalApplicationsResult[0]?.count || 0;
        const pendingApplications = pendingApplicationsResult[0]?.count || 0;
        const shortlistedApplications = shortlistedApplicationsResult[0]?.count || 0;
        const hiredApplications = hiredApplicationsResult[0]?.count || 0;
        res.json({
            success: true,
            data: {
                totalJobs,
                activeJobs,
                totalApplications,
                pendingApplications,
                shortlistedApplications,
                hiredApplications,
            }
        });
    }
    catch (error) {
        console.error("Error fetching general job stats:", error);
        res.status(500).json({ success: false, message: "Failed to fetch general job statistics" });
    }
};
exports.getGeneralJobStats = getGeneralJobStats;
