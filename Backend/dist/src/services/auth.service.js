"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const config_1 = require("../config");
const validation_1 = require("../utils/validation");
exports.adminAuthService = {
    async login(email, password) {
        if (typeof email !== 'string' || !email.trim() || email.length > 255 ||
            typeof password !== 'string' || !password.length || password.length > 1024) {
            throw new logger_1.AppError(400, 'INVALID_LOGIN_REQUEST', 'A valid email and password are required.');
        }
        const emailCheck = email.trim().toLowerCase();
        if (emailCheck !== config_1.config.admin.email.trim().toLowerCase() || !(await (0, validation_1.verifyPassword)(password, config_1.config.admin.password))) {
            throw new logger_1.AppError(401, 'INVALID_ADMIN_CREDENTIALS', 'Invalid admin credentials.');
        }
        const token = jsonwebtoken_1.default.sign({ sub: emailCheck, email: emailCheck, role: 'admin', type: 'access' }, config_1.config.jwt.secret, { expiresIn: config_1.config.jwt.expiresIn });
        return {
            accessToken: token,
            tokenType: 'Bearer',
            expiresIn: config_1.config.jwt.expiresIn
        };
    }
};
//# sourceMappingURL=auth.service.js.map