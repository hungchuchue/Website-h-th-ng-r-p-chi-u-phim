import helmet from 'helmet';
import cors from 'cors';
import express from 'express';
import { errorHandler } from './middleware/errorHandler';
import apiRoutes from './routes';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { logger } from './utils/logger';
import { config } from './config';

const app = express();

// Trust proxy if behind Cloudflare/Nginx (crucial for rate limits)
app.set('trust proxy', 1);

// swagger
const swaggerPath = path.join(__dirname, 'config', 'swagger_output.json');
if (fs.existsSync(swaggerPath)) {
  const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf-8'));
  // The local server does not terminate TLS. Swagger must use HTTP in
  // development instead of choosing the first generated HTTPS scheme.
  if (config.env === 'development') swaggerDocument.schemes = ['http'];
 app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Security middlewares
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID']
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// Global request logging middleware
app.use((req, res, next) => {
  logger.debug(`[API Request] ${req.method} ${req.url}`, req.body);
  next();
});

// Mount all API routes under /api/v1
app.use('/api/v1', apiRoutes);

// Global Error Handler (must be last)
app.use(errorHandler);

export default app;
