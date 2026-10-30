import { Pool } from 'pg';
import { config } from './index';

// Create a connection pool using the provided database URL
const pool = new Pool({
    connectionString: config.dbUrl,
    // Require SSL in production to prevent man-in-the-middle attacks
    ssl: config.env === 'production' && process.env.DB_REQUIRE_SSL !== 'false' ? { rejectUnauthorized: true } : false,
    max: 20, // Max clients in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
    // Log unexpected errors on idle clients
    console.error('Unexpected error on idle database client', err);
});

export default pool;