import { Request, Response } from "express";
import { eq, and, gte, desc, count, like, isNull, or, inArray } from "drizzle-orm";
import { db } from "../utils/database";
import { jobs, jobApplications, jobApplicationRatings } from "../db/schema";
import { Parser } from "json2csv";

// Job Management Controllers
export const createJob = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      requirements,
      responsibilities,
      jobType,
      experienceLevel,
      salaryMin,
      salaryMax,
      location,
      department,
      closingDate,
      createdBy,
    } = req.body;

    const jobResult = await db.insert(jobs)
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
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ success: false, message: "Failed to create job" });
  }
};

export const getAllJobs = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search, department, jobType, isActive } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions: any[] = [];
    
    if (search) {
      const searchTerm = `%${search}%`;
      whereConditions.push(
        or(
          like(jobs.title, searchTerm),
          like(jobs.description, searchTerm),
          like(jobs.location, searchTerm)
        )
      );
    }
    
    if (department) whereConditions.push(eq(jobs.department, department as string));
    if (jobType) whereConditions.push(eq(jobs.jobType, jobType as any));
    if (isActive !== undefined) whereConditions.push(eq(jobs.isActive, isActive === 'true'));

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [jobsList, totalCount] = await Promise.all([
      db.select({
        id: jobs.id,
        title: jobs.title,
        description: jobs.description,
        requirements: jobs.requirements,
        responsibilities: jobs.responsibilities,
        jobType: jobs.jobType,
        experienceLevel: jobs.experienceLevel,
        salaryMin: jobs.salaryMin,
        salaryMax: jobs.salaryMax,
        location: jobs.location,
        department: jobs.department,
        closingDate: jobs.closingDate,
        isActive: jobs.isActive,
        createdAt: jobs.createdAt,
        createdBy: jobs.createdBy,
        applicationCount: count(jobApplications.id)
      })
      .from(jobs)
      .leftJoin(jobApplications, eq(jobs.id, jobApplications.jobId))
      .where(whereClause)
      .groupBy(jobs.id)
      .orderBy(desc(jobs.createdAt))
      .offset(offset)
      .limit(Number(limit)),
      
      db.select({ count: count() })
      .from(jobs)
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
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ success: false, message: "Failed to fetch jobs" });
  }
};

export const getActiveJobs = async (_req: Request, res: Response) => {
  try {
    const activeJobs = await db.select({
      id: jobs.id,
      title: jobs.title,
      description: jobs.description,
      requirements: jobs.requirements,
      responsibilities: jobs.responsibilities,
      jobType: jobs.jobType,
      experienceLevel: jobs.experienceLevel,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      location: jobs.location,
      department: jobs.department,
      closingDate: jobs.closingDate,
      isActive: jobs.isActive,
      createdAt: jobs.createdAt,
      postedDate: jobs.postedDate,
      createdBy: jobs.createdBy,
      applicationCount: count(jobApplications.id)
    })
    .from(jobs)
    .leftJoin(jobApplications, eq(jobs.id, jobApplications.jobId))
    .where(
      and(
        eq(jobs.isActive, true),
        or(
          isNull(jobs.closingDate),
          gte(jobs.closingDate, new Date())
        )
      )
    )
    .groupBy(jobs.id)
    .orderBy(desc(jobs.postedDate));

    res.json({ success: true, data: activeJobs });
  } catch (error) {
    console.error("Error fetching active jobs:", error);
    res.status(500).json({ success: false, message: "Failed to fetch active jobs" });
  }
};

export const getJobById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const jobResult = await db.select({
      id: jobs.id,
      title: jobs.title,
      description: jobs.description,
      requirements: jobs.requirements,
      responsibilities: jobs.responsibilities,
      jobType: jobs.jobType,
      experienceLevel: jobs.experienceLevel,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      location: jobs.location,
      department: jobs.department,
      closingDate: jobs.closingDate,
      isActive: jobs.isActive,
      createdAt: jobs.createdAt,
      postedDate: jobs.postedDate,
      createdBy: jobs.createdBy
    })
    .from(jobs)
    .where(eq(jobs.id, id))
    .limit(1);

    if (jobResult.length === 0) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const job = jobResult[0];

    // Get applications with ratings
    const applications = await db.select({
      id: jobApplications.id,
      applicantName: jobApplications.applicantName,
      email: jobApplications.applicantEmail,
      phone: jobApplications.applicantPhone,
      coverLetter: jobApplications.coverLetter,
      resume: jobApplications.resumeUrl,
      status: jobApplications.status,
      appliedAt: jobApplications.submittedAt,
      ratingId: jobApplicationRatings.id,
      rating: jobApplicationRatings.score,
      feedback: jobApplicationRatings.comments
    })
    .from(jobApplications)
    .leftJoin(jobApplicationRatings, eq(jobApplications.id, jobApplicationRatings.jobApplicationId))
    .where(eq(jobApplications.jobId, id));

    // Group ratings by application
    const applicationsWithRatings = applications.reduce((acc: any[], app) => {
      const existingApp = acc.find(a => a.id === app.id);
      if (existingApp) {
        if (app.ratingId) {
          existingApp.ratings.push({
            id: app.ratingId,
            rating: app.rating,
            feedback: app.feedback
          });
        }
      } else {
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
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ success: false, message: "Failed to fetch job" });
  }
};

