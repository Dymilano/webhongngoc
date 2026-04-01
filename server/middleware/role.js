function requireRole(allowed) {
  const allow = Array.isArray(allowed) ? allowed : [allowed];
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const role = req.user.role;
    if (!role || !allow.includes(role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = { requireRole };

