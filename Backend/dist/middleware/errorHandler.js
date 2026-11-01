"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const errorHandler = (err, req, res, next) => {
    console.error(`[Error] ${err.message}`, err);
    if (err instanceof logger_1.AppError) {
        return res.status(err.statusCode).json({
            code: err.statusCode,
            message: err.message,
            data: null
        });
    }
    // Default 500
    res.status(500).json({
        code: 500,
        message: 'An unexpected error occurred.',
        data: null
    });
};
exports.errorHandler = errorHandler;
