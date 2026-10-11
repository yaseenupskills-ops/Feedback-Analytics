const jwt = require('jsonwebtoken');

/**
 * Authentication + authorization middleware for admin endpoints.
 *
 * 1. Verifies that a valid `Bearer` JWT is present.
 * 2. Rejects tokens that do not carry the `admin` role.
 *
 * Every protected endpoint in this application is admin-only, so both checks
 * live here. `req.user` is populated with the verified token payload.
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token is required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

module.exports = authMiddleware;