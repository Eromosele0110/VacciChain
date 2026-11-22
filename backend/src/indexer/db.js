/**
 * SQLite-backed event store using sql.js (pure WASM — no native build required).
 * The DB is loaded from disk on init and flushed to disk after every write.
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let dbPath = null;

// Bump when the on-disk schema changes in a backwards-incompatible way.
const SCHEMA_VERSION = 1;

// Tables that must exist for the indexer to serve reads / process events.
const REQUIRED_TABLES = ['events', 'api_keys', 'issuer_applications', 'patient_consent'];

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    event_type  TEXT NOT NULL,
    ledger      INTEGER NOT NULL,
    timestamp   INTEGER NOT NULL,
    contract_id TEXT NOT NULL,
    payload     TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
  CREATE INDEX IF NOT EXISTS idx_events_ledger ON events(ledger);

  CREATE TABLE IF NOT EXISTS api_keys (
    id          TEXT PRIMARY KEY,
    key_hash    TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    revoked     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS patient_consent (
    wallet       TEXT PRIMARY KEY,
    consented_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS issuer_applications (
    id             TEXT PRIMARY KEY,
    wallet         TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL,
    license_number TEXT NOT NULL,
    country        TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    submitted_at   TEXT NOT NULL,
    reviewed_at    TEXT,
    reviewer_note  TEXT
  );

  CREATE TABLE IF NOT EXISTS schema_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

/** Emit an actionable operator alert for a database problem. */
function operatorAlert(message, detail) {
  const line = `[DB ALERT] ${message}${detail ? `: ${detail}` : ''}`;
  console.error(line);
  if (typeof process.emitWarning === 'function') {
    process.emitWarning(line, { code: 'DB_INTEGRITY' });
  }
}

/** Build a structured error for callers (startup / readiness) to surface. */
function integrityError(message, detail) {
  const err = new Error(`Database integrity check failed: ${message}${detail ? ` (${detail})` : ''}`);
  err.code = 'DB_INTEGRITY';
  err.detail = detail;
  return err;
}

/**
 * Verify the database file is accessible, uncorrupted, at the expected schema
 * version, and contains all required tables. Never creates a replacement DB.
 * @param {string} filePath
 * @returns {Promise<{ ok: boolean, version?: number, error?: string }>}
 */
async function checkIntegrity(filePath) {
  if (!filePath) {
    const msg = 'no database path configured';
    operatorAlert(msg);
    return { ok: false, error: msg };
  }

  if (!fs.existsSync(filePath)) {
    const msg = `database file not found at ${filePath}`;
    operatorAlert(msg, 'refusing to initialize an empty replacement database');
    return { ok: false, error: msg };
  }

  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(filePath);
  } catch (err) {
    const msg = `database file is not readable at ${filePath}`;
    operatorAlert(msg, err.message);
    return { ok: false, error: `${msg}: ${err.message}` };
  }

  if (!fileBuffer.length) {
    const msg = `database file is empty at ${filePath}`;
    operatorAlert(msg, 'file may be corrupt; refusing to initialize an empty replacement database');
    return { ok: false, error: msg };
  }

  const SQL = await initSqlJs();
  let probe;
  try {
    probe = new SQL.Database(fileBuffer);
  } catch (err) {
    const msg = `database file is corrupt at ${filePath}`;
    operatorAlert(msg, err.message);
    return { ok: false, error: `${msg}: ${err.message}` };
  }

  try {
    // SQLite-level integrity check.
    const integrity = probe.exec('PRAGMA integrity_check');
    const integrityResult = integrity.length ? integrity[0].values[0][0] : null;
    if (integrityResult !== 'ok') {
      const msg = `integrity_check failed at ${filePath}`;
      operatorAlert(msg, String(integrityResult));
      return { ok: false, error: `${msg}: ${integrityResult}` };
    }

    // Required tables.
    const tablesRes = probe.exec("SELECT name FROM sqlite_master WHERE type = 'table'");
    const tables = tablesRes.length ? tablesRes[0].values.map((row) => row[0]) : [];
    const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t));
    if (missing.length) {
      const msg = `missing required tables at ${filePath}`;
      operatorAlert(msg, missing.join(', '));
      return { ok: false, error: `${msg}: ${missing.join(', ')}` };
    }

    // Schema version.
    let version = null;
    if (tables.includes('schema_meta')) {
      const verRes = probe.exec("SELECT value FROM schema_meta WHERE key = 'schema_version'");
      if (verRes.length && verRes[0].values.length) {
        version = parseInt(verRes[0].values[0][0], 10);
      }
    }
    if (version == null) {
      const msg = `schema version missing at ${filePath}`;
      operatorAlert(msg, `expected schema_version=${SCHEMA_VERSION}`);
      return { ok: false, error: msg };
    }
    if (version !== SCHEMA_VERSION) {
      const msg = `schema version mismatch at ${filePath}`;
      operatorAlert(msg, `found ${version}, expected ${SCHEMA_VERSION}`);
      return { ok: false, error: `${msg}: found ${version}, expected ${SCHEMA_VERSION}` };
    }

    return { ok: true, version };
  } catch (err) {
    const msg = `integrity check errored at ${filePath}`;
    operatorAlert(msg, err.message);
    return { ok: false, error: `${msg}: ${err.message}` };
  } finally {
    try { probe.close(); } catch (_) { /* ignore */ }
  }
}

