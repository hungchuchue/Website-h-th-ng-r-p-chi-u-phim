"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadOptionalModule = loadOptionalModule;
const node_path_1 = __importDefault(require("node:path"));
const logger_1 = require("./logger");
// A missing optional feature does not prevent the auth base from starting.
// Errors inside a present module are propagated rather than silently ignored.
function loadOptionalModule(modulePath, directory) {
    let resolved;
    try {
        resolved = require.resolve(node_path_1.default.resolve(directory, modulePath));
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') {
            logger_1.logger.info('Optional module is not installed; its integration is preserved.', { module: modulePath });
            return undefined;
        }
        throw error;
    }
    return require(resolved);
}
//# sourceMappingURL=optionalModule.js.map