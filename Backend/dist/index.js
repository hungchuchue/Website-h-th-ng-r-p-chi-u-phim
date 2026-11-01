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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const app_1 = __importDefault(require("./app"));
const database_1 = __importStar(require("./config/database"));
const taskCleanup_1 = require("./jobs/taskCleanup");
const imageCleanup_1 = require("./jobs/imageCleanup");
const lockscreenPopupCleanup_1 = require("./jobs/lockscreenPopupCleanup");
const PORT = config_1.config.port;
const HOST = config_1.config.host;
async function startServer() {
    try {
        // Test database connection
        const client = await (0, database_1.connectWithRetry)();
        console.log('[System] Connected to PostgreSQL successfully.');
        client.release();
        // Start server
        const server = app_1.default.listen(PORT, HOST, () => {
            console.log(`[System] API Server running on port ${PORT} in ${config_1.config.env} mode.`);
            console.log(`listening on http://${HOST}:${PORT}`);
            console.log(`test api on http://${HOST}:${PORT}/api-docs`);
        });
        // 1. Task Cleanup (stuck pending/running tasks + expired R2 images)
        (0, taskCleanup_1.cleanupTasks)().catch(err => console.error('[Job: cleanupTasks] Error:', err));
        // Every 10 minutes
        setInterval(() => {
            (0, taskCleanup_1.cleanupTasks)().catch(err => console.error('[Job: cleanupTasks] Error:', err));
        }, 10 * 60 * 1000);
        // 2. Orphaned Image Cleanup - Every 24 hours
        setInterval(() => {
            (0, imageCleanup_1.cleanupOrphanedImages)().catch(err => console.error('[Job: cleanupOrphanedImages] Error:', err));
        }, 24 * 60 * 60 * 1000);
        // 3. Lockscreen auto popup cleanup - Every 24 hours
        (0, lockscreenPopupCleanup_1.cleanupLockscreenAutoPopups)().catch(err => console.error('[Job: cleanupLockscreenAutoPopups] Error:', err));
        setInterval(() => {
            (0, lockscreenPopupCleanup_1.cleanupLockscreenAutoPopups)().catch(err => console.error('[Job: cleanupLockscreenAutoPopups] Error:', err));
        }, 24 * 60 * 60 * 1000);
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
        console.error('[System] Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
