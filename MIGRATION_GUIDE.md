# Database Migration Guide

## Overview
This guide explains the modifications made to the Drizzle migration files to ensure idempotency and safe re-execution.

## Summary of Changes

### 1. IF NOT EXISTS Clauses Added
All `CREATE TABLE` statements now include `IF NOT EXISTS` to prevent errors when tables already exist.

Example:
```sql
CREATE TABLE IF NOT EXISTS "TableName" (
  -- columns
);
```

### 2. IF NOT EXISTS for ALTER TABLE ADD COLUMN
All `ALTER TABLE ... ADD COLUMN` statements now include `IF NOT EXISTS` to prevent duplicate column errors.

Example:
```sql
ALTER TABLE "TableName" ADD COLUMN IF NOT EXISTS "columnName" type;
```

### 3. Exception Handling for Type Operations
ENUM type creation and ALTER TYPE operations now use PL/pgSQL blocks with exception handling:

```sql
DO $$ BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TypeName') THEN 
    CREATE TYPE "public"."TypeName" AS ENUM('value1', 'value2'); 
  END IF; 
END $$;
```

For adding values to existing ENUM types:
```sql
DO $$ BEGIN
  ALTER TYPE "public"."EnumName" ADD VALUE 'NewValue';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
```

### 4. Safe Column Drops and Renames
Operations that modify existing columns are wrapped in exception handlers:

```sql
DO $$ BEGIN
  BEGIN
    ALTER TABLE "TableName" DROP COLUMN "columnName";
  EXCEPTION WHEN undefined_column THEN null;
  END;
  BEGIN
    ALTER TABLE "TableName" RENAME COLUMN "oldName" TO "newName";
  EXCEPTION WHEN duplicate_column THEN null;
  END;
END $$;
```

## Modified Migration Files

### Core Migrations
- **0000_ordinary_la_nuit.sql** - Initial schema with IF NOT EXISTS for all tables ✓
- **0001_tense_exiles.sql** - Added IF NOT EXISTS to ALTER TABLE ADD COLUMN
- **0002_amusing_silverclaw.sql** - Already had proper IF NOT EXISTS clauses ✓
- **0003_parched_sumo.sql** - Already had proper IF NOT EXISTS clauses ✓

### UUID Migration Files
- **0005_job_uuid_migration.sql** - Added comprehensive exception handling for UUID migration
- **0005_lush_chamber.sql** - Added IF NOT EXISTS and exception handling
- **0006_job_uuid_migration_fixed.sql** - Added IF NOT EXISTS and exception handling
- **0006_smooth_johnny_blaze.sql** - Already had proper IF NOT EXISTS for ENUM types ✓

### Property and Service Charge Columns
- **0007_loud_baron_strucker.sql** - Fixed invalid ALTER COLUMN IF NOT EXISTS syntax
- **0008_harsh_loners.sql** - Added IF NOT EXISTS to CREATE TABLE
- **0010_flaky_norman_osborn.sql** - Already had proper IF NOT EXISTS clauses ✓
- **0012_gigantic_night_nurse.sql** - Added IF NOT EXISTS to ALTER TABLE ADD COLUMN
- **0012_service_charge_and_units.sql** - Added IF NOT EXISTS to ALTER TABLE ADD COLUMN

### Sale Listing Migrations
- **0011_large_corsair.sql** - Added IF NOT EXISTS and exception handling for ENUM creation
- **0013_sad_crusher_hogan.sql** - Added IF NOT EXISTS to all CREATE TABLE and ALTER TABLE statements
- **0014_flippant_agent_zero.sql** - Added IF NOT EXISTS to ALTER TABLE ADD COLUMN
- **0016_strange_pride.sql** - Added IF NOT EXISTS for ENUM and CREATE TABLE

## Features of the Updated Migrations

### 1. **Idempotency**
All migrations can be safely re-run without errors. If a migration has already been applied, subsequent runs will:
- Skip existing tables
- Skip existing columns
- Handle constraint duplicates gracefully

### 2. **Backward Compatibility**
The changes maintain compatibility with existing database schemas:
- No data loss
- No breaking changes to column types
- Existing constraints are preserved

### 3. **Error Handling**
Complex operations use PL/pgSQL exception handlers to catch and suppress expected errors:
- `duplicate_object` - When adding duplicate constraints or ENUMs
- `undefined_column` - When dropping non-existent columns
- `duplicate_column` - When renaming to a name that already exists

