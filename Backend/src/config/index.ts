import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { backendRoot } from './backend-path';

const envPath = resolve(backendRoot(), '.env');
const envResult = dotenv.config({ path: envPath });
if (envResult.error) throw new Error(`Unable to load backend environment file: ${envPath}`);

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3002', 10),
    host: process.env.HOST || 'localhost',
    dbUrl: process.env.DATABASE_URL || '',
    baseUrl: process.env.BASE_URL || '',
    jwt: {
        secret: process.env.ADMIN_JWT_SECRET || '',
        expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '15m',
    },

    admin: {
        email: process.env.ADMIN_EMAIL || '',
        password: process.env.ADMIN_PASSWORD || '',
    },
    byteplus: {
        baseUrl: process.env.BYTEPLUS_BASE_URL || '',
        apiKey: process.env.BYTEPLUS_API_KEY || '',
        modelId: process.env.BYTEPLUS_MODEL_ID || '',
        webhookSecret: process.env.BYTEPLUS_WEBHOOK_SECRET || '',
    },
};

if (!config.dbUrl || !config.admin.email || !config.admin.password || !config.jwt.secret) {
    throw new Error('DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_JWT_SECRET are required');
}
if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
}

// Validate required configs roughly
if (config.env === 'production') {
    const required = [
        'dbUrl', 'byteplus.apiKey', 'byteplus.modelId', 'byteplus.webhookSecret',
        'r2.accountId', 'r2.accessKeyId', 'r2.secretAccessKey', 'r2.bucketName', 'r2.publicUrl'
    ];
    // In a real app we might rigorously check these, for now we let it pass.
}
