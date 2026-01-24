-- Performance indexes for HomeMatch database
-- Run this script to add indexes for better query performance

-- Property table indexes
CREATE INDEX IF NOT EXISTS "idx_property_status" ON "Property"("status");
CREATE INDEX IF NOT EXISTS "idx_property_type" ON "Property"("propertyType");
CREATE INDEX IF NOT EXISTS "idx_property_price_per_year" ON "Property"("pricePerYear");
CREATE INDEX IF NOT EXISTS "idx_property_beds" ON "Property"("beds");
CREATE INDEX IF NOT EXISTS "idx_property_baths" ON "Property"("baths");
CREATE INDEX IF NOT EXISTS "idx_property_square_feet" ON "Property"("squareFeet");
CREATE INDEX IF NOT EXISTS "idx_property_landlord_cognito_id" ON "Property"("landlordCognitoId");
CREATE INDEX IF NOT EXISTS "idx_property_location_id" ON "Property"("locationId");
CREATE INDEX IF NOT EXISTS "idx_property_posted_date" ON "Property"("postedDate");

-- Text search indexes for property name and amenities
CREATE INDEX IF NOT EXISTS "idx_property_name" ON "Property"("name");
CREATE INDEX IF NOT EXISTS "idx_property_amenities" ON "Property"("amenities");

-- Location table indexes
CREATE INDEX IF NOT EXISTS "idx_location_city" ON "Location"("city");
CREATE INDEX IF NOT EXISTS "idx_location_state" ON "Location"("state");
CREATE INDEX IF NOT EXISTS "idx_location_country" ON "Location"("country");
CREATE INDEX IF NOT EXISTS "idx_location_postal_code" ON "Location"("postalCode");
CREATE INDEX IF NOT EXISTS "idx_location_address" ON "Location"("address");
CREATE INDEX IF NOT EXISTS "idx_location_coordinates" ON "Location"("coordinates");

-- Application table indexes
CREATE INDEX IF NOT EXISTS "idx_application_status" ON "Application"("status");
CREATE INDEX IF NOT EXISTS "idx_application_property_id" ON "Application"("propertyId");
CREATE INDEX IF NOT EXISTS "idx_application_tenant_cognito_id" ON "Application"("tenantCognitoId");
CREATE INDEX IF NOT EXISTS "idx_application_created_at" ON "Application"("createdAt");
CREATE INDEX IF NOT EXISTS "idx_application_updated_at" ON "Application"("updatedAt");

-- Tenant table indexes
CREATE INDEX IF NOT EXISTS "idx_tenant_cognito_id" ON "Tenant"("cognitoId");
CREATE INDEX IF NOT EXISTS "idx_tenant_email" ON "Tenant"("email");
CREATE INDEX IF NOT EXISTS "idx_tenant_created_at" ON "Tenant"("createdAt");

-- Landlord table indexes
CREATE INDEX IF NOT EXISTS "idx_landlord_cognito_id" ON "Landlord"("cognitoId");
CREATE INDEX IF NOT EXISTS "idx_landlord_email" ON "Landlord"("email");
CREATE INDEX IF NOT EXISTS "idx_landlord_created_at" ON "Landlord"("createdAt");

-- Agent table indexes
CREATE INDEX IF NOT EXISTS "idx_agent_cognito_id" ON "Agent"("cognitoId");
CREATE INDEX IF NOT EXISTS "idx_agent_email" ON "Agent"("email");
CREATE INDEX IF NOT EXISTS "idx_agent_created_at" ON "Agent"("createdAt");

-- Admin table indexes
CREATE INDEX IF NOT EXISTS "idx_admin_cognito_id" ON "Admin"("cognitoId");
CREATE INDEX IF NOT EXISTS "idx_admin_email" ON "Admin"("email");

-- Lease table indexes
CREATE INDEX IF NOT EXISTS "idx_lease_property_id" ON "Lease"("propertyId");
CREATE INDEX IF NOT EXISTS "idx_lease_tenant_id" ON "Lease"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lease_start_date" ON "Lease"("startDate");
CREATE INDEX IF NOT EXISTS "idx_lease_end_date" ON "Lease"("endDate");
CREATE INDEX IF NOT EXISTS "idx_lease_created_at" ON "Lease"("createdAt");

-- Payment table indexes
CREATE INDEX IF NOT EXISTS "idx_payment_status" ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "idx_payment_lease_id" ON "Payment"("leaseId");
CREATE INDEX IF NOT EXISTS "idx_payment_due_date" ON "Payment"("dueDate");
CREATE INDEX IF NOT EXISTS "idx_payment_created_at" ON "Payment"("createdAt");

-- Task table indexes
CREATE INDEX IF NOT EXISTS "idx_task_status" ON "Task"("status");
CREATE INDEX IF NOT EXISTS "idx_task_priority" ON "Task"("priority");
CREATE INDEX IF NOT EXISTS "idx_task_assigned_to" ON "Task"("assignedTo");
CREATE INDEX IF NOT EXISTS "idx_task_created_at" ON "Task"("createdAt");
CREATE INDEX IF NOT EXISTS "idx_task_due_date" ON "Task"("dueDate");

-- AgentProperty table indexes
CREATE INDEX IF NOT EXISTS "idx_agent_property_agent_id" ON "AgentProperty"("agentId");
CREATE INDEX IF NOT EXISTS "idx_agent_property_property_id" ON "AgentProperty"("propertyId");
CREATE INDEX IF NOT EXISTS "idx_agent_property_created_at" ON "AgentProperty"("createdAt");

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_property_status_type_price" ON "Property"("status", "propertyType", "pricePerYear");
CREATE INDEX IF NOT EXISTS "idx_property_location_status" ON "Property"("locationId", "status");
CREATE INDEX IF NOT EXISTS "idx_application_property_status" ON "Application"("propertyId", "status");

-- Partial indexes for better performance on filtered queries
CREATE INDEX IF NOT EXISTS "idx_property_available" ON "Property"("id") WHERE "status" = 'Available';
CREATE INDEX IF NOT EXISTS "idx_application_pending" ON "Application"("id") WHERE "status" = 'Pending';
CREATE INDEX IF NOT EXISTS "idx_payment_overdue" ON "Payment"("id") WHERE "status" = 'Overdue';