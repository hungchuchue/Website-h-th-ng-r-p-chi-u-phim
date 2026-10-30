"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = require("node:path");
const swagger_autogen_1 = __importDefault(require("swagger-autogen"));
const index_1 = require("./index");
const publicUrl = new URL(index_1.config.baseUrl || `http://localhost:${index_1.config.port}`);
const basePath = publicUrl.pathname.replace(/\/+$/, '');
const apiPath = basePath.endsWith('/api/v1') ? basePath : basePath + '/api/v1';
const servers = ['http:', 'https:'].map(protocol => ({
    url: `${protocol}//${publicUrl.host}${apiPath}`,
    description: protocol === 'http:' ? 'HTTP' : 'HTTPS via deployment TLS proxy',
}));
const userSchema = {
    type: 'object',
    required: ['id', 'email', 'displayName', 'role', 'isActive', 'createdAt', 'updatedAt'],
    properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', example: 'admin', description: 'Normalized account identifier' },
        displayName: { type: 'string', nullable: true, example: 'Administrator' },
        role: { type: 'string', enum: ['user', 'editor', 'admin'], example: 'admin' },
        isActive: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
    },
};
const doc = {
    info: {
        title: 'CMS Firebase Management API',
        description: 'Log in with the configured administrator email and password. Use data.accessToken as a Bearer JWT. Local Node serves HTTP; HTTPS requires a TLS proxy.',
        version: '1.0.0',
    },
    servers,
    tags: [{ name: 'Auth', description: 'Administrator login and authenticated account details.' }],
    components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
        '@schemas': {
            AdminLoginRequest: {
                type: 'object', required: ['email', 'password'], additionalProperties: false,
                properties: {
                    email: { type: 'string', minLength: 1, maxLength: 255, example: 'admin' },
                    password: { type: 'string', format: 'password', minLength: 1, maxLength: 1024, example: '<admin-password>', writeOnly: true },
                },
            },
            AuthenticatedUser: userSchema,
            AuthSuccessResponse: {
                type: 'object', required: ['code', 'message', 'data'],
                properties: {
                    code: { type: 'integer', example: 200 },
                    message: { type: 'string', example: 'Login success' },
                    data: {
                        type: 'object', required: ['accessToken', 'tokenType', 'expiresIn'],
                        properties: {
                            accessToken: { type: 'string', example: '<access-jwt>' },
                            tokenType: { type: 'string', enum: ['Bearer'] },
                            expiresIn: { type: 'string', example: '15m' },
                        },
                    },
                },
            },
            CurrentUserResponse: {
                type: 'object', required: ['success', 'data'],
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AuthenticatedUser' },
                },
            },
            ApiError: {
                type: 'object', required: ['code', 'message', 'data'],
                properties: {
                    code: { type: 'integer', example: 401 },
                    message: { type: 'string', example: 'Invalid admin credentials.' },
                    data: { nullable: true, example: null },
                },
            },
        },
    },
};
void (0, swagger_autogen_1.default)({ openapi: '3.0.0' })((0, node_path_1.resolve)(__dirname, 'swagger_output.json'), [(0, node_path_1.resolve)(__dirname, '../routes/index.ts')], doc).then(result => {
    if (!result || !result.success)
        process.exitCode = 1;
}).catch(() => {
    console.error('Swagger generation failed');
    process.exitCode = 1;
});
//# sourceMappingURL=swagger.js.map