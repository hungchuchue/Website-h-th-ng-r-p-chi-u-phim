"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
const logger_1 = require("../utils/logger");
var logger_2 = require("../utils/logger");
Object.defineProperty(exports, "AppError", { enumerable: true, get: function () { return logger_2.AppError; } });
const errorHandler = (error, _req, res, next) => {
    if (res.headersSent) {
        next(error);
        return;
    }
    if (error instanceof logger_1.AppError) {
        res.status(error.statusCode).json({ code: error.statusCode, message: error.message, data: null });
        return;
    }
    if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
        res.status(400).json({ code: 400, message: 'Invalid JSON request body.', data: null });
        return;
    }
    logger_1.logger.error('Unhandled request error', { name: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({ code: 500, message: 'An unexpected error occurred.', data: null });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map