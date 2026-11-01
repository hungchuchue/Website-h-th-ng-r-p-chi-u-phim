import app from './app';
import pool from './config/database';
import { config } from './config';
import { startCinemaRuntime, stopCinemaRuntime } from './jobs/cinema.runtime';

const PORT = config.port;
const HOST = config.host;

async function startServer() {
  try {
    // Test database connection
    const client = await pool.connect();
    try {
      console.log('[System] Connected to PostgreSQL successfully.');
    } finally {
      client.release();
    }

    await startCinemaRuntime();

    const server = app.listen(PORT, HOST, (error?: Error) => {
      if (error) return;
      console.log(`[System] API Server running on port ${PORT} in ${config.env} mode.`);
      console.log(`listening on http://${HOST}:${PORT}`);
      console.log(`test api on http://${HOST}:${PORT}/api-docs`);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`[System] Port ${PORT} is already in use. Stop the existing backend process before starting another one.`);
      } else {
        // [DISABLED LOG] Không in toàn bộ lỗi hệ thống.
        // console.error('[System] HTTP server failed:', error);
        console.error('[System] HTTP server failed:', { code: error.code || 'UNKNOWN' });
      }

      void stopCinemaRuntime().finally(() => pool.end(() => process.exit(1)));
    });

    // Handle graceful shutdowns
    const shutdown = () => {
      console.log('\n[System] Gracefully shutting down...');
      server.close(() => {
        console.log('[System] Server closed.');
        void stopCinemaRuntime().finally(() => pool.end(() => {
          console.log('[System] Database connections closed.');
          process.exit(0);
        }));
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    // [DISABLED LOG] Không in toàn bộ lỗi kết nối cơ sở dữ liệu.
    // console.error('[System] Failed to start server:', error);
    const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'UNKNOWN';
    console.error('[System] Failed to start server:', { code });
    process.exit(1);
  }
}

startServer();
