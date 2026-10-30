"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRepository = void 0;
const node_crypto_1 = require("node:crypto");
const database_1 = __importStar(require("../config/database"));
exports.authRepository = {
    async findUserByEmail(email, db = database_1.default) {
        return (await db.query(`SELECT * FROM ${database_1.schema}.users WHERE email = $1`, [email])).rows[0];
    },
    async findUserById(id, db = database_1.default) {
        return (await db.query(`SELECT * FROM ${database_1.schema}.users WHERE id = $1`, [id])).rows[0];
    },
    async createUser(email, passwordHash, displayName, role, db = database_1.default) {
        const result = await db.query(`INSERT INTO ${database_1.schema}.users
      (id, email, password_hash, display_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [(0, node_crypto_1.randomUUID)(), email, passwordHash, displayName, role]);
        return result.rows[0];
    },
    async createSession(userId, ttl, db) {
        const result = await db.query(`INSERT INTO ${database_1.schema}.sessions (id, user_id, expires_at)
      VALUES ($1, $2, now() + $3 * interval '1 second') RETURNING *`, [(0, node_crypto_1.randomUUID)(), userId, ttl]);
        return result.rows[0];
    },
    async insertRefreshToken(session, hash, db) {
        await db.query(`INSERT INTO ${database_1.schema}.refresh_tokens (id, session_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)`, [(0, node_crypto_1.randomUUID)(), session.id, hash, session.expires_at]);
    },
    async lockRefreshToken(hash, db) {
        const result = await db.query(`SELECT rt.*, s.user_id, s.revoked_at, s.expires_at > now() AS session_valid,
      rt.expires_at > now() AS token_valid FROM ${database_1.schema}.refresh_tokens rt
      JOIN ${database_1.schema}.sessions s ON s.id = rt.session_id WHERE rt.token_hash = $1 FOR UPDATE OF s, rt`, [hash]);
        return result.rows[0];
    },
    async consumeRefreshToken(id, db) {
        await db.query(`UPDATE ${database_1.schema}.refresh_tokens SET used_at = now() WHERE id = $1`, [id]);
    },
    async revokeSession(id, db = database_1.default) {
        await db.query(`UPDATE ${database_1.schema}.sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1`, [id]);
    },
    async authenticatedUser(userId, sessionId) {
        return (await database_1.default.query(`SELECT u.* FROM ${database_1.schema}.users u
      JOIN ${database_1.schema}.sessions s ON s.user_id = u.id WHERE u.id = $1 AND s.id = $2
      AND u.is_active = true AND s.revoked_at IS NULL AND s.expires_at > now()`, [userId, sessionId])).rows[0];
    }
};
//# sourceMappingURL=auth.repository.js.map