"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyNIN = verifyNIN;
exports.verifyBVN = verifyBVN;
const tslib_1 = require("tslib");
const axios_1 = tslib_1.__importDefault(require("axios"));
const VERIFYME_BASE_URL = process.env.VERIFYME_BASE_URL || "https://api.verifyme.ng";
const VERIFYME_NIN_PATH = process.env.VERIFYME_NIN_PATH || "/v1/verifications/identities/nin";
const VERIFYME_BVN_PATH = process.env.VERIFYME_BVN_PATH || "/v1/verifications/identities/bvn";
const API_KEY = process.env.VERIFYME_API_KEY || "";
if (!API_KEY) {
    console.warn("VERIFYME_API_KEY is not set. VerifyMe routes will fail until configured.");
}
const client = axios_1.default.create({
    baseURL: VERIFYME_BASE_URL,
    timeout: 10000,
    headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
    },
});
async function verifyNIN(nin) {
    const { data } = await client.post(VERIFYME_NIN_PATH, { nin });
    const name = data?.data?.fullName || data?.data?.name || data?.result?.full_name || undefined;
    return { success: !!data, raw: data, name };
}
async function verifyBVN(bvn) {
    const { data } = await client.post(VERIFYME_BVN_PATH, { bvn });
    const name = data?.data?.fullName || data?.data?.name || data?.result?.full_name || undefined;
    return { success: !!data, raw: data, name };
}
