"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshSchema = exports.loginSchema = exports.registerSchema = exports.passwordSchema = exports.emailSchema = void 0;
const zod_1 = require("zod");
exports.emailSchema = zod_1.z.string().trim().toLowerCase().max(254).email();
exports.passwordSchema = zod_1.z.string().min(12).max(128);
exports.registerSchema = zod_1.z.object({
    email: exports.emailSchema, password: exports.passwordSchema,
    displayName: zod_1.z.string().trim().min(1).max(100).optional()
}).strict();
exports.loginSchema = zod_1.z.object({ email: exports.emailSchema, password: exports.passwordSchema }).strict();
exports.refreshSchema = zod_1.z.object({ refreshToken: zod_1.z.string().regex(/^[a-f0-9]{64}$/) }).strict();
//# sourceMappingURL=authValidation.js.map