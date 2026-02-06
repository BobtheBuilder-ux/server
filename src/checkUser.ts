
import dotenv from "dotenv";
dotenv.config();

import { db } from "./utils/database";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

async function checkUser() {
  const userId = "seed-landlord-1769276353720";
  console.log(`Checking for user with ID: ${userId}`);
  
  try {
    const allUsers = await db.select().from(users).limit(5);
    console.log("First 5 users:", allUsers.map(u => ({ id: u.id, email: u.email, role: u.role })));
  } catch (error) {
    console.error("Error checking user:", error);
  }
  process.exit(0);
}

checkUser();
