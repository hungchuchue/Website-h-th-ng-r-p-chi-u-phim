"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const database_1 = __importDefault(require("./src/config/database"));
const config_1 = require("./src/config");
const PORT = config_1.config.port;
const HOST = config_1.config.host;
async function startServer() {
    try {
        // Test database connection
        const client = await database_1.default.connect();
        try {
            console.log('[System] Connected to PostgreSQL successfully.');
        }
        finally {
            client.release();
        }
        const server = app_1.default.listen(PORT, HOST, (error) => {
            if (error)
                return;
            console.log(`[System] API Server running on port ${PORT} in ${config_1.config.env} mode.`);
            console.log(`listening on http://${HOST}:${PORT}`);
            console.log(`test api on http://${HOST}:${PORT}/api-docs`);
        });
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`[System] Port ${PORT} is already in use. Stop the existing backend process before starting another one.`);
            }
            else {
                // [DISABLED LOG] Không in toàn bộ lỗi hệ thống.
                // console.error('[System] HTTP server failed:', error);
                console.error('[System] HTTP server failed:', { code: error.code || 'UNKNOWN' });
            }
            database_1.default.end(() => process.exit(1));
        });
        // Handle graceful shutdowns
        const shutdown = () => {
            console.log('\n[System] Gracefully shutting down...');
            server.close(() => {
                console.log('[System] Server closed.');
                database_1.default.end(() => {
                    console.log('[System] Database connections closed.');
                    process.exit(0);
                });
            });
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }
    catch (error) {
        // [DISABLED LOG] Không in toàn bộ lỗi kết nối cơ sở dữ liệu.
        // console.error('[System] Failed to start server:', error);
        const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'UNKNOWN';
        console.error('[System] Failed to start server:', { code });
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map