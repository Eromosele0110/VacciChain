const jwt = require('jsonwebtoken');
const { getVerificationKeys, ISSUER, AUDIENCE } = require('../jwtKeys');
const { AppError } = require('./errors');

/**
 * Shared JWT verification logic with key rotation and claim validation.
 *
 * Supports key rotation: tries the current key first (matched by `kid` header),
 * then falls back to previous keys so tokens issued before a rotation remain
 * valid during the transition window. Keys older than the rotation cutoff are
 * rejected.
 *
 * Validates required claims (sub, role, wallet, exp) plus issuer (`iss`) and
 * audience (`aud`) so role/wallet identity is never inferred from untrusted
 * client values.
 *
 * @param {string} token - JWT string
 * @returns {Object} decoded payload
 * @throws {AppError} 401 when the token is missing/invalid/expired or claims fail
 */
function verifyAndDecode(token) {
  const keys = getVerificationKeys();
  let decoded = null;
  let lastErr = null;

  let preferredKid = null;
  try {
    const unverified = jwt.decode(token, { complete: true });
    preferredKid = unverified?.header?.kid || null;
  } catch (_) {
    // ignore — we'll try all keys
  }

  const ordered = preferredKid
    ? [...keys].sort((a) => (a.kid === preferredKid ? -1 : 1))
    : keys;

  for (const key of ordered) {
    try {
      decoded = jwt.verify(token, key.secret, {
        issuer: ISSUER,
        audience: AUDIENCE || undefined,
      });
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (!decoded) {
    throw new AppError('unauthorized', 'Invalid or expired token', 401);
  }

  // Validate required claims
  const requiredClaims = ['sub', 'role', 'wallet', 'exp'];
  for (const claim of requiredClaims) {
    if (!decoded[claim]) {
      throw new AppError('unauthorized', `Missing or empty claim: ${claim}`, 401);
    }
  }

  // Validate role value
  if (!['patient', 'issuer'].includes(decoded.role)) {
    throw new AppError('unauthorized', 'Invalid role claim', 401);
  }

  return decoded;
}

/**
 * JWT authentication middleware.
 */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('unauthorized', 'Missing authorization header', 401));
  }

  const token = header.slice(7);

  try {
    req.user = verifyAndDecode(token);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Auth middleware variant that also accepts the 'admin' role.
 * Use only on admin-only routes.
 */
function adminAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('unauthorized', 'Missing authorization header', 401));
  }

  const token = header.slice(7);

  try {
    const decoded = verifyAndDecode(token);
    if (!['patient', 'issuer', 'admin'].includes(decoded.role)) {
      throw new AppError('unauthorized', 'Invalid role claim', 401);
    }
    req.user = decoded;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authMiddleware;
module.exports.adminAuthMiddleware = adminAuthMiddleware;
module.exports.verifyAndDecode = verifyAndDecode;
