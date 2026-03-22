const jwt = require('jsonwebtoken');
const { User } = require('../models/User');

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign({ sub: user._id.toString(), role: user.role }, secret, { expiresIn });
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) return res.status(401).json({ error: 'Unauthorized' });

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required');

    const payload = jwt.verify(token, secret);
    const user = await User.findById(payload.sub).select('_id name email role');
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

async function optionalAuth(req, _res, next) {
  req.user = null;
  try {
    const header = req.headers.authorization || '';
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) return next();

    const secret = process.env.JWT_SECRET;
    if (!secret) return next();

    const payload = jwt.verify(token, secret);
    const user = await User.findById(payload.sub).select('_id name email role');
    if (user) req.user = user;
  } catch (_e) {
    // ignore invalid/expired token for public routes
  }
  next();
}

module.exports = { signToken, requireAuth, requireAdmin, optionalAuth };

