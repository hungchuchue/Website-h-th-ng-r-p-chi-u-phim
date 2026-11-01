"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const config_1 = require("../config");
const validation_1 = require("../utils/validation");
const JWT_SECRET = config_1.config.jwt.secret || 'changeme_secret';
const JWT_EXPIRES_IN = Number(config_1.config.jwt.expiresIn || 900);
const ADMIN_EMAIL = config_1.config.admin.email || 'admin';
const ADMIN_PASSWORD = config_1.config.admin.password || 'password';
const buildAdminUser = (user, index, fallbackAdminKey) => {
    const adminKey = user.admin_key || user.default_api_target || fallbackAdminKey;
    const allowedApiTargets = user.allowed_api_targets?.length
        ? user.allowed_api_targets
        : [adminKey];
    return {
        id: user.id || index + 1,
        email: user.email.trim().toLowerCase(),
        password_hash: user.password,
        display_name: 'Admin',
        avatar_url: null,
        role: user.role || 'admin',
        admin_key: adminKey,
        allowed_api_targets: allowedApiTargets,
        default_api_target: user.default_api_target || allowedApiTargets[0] || adminKey,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
    };
};
const getAdminUsers = () => {
    if (config_1.config.admin.usersJson) {
        try {
            const users = JSON.parse(config_1.config.admin.usersJson);
            if (!Array.isArray(users)) {
                throw new Error('ADMIN_USERS_JSON must be an array');
            }
            return users.map((user, index) => buildAdminUser(user, index, String(index + 1)));
        }
        catch (error) {
            throw new logger_1.AppError(500, 'INVALID_ADMIN_USERS_JSON', `ADMIN_USERS_JSON is invalid: ${error.message}`);
        }
    }
    const indexedUsers = Object.keys(process.env)
        .filter((key) => key.startsWith('ADMIN_EMAIL_'))
        .map((key) => key.slice('ADMIN_EMAIL_'.length))
        .filter(Boolean)
        .sort()
        .flatMap((adminKey, index) => {
        const email = process.env[`ADMIN_EMAIL_${adminKey}`];
        const password = process.env[`ADMIN_PASSWORD_${adminKey}`];
        if (!email || !password) {
            return [];
        }
        const allowedApiTargets = (process.env[`ADMIN_ALLOWED_API_TARGETS_${adminKey}`] || adminKey)
            .split(',')
            .map((target) => target.trim())
            .filter(Boolean);
        return buildAdminUser({
            id: index + 1,
            email,
            password,
            admin_key: adminKey,
            allowed_api_targets: allowedApiTargets,
            default_api_target: process.env[`ADMIN_DEFAULT_API_TARGET_${adminKey}`] || allowedApiTargets[0] || adminKey,
        }, index, adminKey);
    });
    const legacyUser = buildAdminUser({
        id: 1,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        admin_key: 'default',
        allowed_api_targets: ['default'],
        default_api_target: 'default',
    }, 0, 'default');
    return [legacyUser, ...indexedUsers];
};
// ── Service ───────────────────────────────────────────────────
exports.authService = {
    async login(body) {
        const email = body.email.trim().toLowerCase();
        // check mã hoá password
        const hashedInputPassword = (0, validation_1.hashPassword)(body.password);
        const adminUser = getAdminUsers().find((user) => user.email === email && user.password_hash === hashedInputPassword);
        if (adminUser) {
            return this.createToken(adminUser);
        }
        throw new logger_1.AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    },
    createToken(user) {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
            admin_key: user.admin_key,
            allowed_api_targets: user.allowed_api_targets,
            default_api_target: user.default_api_target,
        };
        return {
            token: jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }),
            expires_in: JWT_EXPIRES_IN,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                admin_key: user.admin_key,
                api_target: user.default_api_target,
                allowed_api_targets: user.allowed_api_targets,
                default_api_target: user.default_api_target,
            },
        };
    }
};
