"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    errorCode;
    constructor(statusCode, errorCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.AppError = AppError;
exports.logger = {
    info: (message, meta) => {
        // if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'info') {
        console.log(`[INFO] ${message}`, meta ? meta : '');
        // }
    },
    debug: (message, meta) => {
        if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
            // Masking sensitive data if we were logging full requests
            if (meta && typeof meta === 'object') {
                const sanitizedMeta = { ...meta };
                if (sanitizedMeta.password)
                    sanitizedMeta.password = '***';
                if (sanitizedMeta.token)
                    sanitizedMeta.token = '***';
                if (sanitizedMeta.purchaseToken)
                    sanitizedMeta.purchaseToken = '***';
                if (sanitizedMeta.privateKey)
                    sanitizedMeta.privateKey = '***';
                console.log(`[DEBUG] ${message}`, sanitizedMeta);
            }
            else {
                console.log(`[DEBUG] ${message}`, meta ? meta : '');
            }
        }
    },
    error: (message, meta) => {
        // Always log errors, even on production
        console.error(`[ERROR] ${message}`, meta ? meta : '');
    }
};
//# sourceMappingURL=logger.js.map