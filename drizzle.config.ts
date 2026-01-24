import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DRIZZLE_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("[drizzle] DATABASE_URL not found. Set DRIZZLE_DATABASE_URL or DATABASE_URL.");
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: dbUrl || '',
    ssl: dbUrl?.includes('ssl=true') ? { rejectUnauthorized: false } : undefined as any,
  },
  verbose: true,
  strict: true,
});
