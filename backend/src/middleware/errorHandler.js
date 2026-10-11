const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || err.status || 500;

  if (status >= 500) {
    console.error('Unhandled Error:', err);
  }

  let message = err.message || 'Internal Server Error';

  // Never leak internal error details (SQL, file paths, stack traces) to clients in production.
  if (status === 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal Server Error';
  }

  res.status(status).json({ error: message });
};

module.exports = errorHandler;
