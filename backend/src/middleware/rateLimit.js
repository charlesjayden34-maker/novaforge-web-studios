const rateLimit = require('express-rate-limit');

const standardHeaders = true;
const legacyHeaders = false;

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders,
  legacyHeaders,
  message: { error: 'Too many requests. Please try again soon.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders,
  legacyHeaders,
  message: { error: 'Too many auth attempts. Please wait and retry.' }
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders,
  legacyHeaders,
  message: { error: 'Too many reset attempts. Please wait before trying again.' }
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders,
  legacyHeaders,
  message: { error: 'Too many password reset requests. Please wait before trying again.' }
});

const requestCreateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders,
  legacyHeaders,
  message: { error: 'Too many submissions. Please wait and retry.' }
});

const requestClaimLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders,
  legacyHeaders,
  message: { error: 'Too many account sync requests. Please wait and retry.' }
});

const adminMutationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders,
  legacyHeaders,
  message: { error: 'Too many admin updates. Please slow down and retry.' }
});

module.exports = {
  generalLimiter,
  authLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  requestCreateLimiter,
  requestClaimLimiter,
  adminMutationLimiter
};