export const updateJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    if (updateData.salaryMin) updateData.salaryMin = parseFloat(updateData.salaryMin);
    if (updateData.salaryMax) updateData.salaryMax = parseFloat(updateData.salaryMax);
    if (updateData.closingDate) updateData.closingDate = new Date(updateData.closingDate);

    const jobResult = await db.update(jobs)
      .set(updateData)
      .where(eq(jobs.id, id))
      .returning();

    if (jobResult.length === 0) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    res.json({ success: true, data: jobResult[0] });
  } catch (error) {
    console.error("Error updating job:", error);
    res.status(500).json({ success: false, message: "Failed to update job" });
  }
};

export const deleteJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const deletedJob = await db.delete(jobs)
      .where(eq(jobs.id, id))
      .returning();

    if (deletedJob.length === 0) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    res.json({ success: true, message: "Job deleted successfully" });
  } catch (error) {
    console.error("Error deleting job:", error);
    res.status(500).json({ success: false, message: "Failed to delete job" });
  }
};

// Job Application Controllers
export const submitJobApplication = async (req: Request, res: Response) => {
  try {
    const { id: jobId } = req.params;
    const {
      applicantName,
      applicantEmail,
      applicantPhone,
      resumeUrl,
      coverLetter,
      experience,
      education,
      skills,
      portfolioUrl,
      linkedinUrl,
    } = req.body;

    // Check if job exists and is active
    const jobResult = await db.select({
      id: jobs.id,
      isActive: jobs.isActive,
      closingDate: jobs.closingDate
    })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

    if (jobResult.length === 0 || !jobResult[0].isActive) {
      return res.status(400).json({ success: false, message: "Job is not available for applications" });
    }

    const job = jobResult[0];

    // Check if closing date has passed
    if (job.closingDate && new Date() > job.closingDate) {
      return res.status(400).json({ success: false, message: "Application deadline has passed" });
    }

    const applicationResult = await db.insert(jobApplications)
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
  } catch (error) {
    console.error("Error submitting application:", error);
    res.status(500).json({ success: false, message: "Failed to submit application" });
  }
};

