"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qoreVerifyNIN = qoreVerifyNIN;
exports.qoreVerifyBVN = qoreVerifyBVN;
const tslib_1 = require("tslib");
const axios_1 = tslib_1.__importDefault(require("axios"));
const QOREID_BASE_URL = process.env.QOREID_BASE_URL || "https://api.qoreid.com";
const QOREID_NIN_PATH = process.env.QOREID_NIN_PATH || "/v1/verifications/identities/nin";
const QOREID_BVN_PATH = process.env.QOREID_BVN_PATH || "/v1/verifications/identities/bvn";
const QOREID_API_KEY = process.env.QOREID_API_KEY || "";
const QOREID_CLIENT_ID = process.env.QOREID_CLIENT_ID || "";
const QOREID_CLIENT_SECRET = process.env.QOREID_CLIENT_SECRET || "";
const QOREID_AUTH_SCHEME = process.env.QOREID_AUTH_SCHEME || "Bearer";
if (!QOREID_API_KEY && !(QOREID_CLIENT_ID && QOREID_CLIENT_SECRET)) {
    console.warn("QoreID credentials missing. Set QOREID_API_KEY or QOREID_CLIENT_ID/QOREID_CLIENT_SECRET.");
}
const client = axios_1.default.create({
    baseURL: QOREID_BASE_URL,
    timeout: 15000,
});
let cachedToken = null;
let tokenExpiresAt = null;
async function getAccessToken() {
    if (QOREID_API_KEY)
        return QOREID_API_KEY;
    if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 30000) {
        return cachedToken;
    }
    if (!(QOREID_CLIENT_ID && QOREID_CLIENT_SECRET)) {
        throw new Error("QoreID client credentials not configured");
    }
    try {
        const { data, headers } = await client.post("/oauth/client-token", { clientId: QOREID_CLIENT_ID, secret: QOREID_CLIENT_SECRET }, { headers: { Accept: "text/plain" } });
        const token = typeof data === "string" ? data : String(data);
        cachedToken = token;
        const ttl = Number(headers["x-token-ttl"]) || 10 * 60;
        tokenExpiresAt = Date.now() + ttl * 1000;
        return token;
    }
    catch (plainErr) {
        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");
        params.append("client_id", QOREID_CLIENT_ID);
        params.append("client_secret", QOREID_CLIENT_SECRET);
        try {
            const { data } = await client.post("/oauth2/token", params, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });
            const token = data?.access_token || data?.token;
            if (!token)
                throw new Error("QoreID token endpoint did not return access_token");
            cachedToken = token;
            const expiresIn = Number(data?.expires_in) || 600;
            tokenExpiresAt = Date.now() + expiresIn * 1000;
            return token;
        }
        catch (oauthErr) {
            const msg = oauthErr?.response?.data?.error_description || oauthErr?.message || String(oauthErr);
            throw new Error(`Failed to obtain QoreID access token: ${msg}`);
        }
    }
}
async function qoreVerifyNIN(nin) {
    const token = await getAccessToken();
    const { data } = await client.post(QOREID_NIN_PATH, { nin }, {
        headers: { Authorization: `${QOREID_AUTH_SCHEME} ${token}`, "Content-Type": "application/json" },
    });
    const name = data?.data?.fullName || data?.data?.name || data?.result?.full_name || undefined;
    return { success: !!data, raw: data, name };
}
async function qoreVerifyBVN(bvn) {
    const token = await getAccessToken();
    const { data } = await client.post(QOREID_BVN_PATH, { bvn }, {
        headers: { Authorization: `${QOREID_AUTH_SCHEME} ${token}`, "Content-Type": "application/json" },
    });
    const name = data?.data?.fullName || data?.data?.name || data?.result?.full_name || undefined;
    return { success: !!data, raw: data, name };
}