/** Persist in-memory DB to disk. */
function flush() {
  if (!db || !dbPath) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

/**
 * Initialize (or load) the database.
 * Fails closed on corruption / inaccessibility — never silently creates an
 * empty replacement database over an existing (possibly corrupt) file.
 */
async function initDb(filePath) {
  dbPath = filePath;
  const SQL = await initSqlJs();

  const exists = fs.existsSync(filePath);

  if (exists) {
    // Existing DB: verify integrity before serving reads or processing events.
    const check = await checkIntegrity(filePath);
    if (!check.ok) {
      throw integrityError(check.error || 'unknown integrity failure', filePath);
    }
    const fileBuffer = fs.readFileSync(filePath);
    try {
      db = new SQL.Database(fileBuffer);
    } catch (err) {
      operatorAlert(`failed to open database at ${filePath}`, err.message);
      throw integrityError('failed to open database', err.message);
    }
  } else {
    // First run: create a fresh database and record the schema version.
    db = new SQL.Database();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  db.run(SCHEMA);
  db.run(
    "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', ?)",
    [String(SCHEMA_VERSION)]
  );
  flush();
  return db;
}

/**
 * Upsert a batch of events. Deduplicates by id (PRIMARY KEY conflict = ignore).
 * @param {Array<{id, event_type, ledger, timestamp, contract_id, payload}>} events
 */
function upsertEvents(events) {
  if (!events.length) return;
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO events (id, event_type, ledger, timestamp, contract_id, payload) VALUES (?,?,?,?,?,?)'
  );
  for (const e of events) {
    stmt.run([e.id, e.event_type, e.ledger, e.timestamp, e.contract_id, JSON.stringify(e.payload)]);
  }
  stmt.free();
  flush();
}

/**
 * Query events with optional filters.
 * @param {{ event_type?: string, limit?: number, offset?: number }} opts
 */
function queryEvents({ event_type, limit = 100, offset = 0 } = {}) {
  let sql = 'SELECT * FROM events';
  const params = [];
  if (event_type) {
    sql += ' WHERE event_type = ?';
    params.push(event_type);
  }
  sql += ' ORDER BY ledger DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const results = db.exec(sql, params);
  if (!results.length) return [];

  const { columns, values } = results[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    obj.payload = JSON.parse(obj.payload);
    return obj;
  });
}

/** Return the highest ledger sequence we've indexed (0 if none). */
function getLatestLedger() {
  const res = db.exec('SELECT MAX(ledger) as max_ledger FROM events');
  if (!res.length || res[0].values[0][0] == null) return 0;
  return res[0].values[0][0];
}

// ── API key CRUD ──────────────────────────────────────────────────────────────

function insertApiKey({ id, key_hash, label, created_at }) {
  db.run(
    'INSERT INTO api_keys (id, key_hash, label, created_at, revoked) VALUES (?,?,?,?,0)',
    [id, key_hash, label, created_at]
  );
  flush();
}

function getApiKeyByHash(key_hash) {
  const res = db.exec('SELECT * FROM api_keys WHERE key_hash = ?', [key_hash]);
  if (!res.length) return null;
  const { columns, values } = res[0];
  const obj = {};
  columns.forEach((col, i) => { obj[col] = values[0][i]; });
  return obj;
}

function listApiKeys() {
  const res = db.exec('SELECT id, label, created_at, revoked FROM api_keys ORDER BY created_at DESC');
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function revokeApiKey(id) {
  db.run('UPDATE api_keys SET revoked = 1 WHERE id = ?', [id]);
  flush();
}

module.exports = { initDb, checkIntegrity, SCHEMA_VERSION, REQUIRED_TABLES, upsertEvents, queryEvents, getLatestLedger, insertApiKey, getApiKeyByHash, listApiKeys, revokeApiKey, getConsent, recordConsent, hasConsented, insertIssuerApplication, getIssuerApplication, listIssuerApplications, updateIssuerApplicationStatus };

// ── Patient consent ───────────────────────────────────────────────────────────

function recordConsent(wallet) {
  db.run(
    'INSERT OR IGNORE INTO patient_consent (wallet, consented_at) VALUES (?, ?)',
    [wallet, new Date().toISOString()]
  );
  flush();
}

function getConsent(wallet) {
  const res = db.exec('SELECT wallet, consented_at FROM patient_consent WHERE wallet = ?', [wallet]);
  if (!res.length) return null;
  const { columns, values } = res[0];
  const obj = {};
  columns.forEach((col, i) => { obj[col] = values[0][i]; });
  return obj;
}

function hasConsented(wallet) {
  return !!getConsent(wallet);
}

// ── Issuer onboarding applications ───────────────────────────────────────────

function insertIssuerApplication({ id, wallet, name, license_number, country, submitted_at }) {
  db.run(
    `INSERT INTO issuer_applications (id, wallet, name, license_number, country, status, submitted_at)
     VALUES (?,?,?,?,?,'pending',?)`,
    [id, wallet, name, license_number, country, submitted_at]
  );
  flush();
}

function getIssuerApplication(id) {
  const res = db.exec('SELECT * FROM issuer_applications WHERE id = ?', [id]);
  if (!res.length) return null;
  const { columns, values } = res[0];
  const obj = {};
  columns.forEach((col, i) => { obj[col] = values[0][i]; });
  return obj;
}

function listIssuerApplications({ status } = {}) {
  let sql = 'SELECT * FROM issuer_applications';
  const params = [];
  if (status) { sql += ' WHERE status = ?'; params.push(status); }
  sql += ' ORDER BY submitted_at DESC';
  const res = db.exec(sql, params);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function updateIssuerApplicationStatus(id, { status, reviewer_note }) {
  db.run(
    'UPDATE issuer_applications SET status = ?, reviewed_at = ?, reviewer_note = ? WHERE id = ?',
    [status, new Date().toISOString(), reviewer_note || null, id]
  );
  flush();
}