export const getJobApplications = async (req: Request, res: Response) => {
  try {
    const { id: jobId } = req.params;
    const { page = 1, limit = 10, status, search, sortBy = 'submittedAt', sortOrder = 'desc' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { jobId: jobId };
    if (status) where.status = status;

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;

    // Convert Prisma where to Drizzle conditions
    const whereConditions = [];
    if (search) {
      whereConditions.push(
        or(
          like(jobApplications.applicantName, `%${search}%`),
          like(jobApplications.applicantEmail, `%${search}%`),
          like(jobApplications.skills, `%${search}%`)
        )
      );
    }
    if (status) whereConditions.push(eq(jobApplications.status, status as any));
    if (jobId) whereConditions.push(eq(jobApplications.jobId, jobId as string));

    const applications = await db.select({
      id: jobApplications.id,
      jobId: jobApplications.jobId,
      applicantName: jobApplications.applicantName,
      email: jobApplications.applicantEmail,
      skills: jobApplications.skills,
      experience: jobApplications.experience,
      coverLetter: jobApplications.coverLetter,
      resumeUrl: jobApplications.resumeUrl,
      status: jobApplications.status,
      submittedAt: jobApplications.submittedAt,
      jobTitle: jobs.title,
      jobDescription: jobs.description,
    })
    .from(jobApplications)
    .leftJoin(jobs, eq(jobApplications.jobId, jobs.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .offset(skip)
    .limit(Number(limit))
    .orderBy(sortOrder === 'desc' ? desc(jobApplications.submittedAt) : jobApplications.submittedAt);

    // Get ratings for all applications
    const applicationIds = applications.map(app => app.id);
    const allRatings = applicationIds.length > 0 ? await db
        .select()
        .from(jobApplicationRatings)
        .where(inArray(jobApplicationRatings.jobApplicationId, applicationIds)) : [];

    // Get total count for pagination
    const totalResult = await db.select({ count: count() })
      .from(jobApplications)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
    
    const total = totalResult[0]?.count || 0;

    // Calculate average ratings for each application
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
  } catch (error) {
    console.error("Error fetching job applications:", error);
    res.status(500).json({ success: false, message: "Failed to fetch applications" });
  }
};

export const getJobApplicationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const applicationResult = await db.select({
      id: jobApplications.id,
      jobId: jobApplications.jobId,
      applicantName: jobApplications.applicantName,
      applicantEmail: jobApplications.applicantEmail,
      applicantPhone: jobApplications.applicantPhone,
      resumeUrl: jobApplications.resumeUrl,
      coverLetter: jobApplications.coverLetter,
      experience: jobApplications.experience,
      education: jobApplications.education,
      skills: jobApplications.skills,
      portfolioUrl: jobApplications.portfolioUrl,
      linkedinUrl: jobApplications.linkedinUrl,
      status: jobApplications.status,
      submittedAt: jobApplications.submittedAt,
      reviewedAt: jobApplications.reviewedAt,
      reviewedBy: jobApplications.reviewedBy,
      notes: jobApplications.notes
    })
    .from(jobApplications)
    .where(eq(jobApplications.id, parseInt(id)))
    .limit(1);

    if (applicationResult.length === 0) {
      return res.status(404).json({ success: false, message: "Job application not found" });
    }

    const application = applicationResult[0];

    // Get ratings for this application
    const ratings = await db.select({
      id: jobApplicationRatings.id,
      score: jobApplicationRatings.score,
      comments: jobApplicationRatings.comments,
      ratedBy: jobApplicationRatings.ratedBy,
      createdAt: jobApplicationRatings.createdAt
    })
    .from(jobApplicationRatings)
    .where(eq(jobApplicationRatings.jobApplicationId, parseInt(id)));

    res.json({ 
      success: true, 
      data: {
        ...application,
        ratings
      }
    });
  } catch (error) {
    console.error("Error fetching job application:", error);
    res.status(500).json({ success: false, message: "Failed to fetch job application" });
  }
};

export const updateJobApplicationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, reviewedBy } = req.body;

    const applicationResult = await db.update(jobApplications)
      .set({
        status,
        notes,
        reviewedBy,
        reviewedAt: new Date()
      })
      .where(eq(jobApplications.id, parseInt(id)))
      .returning();

    if (applicationResult.length === 0) {
      return res.status(404).json({ success: false, message: "Job application not found" });
    }

    res.json({ success: true, data: applicationResult[0] });
  } catch (error) {
    console.error("Error updating job application status:", error);
    res.status(500).json({ success: false, message: "Failed to update job application status" });
  }
};

