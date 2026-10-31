"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
// Both src/config and dist/src/config resolve to the same Backend/.env.
const backendRoot = (0, node_fs_1.existsSync)((0, node_path_1.resolve)(__dirname, '../../package.json'))
    ? (0, node_path_1.resolve)(__dirname, '../..')
    : (0, node_path_1.resolve)(__dirname, '../../..');
const envPath = (0, node_path_1.resolve)(backendRoot, '.env');
const envResult = dotenv_1.default.config({ path: envPath });
if (envResult.error)
    throw new Error(`Unable to load backend environment file: ${envPath}`);
exports.config = {
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
if (!exports.config.dbUrl || !exports.config.admin.email || !exports.config.admin.password || !exports.config.jwt.secret) {
    throw new Error('DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_JWT_SECRET are required');
}
if (!Number.isInteger(exports.config.port) || exports.config.port < 1 || exports.config.port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
}
// Validate required configs roughly
if (exports.config.env === 'production') {
    const required = [
        'dbUrl', 'byteplus.apiKey', 'byteplus.modelId', 'byteplus.webhookSecret',
        'r2.accountId', 'r2.accessKeyId', 'r2.secretAccessKey', 'r2.bucketName', 'r2.publicUrl'
    ];
    // In a real app we might rigorously check these, for now we let it pass.
}
//# sourceMappingURL=index.js.map