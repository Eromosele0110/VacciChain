const config = require('./config');
const { getRpcServer } = require('./stellar/soroban');
const logger = require('./logger');
const { getDatabaseIntegrityStatus } = require('./db/integrity');

let sorobanHealthy = true;
let lastProbeAt = null;

function getHealthStatus() {
  const status = sorobanHealthy ? 'ok' : 'degraded';
  const dbIntegrity = getDatabaseIntegrityStatus();
  return {
    status,
    uptime: Number(process.uptime().toFixed(3)),
    database: dbIntegrity.status,
  };
}

function redactProbeError(error) {
  // Only surface a coarse, non-sensitive classification of the failure.
  // Never log raw error messages, codes, or payloads that may contain secrets.
  if (!error) {
    return { reason: 'unknown' };
  }
  return { reason: 'probe_failed' };
}

async function probeSorobanHealth() {
  try {
    await getRpcServer().getHealth();
    sorobanHealthy = true;
  } catch (error) {
    sorobanHealthy = false;
    logger.warn('Soroban health probe failed', redactProbeError(error));
  } finally {
    lastProbeAt = new Date();
  }
}

function startHealthProbe() {
  // Run an initial probe immediately, then refresh at the configured interval.
  probeSorobanHealth().catch((error) => {
    logger.error('Initial Soroban health probe failed', redactProbeError(error));
  });

  const interval = setInterval(() => {
    probeSorobanHealth().catch((error) => {
      logger.error('Soroban health probe failed', redactProbeError(error));
    });
  }, config.HEALTH_POLL_INTERVAL_MS);

  return () => clearInterval(interval);
}

function setSorobanHealthy(value) {
  sorobanHealthy = value;
  lastProbeAt = new Date();
}

module.exports = {
  getHealthStatus,
  startHealthProbe,
  setSorobanHealthy,
  _getLastProbeAt: () => lastProbeAt,
};