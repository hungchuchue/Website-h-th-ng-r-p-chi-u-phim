"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const errorHandler_1 = require("./src/middleware/errorHandler");
const routes_1 = __importDefault(require("./src/routes"));
const fs_1 = __importDefault(require("fs"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("./src/utils/logger");
const config_1 = require("./src/config");
const app = (0, express_1.default)();
// Trust proxy if behind Cloudflare/Nginx (crucial for rate limits)
app.set('trust proxy', 1);
// swagger
const swaggerPath = path_1.default.join(__dirname, 'src', 'config', 'swagger_output.json');
if (fs_1.default.existsSync(swaggerPath)) {
    const swaggerDocument = JSON.parse(fs_1.default.readFileSync(swaggerPath, 'utf-8'));
    // The local server does not terminate TLS. Swagger must use HTTP in
    // development instead of choosing the first generated HTTPS scheme.
    if (config_1.config.env === 'development') {
        swaggerDocument.schemes = ['http'];
        swaggerDocument.servers = [{ url: `http://localhost:${config_1.config.port}/api/v1`, description: 'Local development' }];
    }
    app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
}
// Security middlewares
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID']
}));
// Body parsers
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});
// Global request logging middleware
app.use((req, res, next) => {
    logger_1.logger.debug(`[API Request] ${req.method} ${req.url}`, req.body);
    next();
});
// Mount all API routes under /api/v1
app.use('/api/v1', routes_1.default);
// Global Error Handler (must be last)
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map