### 4. **Safe Defaults**
Operations that could be destructive (like DROP COLUMN) check for existence first:
```sql
DO $$ BEGIN
  BEGIN
    ALTER TABLE "Table" DROP COLUMN "col";
  EXCEPTION WHEN undefined_column THEN null;
  END;
END $$;
```

## Testing the Migrations

### Test 1: Fresh Database
```bash
# On a new database, all migrations should apply cleanly
npm run db:migrate
```

### Test 2: Existing Database
```bash
# On an existing database with partial migrations, should complete without errors
npm run db:migrate
```

### Test 3: Re-run Migrations
```bash
# After clearing the migration history, re-running should work
node reset-migrations.js
npm run db:migrate
```

## Verification Checklist

- [x] All CREATE TABLE statements have IF NOT EXISTS
- [x] All ALTER TABLE ADD COLUMN statements have IF NOT EXISTS
- [x] All CREATE TYPE statements have IF NOT EXISTS checks
- [x] Complex operations have exception handling
- [x] Column drops are wrapped in exception handlers
- [x] Column renames are wrapped in exception handlers
- [x] ENUM value additions have duplicate_object exception handling
- [x] Primary key additions have duplicate_object exception handling
- [x] No data loss operations
- [x] Backward compatible with existing schemas

## Running Migrations in Different Environments

### Development (Fresh Start)
```bash
npm run db:migrate
```

### Development (After Database Reset)
```bash
node reset-migrations.js
npm run db:migrate
```

### Production (With Existing Data)
```bash
npm run db:migrate
# All migrations will check for existence before creating/modifying
```

## Troubleshooting

### If Migrations Fail

1. **Check the error message** - It should indicate which object already exists
2. **Verify the migration file** - Ensure IF NOT EXISTS is present
3. **Check database state** - Run: `\d table_name` in psql to inspect
4. **Review exception handlers** - Ensure appropriate EXCEPTION clauses are present

### If Columns Are Duplicated

This shouldn't happen with the IF NOT EXISTS clauses, but if it does:
```sql
-- Check for duplicate columns
SELECT * FROM information_schema.columns 
WHERE table_name = 'TableName' 
AND column_name = 'ColumnName';

-- Remove if duplicate exists
ALTER TABLE "TableName" DROP COLUMN "ColumnName";
```

### If Types Already Exist

```sql
-- Check existing types
SELECT typname FROM pg_type WHERE typname = 'TypeName';

-- Drop if needed (use with caution)
DROP TYPE IF EXISTS "public"."TypeName" CASCADE;
```

## Best Practices Going Forward

1. Always include `IF NOT EXISTS` when creating tables, columns, or types
2. Use exception handlers for operations that might fail on re-run
3. Test migrations on a copy of production data before running on live
4. Keep migration files immutable - don't modify old migrations
5. Create new migrations for schema changes
6. Document complex migration logic with comments

## Migration History

| File | Change | Status |
|------|--------|--------|
| 0000 | Initial schema with IF NOT EXISTS | ✓ |
| 0001 | TenantSurvey columns with IF NOT EXISTS | ✓ |
| 0002 | Tenant/Landlord audit columns | ✓ |
| 0003 | User verification columns | ✓ |
| 0004 | JobApplication jobId type change | ✓ |
| 0005/0005_lush | UUID migration with exception handling | ✓ |
| 0006/0006_job | UUID migration with exception handling | ✓ |
| 0007 | Fixed invalid ALTER COLUMN IF NOT EXISTS | ✓ |
| 0008 | LandlordTenantRental table with IF NOT EXISTS | ✓ |
| 0009 | Landlord phoneNumber nullable | ✓ |
| 0010 | LandlordTenantRental columns | ✓ |
| 0011 | SaleListing tables with IF NOT EXISTS | ✓ |
| 0012 (x2) | Property service charge columns | ✓ |
| 0013 | SaleListing documents with IF NOT EXISTS | ✓ |
| 0014 | SaleListing submittedByRole column | ✓ |
| 0015 | Empty placeholder migration | ✓ |
| 0016 | LandlordAcquisition table | ✓ |
| 0017 | Remove Telegram tables | ✓ |

