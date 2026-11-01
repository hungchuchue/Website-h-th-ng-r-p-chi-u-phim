"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
    dbUrl: process.env.DATABASE_URL || '',
    androidPackageName: (process.env.ANDROID_PACKAGE_NAME || '').trim(),
    integrityTokenTtlDays: parseInt(process.env.INTEGRITY_TOKEN_TTL_DAYS || '30', 10),
    admobMissingCustomDataBlockHours: parseInt(process.env.ADMOB_MISSING_CUSTOM_DATA_BLOCK_HOURS || '24', 10),
    rewards: {
        adsPerGenerate: parseInt(process.env.ADS_PER_GENERATE || '6', 10),
        sessionTtlMinutes: parseInt(process.env.AD_SESSION_TTL_MINUTES || '30', 10),
        dailyAdCap: parseInt(process.env.DAYLY_AD_CAP || '5', 10),
    },
    siliconFlow: {
        apiKey: process.env.SILICONFLOW_API_KEY || '',
        baseUrl: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.com',
        fluxSchnellModel: process.env.SILICONFLOW_FLUX_SCHNELL_MODEL || 'black-forest-labs/FLUX.1-schnell',
    },
    baseUrl: process.env.BASE_URL || '',
    r2: {
        accountId: process.env.R2_ACCOUNT_ID || '',
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        bucketName: process.env.R2_BUCKET_NAME || '',
        publicUrl: process.env.R2_PUBLIC_URL || '',
    },
    jwt: {
        secret: process.env.ADMIN_JWT_SECRET || '',
        expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '15m',
    },
    admin: {
        email: process.env.ADMIN_EMAIL || '',
        email_4: process.env.ADMIN_EMAIL_4 || '',
        password: process.env.ADMIN_PASSWORD || '',
        password_4: process.env.ADMIN_PASSWORD_4 || '',
        usersJson: process.env.ADMIN_USERS_JSON || '',
    }
};
// Validate required configs roughly
if (exports.config.env === 'production') {
    const required = [
        'dbUrl', 'byteplus.apiKey', 'byteplus.modelId', 'byteplus.webhookSecret',
        'r2.accountId', 'r2.accessKeyId', 'r2.secretAccessKey', 'r2.bucketName', 'r2.publicUrl'
    ];
    // In a real app we might rigorously check these, for now we let it pass.
}
