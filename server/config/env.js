'use strict';

require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

if (!isProduction && !process.env.JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('[nexbank] JWT_SECRET is not set - using an insecure development secret');
}

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT || 5000),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nexbank',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'nexbank-development-secret-do-not-use-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    // Credential endpoints are deliberately much tighter than the general API.
    auth: Number(process.env.AUTH_RATE_LIMIT || 20),
    api: Number(process.env.API_RATE_LIMIT || 600),
  },

  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  seedPassword: process.env.SEED_PASSWORD || 'Password@123',

  /** Currency used when a portfolio total is requested without an explicit base. */
  baseCurrency: process.env.BASE_CURRENCY || 'INR',
};

module.exports = config;
