/**
 * Middleware untuk cek apakah user sudah login
 */
export function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized' });
}

/**
 * Middleware untuk cek apakah user adalah admin
 */
export function isAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden: Admin only' });
}
