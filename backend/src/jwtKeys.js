/**
 * jwtKeys — JWT signing/verification key material with rotation support (#47).
 *
 * Keys are identified by a `kid`. The current key signs new tokens. A small
 * set of previously-valid keys is kept for verification during a rotation
 * overlap window so tokens issued before rotation remain verifiable. Keys
 * older than `KEY_ROTATION_MAX_AGE_MS` are rejected as retired.
 *
 * Required env vars:
 *   JWT_SECRET        — current signing secret (base64 or raw string)
 *   JWT_KID           — key id for the current secret (defaults to 'v1')
 *   JWT_PREVIOUS_SECRETS — optional JSON array of {kid, secret} previous keys
 *   JWT_ISSUER        — `iss` claim (defaults to HOME_DOMAIN or 'localhost')
 *   JWT_AUDIENCE      — `aud` claim (required for verification)
 *   KEY_ROTATION_MAX_AGE_MS — max age (ms) a verification key is trusted (default 7 days)
 */

const now = () => Date.now();

function parsePreviousSecrets(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((k) => k && k.kid && k.secret);
  } catch (_) {
    return [];
  }
}

const CURRENT_KID = process.env.JWT_KID || 'v1';
const CURRENT_SECRET = process.env.JWT_SECRET || '';
const ISSUER = process.env.JWT_ISSUER || process.env.HOME_DOMAIN || 'localhost';
const AUDIENCE = process.env.JWT_AUDIENCE || '';
const MAX_AGE_MS = Number(process.env.KEY_ROTATION_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000;

const CURRENT_CREATED_AT = Number(process.env.JWT_CURRENT_KEY_ISSUED_AT) || Date.now();

const previousKeys = parsePreviousSecrets(process.env.JWT_PREVIOUS_SECRETS).map((k) => ({
  kid: k.kid,
  secret: k.secret,
  createdAt: Number(k.createdAt) || CURRENT_CREATED_AT,
}));

const currentKey = {
  kid: CURRENT_KID,
  secret: CURRENT_SECRET,
  createdAt: CURRENT_CREATED_AT,
};

/** The key used to sign newly issued JWTs. */
function getSigningKey() {
  return { ...currentKey };
}

/** All keys trusted to verify incoming JWTs (current + valid previous). */
function getVerificationKeys() {
  const cutoff = now() - MAX_AGE_MS;
  const validPrevious = previousKeys.filter((k) => k.createdAt >= cutoff);
  return [currentKey, ...validPrevious];
}

module.exports = {
  getSigningKey,
  getVerificationKeys,
  ISSUER,
  AUDIENCE,
  CURRENT_KID,
  MAX_AGE_MS,
};
