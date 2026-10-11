const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const feedbackRoutes = require('./routes/feedback');
const analyticsRoutes = require('./routes/analytics');
const errorHandler = require('./middleware/errorHandler');

// ---------------------------------------------------------------------------
// Fail fast when required secrets/configuration are missing instead of
// crashing later with an obscure error.
// ---------------------------------------------------------------------------
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
if (process.env.NODE_ENV !== 'test') {
  const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missingEnv.length > 0) {
    console.error(
      `Missing required environment variable(s): ${missingEnv.join(', ')}. ` +
        'Copy .env.example to .env and fill in the values before starting the server.'
    );
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 5000;

// ---------------------------------------------------------------------------
// CORS: restrict cross-origin requests to explicitly allowed origins only.
// Origins come from CORS_ORIGIN (comma-separated). When unset, fall back to
// the local development frontend origins. Requests without an Origin header
// (curl, server-to-server, health checks) are always allowed.
// ---------------------------------------------------------------------------
const DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_CORS_ORIGINS;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      const err = new Error(`Origin ${origin} is not allowed by CORS`);
      err.statusCode = 403;
      return callback(err);
    },
  })
);

// Security headers
app.use(helmet());

// Parse incoming JSON payloads
app.use(express.json({ limit: '1mb' }));

// Rate limiter for authentication attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes' },
});

// Rate limiter for public feedback submissions
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Limit each IP to 60 submissions per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many feedback submissions from this IP, please try again later' },
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes with rate limiters where appropriate
app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRoutes);

app.use('/api/feedback', (req, res, next) => {
  if (req.method === 'POST') {
    return feedbackLimiter(req, res, next);
  }
  next();
});
app.use('/api/feedback', feedbackRoutes);

app.use('/api/analytics', analyticsRoutes);

// Fallback 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Central error handler
app.use(errorHandler);

// Start server if executed directly
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
  server.on('error', (err) => {
    console.error(`Failed to start server on port ${PORT}:`, err.message);
  });
}

module.exports = app;