export const searchJobApplications = async (req: Request, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      jobId, 
      sortBy = 'submittedAt', 
      sortOrder = 'desc',
      minRating,
      maxRating 
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    
    if (search) {
      where.OR = [
        { applicantName: { contains: search as string, mode: 'insensitive' } },
        { applicantEmail: { contains: search as string, mode: 'insensitive' } },
        { skills: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    
    if (status) where.status = status;
    if (jobId) where.jobId = jobId as string;

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;

    // Convert Prisma where to Drizzle conditions
    const whereConditions = [];
    if (search) {
      whereConditions.push(
        or(
          like(jobApplications.applicantName, `%${search}%`),
          like(jobApplications.applicantEmail, `%${search}%`),
          like(jobApplications.skills, `%${search}%`)
        )
      );
    }
    if (status) whereConditions.push(eq(jobApplications.status, status as any));
    if (jobId) whereConditions.push(eq(jobApplications.jobId, jobId as string));

    const applications = await db.select({
        id: jobApplications.id,
        jobId: jobApplications.jobId,
        applicantName: jobApplications.applicantName,
        email: jobApplications.applicantEmail,
        skills: jobApplications.skills,
        experience: jobApplications.experience,
        status: jobApplications.status,
        appliedAt: jobApplications.submittedAt,
        reviewedBy: jobApplications.reviewedBy,
        reviewedAt: jobApplications.reviewedAt,
        notes: jobApplications.notes,
        job: {
          title: jobs.title,
          department: jobs.department,
        },
      })
      .from(jobApplications)
      .leftJoin(jobs, eq(jobApplications.jobId, jobs.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .offset(skip)
      .limit(Number(limit))
      .orderBy(sortOrder === 'desc' ? desc(jobApplications.submittedAt) : jobApplications.submittedAt);

    const totalResult = await db.select({ count: count() })
    .from(jobApplications)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
    
    const total = totalResult[0]?.count || 0;

    // Get ratings for all applications
    const applicationIds = applications.map(app => app.id);
    const allRatings = applicationIds.length > 0 ? await db.select()
    .from(jobApplicationRatings)
    .where(inArray(jobApplicationRatings.jobApplicationId, applicationIds)) : [];

    // Calculate average rating and filter by rating if specified
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

    // Filter by rating range if specified
    if (minRating || maxRating) {
      applicationsWithRatings = applicationsWithRatings.filter(app => {
        if (minRating && app.averageRating < Number(minRating)) return false;
        if (maxRating && app.averageRating > Number(maxRating)) return false;
        return true;
      });
    }

    // Sort by rating if requested
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
  } catch (error) {
    console.error("Error searching applications:", error);
    res.status(500).json({ success: false, message: "Failed to search applications" });
  }
};

export const getJobApplicationsByStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const applications = await db.select({
      id: jobApplications.id,
      jobId: jobApplications.jobId,
      applicantName: jobApplications.applicantName,
      email: jobApplications.applicantEmail,
      skills: jobApplications.skills,
      experience: jobApplications.experience,
      status: jobApplications.status,
      appliedAt: jobApplications.submittedAt,
      reviewedBy: jobApplications.reviewedBy,
      reviewedAt: jobApplications.reviewedAt,
      notes: jobApplications.notes,
      job: {
        title: jobs.title,
        department: jobs.department,
      },
    })
    .from(jobApplications)
    .leftJoin(jobs, eq(jobApplications.jobId, jobs.id))
    .where(eq(jobApplications.status, status as any))
    .offset(skip)
    .limit(Number(limit))
    .orderBy(desc(jobApplications.submittedAt));

    const totalResult = await db.select({ count: count() })
    .from(jobApplications)
    .where(eq(jobApplications.status, status as any));
    
    const total = totalResult[0]?.count || 0;

    // Get ratings for all applications
    const applicationIds = applications.map(app => app.id);
    const allRatings = applicationIds.length > 0 ? await db.select()
    .from(jobApplicationRatings)
    .where(inArray(jobApplicationRatings.jobApplicationId, applicationIds)) : [];

    // Calculate average rating for each application
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
  } catch (error) {
    console.error("Error fetching applications by status:", error);
    res.status(500).json({ success: false, message: "Failed to fetch applications" });
  }
};

// Rating System Controllers
export const rateJobApplication = async (req: Request, res: Response) => {
  try {
    const { jobApplicationId } = req.params;
    const { score, comments, ratedBy } = req.body;

    // Validate score
    if (score < 1 || score > 5) {
      return res.status(400).json({ 
        success: false, 
        message: "Score must be between 1 and 5" 
      });
    }

    // Check if application exists
    const applicationExists = await db.select({ id: jobApplications.id })
      .from(jobApplications)
      .where(eq(jobApplications.id, parseInt(jobApplicationId)))
      .limit(1);

    if (applicationExists.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Job application not found" 
      });
    }

    // Check if rating already exists
    const existingRating = await db.select({ id: jobApplicationRatings.id })
      .from(jobApplicationRatings)
      .where(
        and(
          eq(jobApplicationRatings.jobApplicationId, parseInt(jobApplicationId)),
          eq(jobApplicationRatings.ratedBy, ratedBy)
        )
      )
      .limit(1);

    if (existingRating.length > 0) {
      // Update existing rating
      const updatedRating = await db.update(jobApplicationRatings)
        .set({
          score,
          comments
        })
        .where(eq(jobApplicationRatings.jobApplicationId, parseInt(jobApplicationId)))
        .returning();

      return res.json({ success: true, data: updatedRating[0] });
    } else {
      // Create new rating
      const newRating = await db.insert(jobApplicationRatings)
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
  } catch (error) {
    console.error("Error rating job application:", error);
    res.status(500).json({ success: false, message: "Failed to rate job application" });
  }
};

export const getJobApplicationRatings = async (req: Request, res: Response) => {
  try {
    const { jobApplicationId } = req.params;

    const ratings = await db.select({
      id: jobApplicationRatings.id,
      score: jobApplicationRatings.score,
      comments: jobApplicationRatings.comments,
      ratedBy: jobApplicationRatings.ratedBy,
      createdAt: jobApplicationRatings.createdAt
    })
    .from(jobApplicationRatings)
    .where(eq(jobApplicationRatings.jobApplicationId, parseInt(jobApplicationId)))
    .orderBy(desc(jobApplicationRatings.createdAt));

    res.json({ success: true, data: ratings });
  } catch (error) {
    console.error("Error fetching job application ratings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch job application ratings" });
  }
};

