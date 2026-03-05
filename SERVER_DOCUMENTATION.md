# HomeMatch Server API Documentation

This documentation provides a comprehensive overview of the HomeMatch server-side API, built with Node.js, Express, and Drizzle ORM, using Better Auth for authentication.

## Table of Contents
- [Authentication & User Management](#authentication--user-management)
- [Admin & Analytics](#admin--analytics)
- [Property & Rental Management](#property--rental-management)
- [Sales & Real Estate Companies](#sales--real-estate-companies)
- [Payments & Earnings](#payments--earnings)
- [Communication & Feedback](#communication--feedback)
- [System & Utility](#system--utility)

---

## Authentication & User Management
Handles user registration, login, role validation, and identity verification.

### Better Auth Integration
The core authentication is handled by Better Auth, mounted at `/api/auth/*`.

### Session & Identity Endpoints
- **POST `/api/auth/signin`**: Sign in with email and password. Returns user profile (with role), session data, `userType`, and an `accessToken` (sourced from the `Account` table if available, or the session token).
- **GET `/api/auth/session`**: Get the current session, user profile, `userType` (role), and `token`. This endpoint is used by the frontend to verify authentication status, determine the user's role across the platform, and retrieve the session token for client-side use.
- **POST `/api/auth/signup`**: General signup endpoint that routes to role-based registration. Requires `email`, `password`, `name`, and `role`.
- **POST `/api/auth/register/landlord`**: Register a new landlord.
- **POST `/api/auth/register/agent`**: Register a new agent (requires registration code).
- **POST `/api/auth/cleanup/delete-on-refresh`**: Deletes unverified user accounts immediately on page refresh.
- **GET `/api/auth/cleanup/should-delete/:userId`**: Check if a user should be deleted due to verification timeout.

### Email Verification
- **POST `/api/email-verification/generate-verification-link`**: Generates and sends a 24-hour verification token.

### Identity Verification
- **POST `/api/verify/nin`**: Verifies a Nigerian National Identification Number (NIN).
- **POST `/api/verify/bvn`**: Verifies a Bank Verification Number (BVN).

---

## Admin & Analytics
High-level management and system monitoring (typically restricted to the `admin` role).

### Public Admin Routes
- **POST `/admin/admins`**: Public endpoint to create an initial admin account.

### Protected Admin Routes
- **GET `/admin/analytics`**: Dashboard statistics (revenue, users, property growth).
- **GET `/admin/users`**: List and manage all platform users.
- **POST `/admin/users`**: Create a new user (Agent/Blogger).
- **PUT `/admin/users/:userId/status`**: Activate/Deactivate users.
- **DELETE `/admin/users/:userId`**: Delete a user.
- **PUT `/admin/users/:userId/role`**: Update user role (requires SUPER_ADMIN).
- **GET `/admin/properties`**: List and manage all platform properties.
- **PUT `/admin/properties/:propertyId/status`**: Approve or reject property listings.
- **GET `/admin/settings`**: Configure global system settings.
- **PUT `/admin/settings`**: Update global system settings.
- **GET `/admin/activity-log`**: Audit trail of administrative actions.

### Registration Code Management
- **GET `/admin/landlord-registrations`**: List generated landlord registration codes.
- **GET `/admin/agent-registrations`**: List generated agent registration codes.
- **POST `/admin/assign-code-to-agent`**: Assign a registration code to a specific agent.

### Task Management
- **POST `/admin/tasks`**: Create a new task for an agent.
- **GET `/admin/tasks`**: List tasks.
- **PUT `/admin/tasks/:id`**: Update task status.
- **DELETE `/admin/tasks/:id`**: Delete a task.

---

## Property & Rental Management
Core functionality for listing, searching, and applying for rental properties.

### Properties
- **GET `/properties`**: List properties with filtering (price, location, amenities).
- **GET `/properties/:id`**: Get detailed information for a single property.
- **POST `/properties`**: Create a new property listing (Landlords only).
- **GET `/properties/:propertyId/leases`**: Get all leases associated with a property.

### Tenants
- **GET `/tenants/:authId`**: Get tenant profile.
- **POST `/tenants`**: Create tenant profile.
- **PUT `/tenants/:authId`**: Update tenant profile.
- **GET `/tenants/:authId/current-residences`**: Get tenant's current active leases.
- **POST `/tenants/:authId/favorites/:propertyId`**: Add property to favorites.
- **DELETE `/tenants/:authId/favorites/:propertyId`**: Remove property from favorites.

### Landlords
- **GET `/landlords/:authId`**: Get landlord profile.
- **GET `/landlords/:authId/properties`**: List landlord's properties.
- **GET `/landlords/:authId/tenants`**: List landlord's tenants.
- **POST `/landlords/register-with-code`**: Register using an invitation code.
- **POST `/landlords/:authId/generate-tenant-link`**: Generate a registration link for tenants.

### Applications
- **POST `/applications`**: Submit a rental application.
- **POST `/applications/with-files`**: Submit application with ID and income proof.
- **GET `/applications`**: List applications.
- **PUT `/applications/:id/status`**: Update application status (Admin only).

### Leases
- **GET `/leases`**: Get all active leases for the user.
- **GET `/leases/:id/payments`**: Get payment history for a specific lease.

### Inspections
- **GET `/inspections/limit/:tenantCognitoId`**: Check free inspection limit.
- **POST `/inspections/request`**: Schedule a physical property viewing.

---

## Sales & Real Estate Companies
Module for property sales and real estate company profiles.

### Sale Listings
- **GET `/sales/listings`**: Publicly browse properties for sale.
- **POST `/sales/listings`**: Submit a property for sale.
- **POST `/sales/listings/:id/negotiations`**: Submit a price negotiation.
- **POST `/sales/listings/:id/viewings`**: Request a viewing for a sale listing.

### Real Estate Companies
- **GET `/real-estate-companies`**: List all verified companies.
- **GET `/real-estate-companies/:id`**: Get company profile.
- **POST `/real-estate-companies/register`**: Register a company profile (requires authentication).
- **GET `/real-estate-companies/me`**: Get logged-in company profile.
- **PATCH `/real-estate-companies/:id/status`**: Approve/Reject company (Admin only).

---

## Payments & Earnings
Financial transactions and landlord withdrawal management.

### Payments
- **POST `/payments/initialize`**: Initialize payment via Flutterwave.
- **GET `/payments/verify/:reference`**: Verify a payment reference.
- **GET `/payments/history/:leaseId`**: Get payment records for a lease.
- **POST `/payments/create`**: Manually create a payment record (Admin/Tenant).

### Earnings
- **GET `/earnings/landlord/:authId`**: Get earnings statistics.
- **POST `/earnings/landlord/:authId/withdraw`**: Create a withdrawal request.
- **GET `/earnings/landlord/:authId/withdrawals`**: Get withdrawal history.

---

## Communication & Feedback
Notifications, SMS, and user surveys.

### Notifications
- **GET `/notifications`**: Get user notifications.
- **PATCH `/notifications/:id/read`**: Mark notification as read.
- **PATCH `/notifications/mark-all-read`**: Mark all as read.

### SMS (via Termii)
- **POST `/sms/rent-reminder`**: Send rent reminder to tenant.
- **POST `/sms/renewal-request`**: Send renewal request to tenant.
- **GET `/sms/stats`**: Get SMS statistics (Admin only).

### Surveys
- **POST `/surveys/tenant`**: Submit tenant survey and join waiting list.
- **POST `/surveys/landlord`**: Submit landlord survey.

---

## System & Utility
File uploads and infrastructure support.

### Cloudinary Uploads
- **POST `/cloudinary/single`**: Upload a single file.
- **POST `/cloudinary/multiple`**: Upload multiple files.
- **POST `/cloudinary/property-photos`**: Upload property images with watermarking.
- **POST `/cloudinary/property-video`**: Upload property video with watermarking.

### Cron Jobs
- **GET `/cron/status`**: Check status of scheduled jobs.
- **POST `/cron/trigger/:jobName`**: Manually run a job.
- **POST `/cron/stop/:jobName`**: Stop a specific job.

### Health Check
- **GET `/health`**: Returns the health status of the server and database.
