import axios from "axios";

// Allow configuration via env; set sensible defaults
const VERIFYME_BASE_URL = process.env.VERIFYME_BASE_URL || "https://api.verifyme.ng";
const VERIFYME_NIN_PATH = process.env.VERIFYME_NIN_PATH || "/v1/verifications/identities/nin";
const VERIFYME_BVN_PATH = process.env.VERIFYME_BVN_PATH || "/v1/verifications/identities/bvn";
const API_KEY = process.env.VERIFYME_API_KEY || "";

if (!API_KEY) {
  // Intentionally not throwing at import time to avoid crashing server; routes will handle errors.
  console.warn("VERIFYME_API_KEY is not set. VerifyMe routes will fail until configured.");
}

const client = axios.create({
  baseURL: VERIFYME_BASE_URL,
  timeout: 10000,
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  },
});

export async function verifyNIN(nin: string) {
  // Endpoint based on VerifyMe docs; configurable via env to adapt to API versions
  const { data } = await client.post(VERIFYME_NIN_PATH, { nin });
  // Normalize response to include full name when available
  const name = data?.data?.fullName || data?.data?.name || data?.result?.full_name || undefined;
  return { success: !!data, raw: data, name };
}

export async function verifyBVN(bvn: string) {
  // Endpoint based on VerifyMe docs; configurable via env to adapt to API versions
  const { data } = await client.post(VERIFYME_BVN_PATH, { bvn });
  const name = data?.data?.fullName || data?.data?.name || data?.result?.full_name || undefined;
  return { success: !!data, raw: data, name };
}