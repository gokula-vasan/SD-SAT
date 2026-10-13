const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDB, closeDB, getDb } = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');

// Route imports
const authRoutes = require('./src/routes/authRoutes');
const accountRoutes = require('./src/routes/accountRoutes');
const transferRoutes = require('./src/routes/transferRoutes');
const transactionRoutes = require('./src/routes/transactionRoutes');
const beneficiaryRoutes = require('./src/routes/beneficiaryRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware: Helmet with relaxed Content-Security-Policy for split ports & CDNs
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "http://localhost:5000", "http://localhost:3000", "http://127.0.0.1:5000", "http://127.0.0.1:3000"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS support for separate frontend origin
app.use(cors({ origin: true, credentials: true }));

// Request body size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
  },
});
app.use('/api', globalLimiter);

// Specific Auth Rate Limiter to prevent brute-force login/register attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Serve Static Frontend Files from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Health Check Endpoint (Phase 1 Requirement)
app.get('/api/health', (req, res) => {
  let dbStatus = 'disconnected';
  try {
    if (getDb()) dbStatus = 'connected';
  } catch (e) {
    dbStatus = 'uninitialized';
  }

  return res.status(200).json({
    success: true,
    status: 'UP',
    name: 'Digital Banking and Money Transfer System',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

// Mount REST API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Fallback for API 404
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found.`,
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start Server after connecting to Database
let server = null;

async function startServer() {
  try {
    await connectDB();

    // Auto-seed initial demo accounts if database is empty
    const usersCount = await getDb().collection('users').countDocuments();
    if (usersCount === 0) {
      console.log('[INIT] Database is empty. Seeding demo accounts and balances...');
      const seedDatabase = require('./src/utils/seed');
      await seedDatabase();
    }

    server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🏦 Digital Banking & Money Transfer System`);
      console.log(`🚀 Server running on: http://localhost:${PORT}`);
      console.log(`🌐 Frontend UI: http://localhost:${PORT}/index.html`);
      console.log(`🛡️ Admin Portal: http://localhost:${PORT}/admin.html`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully shutting down...`);
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
    });
  }
  await closeDB();
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// If executed directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
