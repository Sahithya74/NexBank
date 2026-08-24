'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config/env');
const { verifyConnection, pool } = require('./config/db');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Explicit origin allowlist - no wildcard.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.use(
  '/api',
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.api,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down and try again.' },
    },
  }),
);

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await verifyConnection();
    // eslint-disable-next-line no-console
    console.log(`[nexbank] connected to MySQL database "${config.db.database}"`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[nexbank] could not connect to MySQL:', error.message);
    console.error('[nexbank] check server/.env and run: npm run db:setup');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[nexbank] API listening on http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`[nexbank] ${signal} received, shutting down`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
