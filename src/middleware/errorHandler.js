/**
 * Centralized error handling middleware
 */
function errorHandler(err, req, res, next) {
  // Log server errors for internal monitoring
  if (!err.isOperational) {
    console.error(`[UNHANDLED ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  const statusCode = err.statusCode || (err.status ? err.status : 500);

  // Avoid leaking database internal structure or stack traces in production
  let message = err.message || 'An unexpected internal server error occurred.';

  // MongoDB duplicate key error handling
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'A duplicate record already exists with the provided details.',
    });
  }

  return res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || undefined,
  });
}

module.exports = errorHandler;
