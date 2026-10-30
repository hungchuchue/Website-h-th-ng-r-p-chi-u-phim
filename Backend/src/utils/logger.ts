export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;

  constructor(statusCode: number, errorCode: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const logger = {
  info: (message: string, meta?: any) => {
    // if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'info') {
    console.log(`[INFO] ${message}`, meta ? meta : '');
    // }
  },
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
      // Masking sensitive data if we were logging full requests
      if (meta && typeof meta === 'object') {
        const sanitizedMeta = { ...meta };
        if (sanitizedMeta.password) sanitizedMeta.password = '***';
        if (sanitizedMeta.token) sanitizedMeta.token = '***';
        if (sanitizedMeta.purchaseToken) sanitizedMeta.purchaseToken = '***';
        if (sanitizedMeta.privateKey) sanitizedMeta.privateKey = '***';
        console.log(`[DEBUG] ${message}`, sanitizedMeta);
      } else {
        console.log(`[DEBUG] ${message}`, meta ? meta : '');
      }
    }
  },
  error: (message: string, meta?: any) => {
    // Always log errors, even on production
    console.error(`[ERROR] ${message}`, meta ? meta : '');
  }
};