// Statistics Controllers
export const getJobStats = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    // Get total applications for this job
    const totalApplications = await db.select({ count: count() })
      .from(jobApplications)
      .where(eq(jobApplications.jobId, jobId));

    // Get applications by status for this job
    const applicationsByStatus = await db.select({ count: count() })
      .from(jobApplications)
      .where(eq(jobApplications.jobId, jobId));

    res.json({
      success: true,
      data: {
        totalApplications: totalApplications[0].count,
        applicationsByStatus: applicationsByStatus[0].count
      }
    });
  } catch (error) {
    console.error("Error fetching job stats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch job stats" });
  }
};

export const getApplicationStats = async (_req: Request, res: Response) => {
  try {
    const [totalApplicationsResult, statusStats, activeJobsResult] = await Promise.all([
      db.select({ count: count() }).from(jobApplications),
      db.select({
        status: jobApplications.status,
        count: count(jobApplications.id),
      })
      .from(jobApplications)
      .groupBy(jobApplications.status),
      db.select({ count: count() })
      .from(jobs)
      .where(eq(jobs.isActive, true)),
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
  } catch (error) {
    console.error("Error fetching application stats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch application statistics" });
  }
};

export const exportJobApplications = async (req: Request, res: Response) => {
  try {
    const { jobId, status, format = 'csv' } = req.query;
    
    const where: any = {};
    if (jobId) where.jobId = jobId as string;
    if (status) where.status = status;

    const whereConditions = [];
    if (jobId) whereConditions.push(eq(jobApplications.jobId, jobId as string));
    if (status) whereConditions.push(eq(jobApplications.status, status as any));

    const applications = await db.select({
      id: jobApplications.id,
      jobId: jobApplications.jobId,
      applicantName: jobApplications.applicantName,
      email: jobApplications.applicantEmail,
         phone: jobApplications.applicantPhone,
      status: jobApplications.status,
      appliedAt: jobApplications.submittedAt,
      reviewedAt: jobApplications.reviewedAt,
      job: {
        title: jobs.title,
        department: jobs.department,
      },
    })
    .from(jobApplications)
    .leftJoin(jobs, eq(jobApplications.jobId, jobs.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    // Get ratings for all applications
    const applicationIds = applications.map(app => app.id);
    const allRatings = applicationIds.length > 0 ? await db.select()
    .from(jobApplicationRatings)
    .where(inArray(jobApplicationRatings.jobApplicationId, applicationIds)) : [];

    // Calculate average ratings
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
      const parser = new Parser();
      const csv = parser.parse(applicationsWithRatings);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=job_applications.csv');
      res.send(csv);
    } else {
      res.json({ success: true, data: applicationsWithRatings });
    }
  } catch (error) {
    console.error("Error exporting applications:", error);
    res.status(500).json({ success: false, message: "Failed to export applications" });
  }
};

export const getGeneralJobStats = async (_req: Request, res: Response) => {
  try {
    const [totalJobsResult, activeJobsResult, totalApplicationsResult, pendingApplicationsResult, shortlistedApplicationsResult, hiredApplicationsResult] = await Promise.all([
      db.select({ count: count() }).from(jobs),
      db.select({ count: count() })
      .from(jobs)
      .where(eq(jobs.isActive, true)),
      db.select({ count: count() }).from(jobApplications),
      db.select({ count: count() })
      .from(jobApplications)
      .where(eq(jobApplications.status, 'Submitted')),
      db.select({ count: count() })
      .from(jobApplications)
      .where(eq(jobApplications.status, 'Shortlisted')),
      db.select({ count: count() })
      .from(jobApplications)
      .where(eq(jobApplications.status, 'Hired')),
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
  } catch (error) {
    console.error("Error fetching general job stats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch general job statistics" });
  }
};