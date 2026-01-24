import axios from "axios";

// QoreID configuration via environment variables to avoid hardcoding
const QOREID_BASE_URL = process.env.QOREID_BASE_URL || "https://api.qoreid.com";
const QOREID_NIN_PATH = process.env.QOREID_NIN_PATH || "/v1/verifications/identities/nin";
const QOREID_BVN_PATH = process.env.QOREID_BVN_PATH || "/v1/verifications/identities/bvn";
const QOREID_API_KEY = process.env.QOREID_API_KEY || "";
const QOREID_CLIENT_ID = process.env.QOREID_CLIENT_ID || "";
const QOREID_CLIENT_SECRET = process.env.QOREID_CLIENT_SECRET || "";
const QOREID_AUTH_SCHEME = process.env.QOREID_AUTH_SCHEME || "Bearer"; // Some providers use Token/Bearer

if (!QOREID_API_KEY && !(QOREID_CLIENT_ID && QOREID_CLIENT_SECRET)) {
  console.warn("QoreID credentials missing. Set QOREID_API_KEY or QOREID_CLIENT_ID/QOREID_CLIENT_SECRET.");
}

const client = axios.create({
  baseURL: QOREID_BASE_URL,
  timeout: 15000,
});

let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null; // epoch ms

async function getAccessToken(): Promise<string> {
  // Prefer static API key if provided
  if (QOREID_API_KEY) return QOREID_API_KEY;

  // Use cached token if valid
  if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 30_000) {
    return cachedToken;
  }

  if (!(QOREID_CLIENT_ID && QOREID_CLIENT_SECRET)) {
    throw new Error("QoreID client credentials not configured");
  }

  // Attempt SDK-like endpoint that returns text/plain token
  try {
    const { data, headers } = await client.post(
      "/oauth/client-token",
      { clientId: QOREID_CLIENT_ID, secret: QOREID_CLIENT_SECRET },
      { headers: { Accept: "text/plain" } }
    );
    const token = typeof data === "string" ? data : String(data);
    cachedToken = token;
    // Default to 10 minutes validity if not provided
    const ttl = Number(headers["x-token-ttl"]) || 10 * 60;
    tokenExpiresAt = Date.now() + ttl * 1000;
    return token;
  } catch (plainErr) {
    // Fallback to OAuth2 client credentials standard
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", QOREID_CLIENT_ID);
    params.append("client_secret", QOREID_CLIENT_SECRET);
    try {
      const { data } = await client.post("/oauth2/token", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const token = data?.access_token || data?.token;
      if (!token) throw new Error("QoreID token endpoint did not return access_token");
      cachedToken = token;
      const expiresIn = Number(data?.expires_in) || 600; // default 10 minutes
      tokenExpiresAt = Date.now() + expiresIn * 1000;
      return token;
    } catch (oauthErr: any) {
      const msg = oauthErr?.response?.data?.error_description || oauthErr?.message || String(oauthErr);
      throw new Error(`Failed to obtain QoreID access token: ${msg}`);
    }
  }
}

export async function qoreVerifyNIN(nin: string) {
  const token = await getAccessToken();
  const { data } = await client.post(QOREID_NIN_PATH, { nin }, {
    headers: { Authorization: `${QOREID_AUTH_SCHEME} ${token}`, "Content-Type": "application/json" },
  });
  const name = data?.data?.fullName || data?.data?.name || data?.result?.full_name || undefined;
  return { success: !!data, raw: data, name };
}

export async function qoreVerifyBVN(bvn: string) {
  const token = await getAccessToken();
  const { data } = await client.post(QOREID_BVN_PATH, { bvn }, {
    headers: { Authorization: `${QOREID_AUTH_SCHEME} ${token}`, "Content-Type": "application/json" },
  });
  const name = data?.data?.fullName || data?.data?.name || data?.result?.full_name || undefined;
  return { success: !!data, raw: data, name };
}