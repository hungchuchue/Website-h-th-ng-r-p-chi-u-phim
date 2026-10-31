"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const index_1 = require("./index");
// Create a connection pool using the provided database URL
const pool = new pg_1.Pool({
    connectionString: index_1.config.dbUrl,
    // Require SSL in production to prevent man-in-the-middle attacks
    ssl: index_1.config.env === 'production' && process.env.DB_REQUIRE_SSL !== 'false' ? { rejectUnauthorized: true } : false,
    max: 20, // Max clients in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
pool.on('error', (err, client) => {
    // Log unexpected errors on idle clients
    console.error('Unexpected error on idle database client', err);
});
exports.default = pool;
//# sourceMappingURL=database.js.map