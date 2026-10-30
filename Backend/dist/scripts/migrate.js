"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const logger_1 = require("../utils/logger");
async function main() {
    const migrations = (await (0, promises_1.readdir)(node_path_1.default.resolve(__dirname, '../../migrations'))).filter(file => file.endsWith('.sql'));
    if (migrations.length === 0) {
        logger_1.logger.info('No SQL migrations are present. The current environment-based admin auth does not require a users table.');
        return;
    }
    // Do not apply unknown application SQL or recreate the previous auth schema automatically.
    logger_1.logger.error('SQL files are present. Configure the migration runner for their schema before applying them.');
    process.exitCode = 1;
}
void main().catch(() => { logger_1.logger.error('Unable to inspect the migrations directory.'); process.exitCode = 1; });
//# sourceMappingURL=migrate.js.map