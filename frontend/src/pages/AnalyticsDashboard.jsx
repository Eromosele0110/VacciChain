import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useFreighter';

const ANALYTICS_BASE = import.meta.env.VITE_ANALYTICS_URL || 'http://localhost:8001';
const REFRESH_INTERVAL = 60_000;

const s = {
  page: { maxWidth: 900, width: '100%', margin: '2rem auto', padding: '0 1rem', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' },
  h2: { color: '#e2e8f0', margin: 0 },
  refreshInfo: { color: '#64748b', fontSize: '0.8rem' },
  section: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' },
  sectionTitle: { color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' },
  error: { color: '#f87171', padding: '0.75rem', background: '#1e293b', borderRadius: 8, marginBottom: '1rem' },
  loading: { color: '#64748b', textAlign: 'center', padding: '2rem 0' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: { textAlign: 'left', color: '#64748b', fontWeight: 500, padding: '0.5rem 0.75rem', borderBottom: '1px solid #1e293b' },
  td: { padding: '0.6rem 0.75rem', color: '#e2e8f0', borderBottom: '1px solid #1e293b' },
  badge: (severity) => ({
    display: 'inline-block',
    padding: '0.2rem 0.6rem',
    borderRadius: 4,
    fontSize: '0.75rem',
    fontWeight: 600,
    background: severity === 'high' ? '#7f1d1d' : severity === 'medium' ? '#78350f' : '#1e3a5f',
    color: severity === 'high' ? '#fca5a5' : severity === 'medium' ? '#fcd34d' : '#93c5fd',
  }),
  barTrack: { minWidth: 80, background: '#1e293b', borderRadius: 4, height: 18, overflow: 'hidden' },
  barFill: (pct) => ({ width: `${pct}%`, height: '100%', background: '#0ea5e9', borderRadius: 4, transition: 'width 0.4s ease' }),
  noData: { color: '#475569', textAlign: 'center', padding: '1.5rem 0' },
};

// The service returns { rates: { name: count } }; arrays are accepted too.
function parseRates(body) {
  const rates = body?.rates ?? body;
  if (Array.isArray(rates)) return rates;
  if (!rates || typeof rates !== 'object') throw new Error('bad rates');
  return Object.entries(rates).map(([vaccine_name, count]) => ({ vaccine_name, count }));
}

function parseIssuers(body) {
  const list = body?.issuers ?? body;
  if (!Array.isArray(list)) throw new Error('bad issuers');
  return list.map((i) => ({ ...i, address: i.address ?? i.issuer, count: i.count ?? i.total_issued }));
}

function parseAnomalies(body) {
  const list = body?.anomalies ?? body?.flagged_issuers ?? body;
  if (!Array.isArray(list)) throw new Error('bad anomalies');
  return list.map((a) => ({ ...a, count: a.count ?? a.total_issued }));
}

const SOURCES = {
  rates: parseRates,
  issuers: parseIssuers,
  anomalies: parseAnomalies,
};

const isNumber = (n) => typeof n === 'number' && Number.isFinite(n);
// A missing value is never shown as zero.
const formatCount = (n) => (isNumber(n) ? n.toLocaleString() : 'Not reported');
const shorten = (address) => (address ? `${address.slice(0, 8)}…${address.slice(-6)}` : 'Not reported');

function lastActive(issuer) {
  if (issuer.last_active) return new Date(issuer.last_active).toLocaleString();
  if (issuer.last_ledger) return `Ledger ${issuer.last_ledger}`;
  return 'Not reported';
}

// The table is the textual equivalent of the bars, so both stay in sync.
function CountTable({ caption, headers, rows }) {
  const reported = rows.map((r) => r.count).filter(isNumber);
  const max = Math.max(...reported, 1);
  const total = reported.reduce((a, b) => a + b, 0);
  const missing = rows.length - reported.length;
  return (
    <>
      <p style={s.refreshInfo}>
        Total: {reported.length ? total.toLocaleString() : 'Not reported'} across {rows.length} {rows.length === 1 ? 'row' : 'rows'}.
        {missing > 0 && ` ${missing} not reported.`}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={s.table} aria-label={caption}>
          <thead>
            <tr>{headers.map((h) => <th key={h} scope="col" style={s.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" style={{ ...s.td, textAlign: 'left', fontWeight: 400 }} title={r.title}>{r.label}</th>
                <td style={s.td}>
                  {isNumber(r.count) && (
                    <div style={s.barTrack} role="img" aria-label={`${r.label}: ${r.count} of ${total} doses`}>
                      <div style={s.barFill(Math.round((r.count / max) * 100))} />
                    </div>
                  )}
                </td>
                <td style={s.td}>{formatCount(r.count)}</td>
                {r.extra !== undefined && <td style={s.td}>{r.extra}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RatesChart({ data }) {
  return (
    <CountTable
      caption="Vaccination doses by vaccine type"
      headers={['Vaccine', 'Share', 'Doses']}
      rows={data.map((d) => ({ key: d.vaccine_name, label: d.vaccine_name, count: d.count }))}
    />
  );
}

function IssuerChart({ data }) {
  return (
    <CountTable
      caption="Issuer activity"
      headers={['Issuer', 'Share', 'Volume', 'Last Active']}
      rows={data.map((d, i) => ({ key: d.address ?? i, label: shorten(d.address), title: d.address, count: d.count, extra: lastActive(d) }))}
    />
  );
}

function AnomalyList({ data }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={s.table} aria-label="Anomaly flags">
        <thead>
          <tr>
            {['Issuer', 'Mint Count', 'Severity', 'Reason'].map((h) => <th key={h} scope="col" style={s.th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((a, i) => (
            <tr key={i}>
              <td style={s.td} title={a.issuer}>{shorten(a.issuer)}</td>
              <td style={s.td}>{formatCount(a.count)}</td>
              <td style={s.td}><span style={s.badge(a.severity)}>{a.severity ?? 'medium'}</span></td>
              <td style={s.td}>{a.reason ?? 'Unusual minting volume'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ id, title, source, empty, children }) {
  const { data, failed, updatedAt } = source;
  let body;
  if (data) body = data.length ? children(data) : <p style={s.noData}>{empty}</p>;
  else if (failed) body = <p style={s.noData}>Data unavailable. This does not mean the value is zero.</p>;
  else body = <p style={s.loading} role="status">Loading…</p>;
  return (
    <section style={s.section} aria-labelledby={id}>
      <h3 id={id} style={s.sectionTitle}>{title}</h3>
      {data && failed && (
        <p style={s.error} role="status">Delayed: showing data from {updatedAt.toLocaleTimeString()}.</p>
      )}
      {body}
    </section>
  );
}

const INITIAL = { data: null, failed: false, updatedAt: null };

export default function AnalyticsDashboard() {
  const { role } = useAuth();
  const [sources, setSources] = useState({ rates: INITIAL, issuers: INITIAL, anomalies: INITIAL });

  const fetchAll = useCallback(() => Promise.all(
    Object.entries(SOURCES).map(async ([name, parse]) => {
      let next;
      try {
        const res = await fetch(`${ANALYTICS_BASE}/analytics/${name}`);
        if (res.ok === false) throw new Error(`HTTP ${res.status}`);
        next = { data: parse(await res.json()), failed: false, updatedAt: new Date() };
      } catch {
        // Keep the last good data so it can be shown as delayed.
        next = { failed: true };
      }
      setSources((prev) => ({ ...prev, [name]: { ...prev[name], ...next } }));
    })
  ), []);

  useEffect(() => {
    if (role !== 'issuer') return undefined;
    fetchAll();
    const timer = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchAll, role]);

  if (role !== 'issuer') {
    return (
      <div style={s.page}>
        <p style={{ color: '#f87171' }}>Access restricted to authorized issuers.</p>
      </div>
    );
  }

  const all = Object.values(sources);
  const anyFailed = all.some((x) => x.failed);
  const times = all.map((x) => x.updatedAt).filter(Boolean);
  // The oldest section decides how fresh the page as a whole is.
  const oldest = times.length ? new Date(Math.min(...times)) : null;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.h2}>📊 Analytics Dashboard</h2>
        <span style={s.refreshInfo} aria-live="polite">
          {oldest ? `Last updated: ${oldest.toLocaleTimeString()} · auto-refreshes every 60s` : 'No data loaded yet'}
        </span>
      </div>
      <p style={s.refreshInfo}>Time range: the 500 most recent indexed mints.</p>

      {anyFailed && <p style={s.error} role="alert">⚠️ Some analytics data could not be loaded.</p>}

      <Section id="rates-title" title="Vaccination Rates by Vaccine Type" source={sources.rates} empty="No vaccinations recorded in this range.">
        {(data) => <RatesChart data={data} />}
      </Section>
      <Section id="issuers-title" title="Issuer Activity" source={sources.issuers} empty="No issuers have minted in this range.">
        {(data) => <IssuerChart data={data} />}
      </Section>
      <Section id="anomalies-title" title="Anomaly Flags" source={sources.anomalies} empty="✅ No anomalies detected.">
        {(data) => <AnomalyList data={data} />}
      </Section>
    </div>
  );
}
