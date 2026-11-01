"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrityService = void 0;
const googleapis_1 = require("googleapis");
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
require("../config");
const logger_1 = require("../utils/logger");
function fingerprintToken(token) {
    return {
        length: token.length,
        startsWith: token.slice(0, 16),
        endsWith: token.slice(-16),
        sha256Prefix: crypto_1.default.createHash('sha256').update(token).digest('hex').slice(0, 16),
        hasWhitespace: /\s/.test(token),
    };
}
/**
 * Required env vars:
 * - GOOGLE_SERVICE_ACCOUNT_JSON: full service-account JSON content
 *   (same GCP project linked to your app in the Play Console)
 * - GOOGLE_CREDENTIALS_PATH: optional local fallback path to the JSON key
 * - ANDROID_PACKAGE_NAME: the app's applicationId
 */
class IntegrityService {
    playIntegrity = null;
    getServiceAccountInfo() {
        const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (!serviceAccountJson)
            return null;
        try {
            const credentials = JSON.parse(serviceAccountJson);
            return {
                projectId: credentials.project_id,
                clientEmail: credentials.client_email,
            };
        }
        catch {
            return { projectId: 'invalid-json', clientEmail: undefined };
        }
    }
    getClient() {
        if (this.playIntegrity) {
            return this.playIntegrity;
        }
        const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
        const authOptions = {
            scopes: ['https://www.googleapis.com/auth/playintegrity'],
        };
        if (serviceAccountJson) {
            try {
                authOptions.credentials = JSON.parse(serviceAccountJson);
            }
            catch (error) {
                throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: ${error.message}`);
            }
        }
        else if (credentialsPath) {
            authOptions.keyFile = path_1.default.resolve(process.cwd(), credentialsPath);
        }
        else {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_CREDENTIALS_PATH is required.');
        }
        const auth = new googleapis_1.google.auth.GoogleAuth(authOptions);
        this.playIntegrity = googleapis_1.google.playintegrity({ version: 'v1', auth });
        return this.playIntegrity;
    }
    /**
     * Decodes a Play Integrity token via Google's servers.
     * Throws on any failure — callers decide the fallback behavior.
     */
    async decodeToken(integrityToken) {
        const packageName = process.env.ANDROID_PACKAGE_NAME;
        if (!packageName) {
            throw new Error('ANDROID_PACKAGE_NAME is missing from your .env file.');
        }
        try {
            const response = await this.getClient().v1.decodeIntegrityToken({
                packageName,
                requestBody: { integrityToken },
            });
            return response.data.tokenPayloadExternal;
        }
        catch (error) {
            console.error('[Integrity] Failed to decode token:', {
                message: error.message,
                status: error.response?.status,
                code: error.response?.data?.error?.code,
                reason: error.response?.data?.error?.status,
                details: error.response?.data?.error?.details,
                packageName,
                serviceAccount: this.getServiceAccountInfo(),
                token: fingerprintToken(integrityToken),
            });
            if (error.message.includes('Integrity token has expired')) {
                throw new logger_1.AppError(410, 'FAILED_TO_DECODE_TOKEN', 'Integrity token expired');
            }
            else {
                throw new Error('FAILED_TO_DECODE_TOKEN');
            }
        }
    }
}
exports.integrityService = new IntegrityService();
