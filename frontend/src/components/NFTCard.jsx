import { useTranslation } from 'react-i18next';
import CopyButton from './CopyButton';
import NFTCardSkeleton from './NFTCardSkeleton';
import { exportCertificate } from '../utils/certificate';

export default function NFTCard({ record, patientWallet, onClick, loading = false }) {
  const { t } = useTranslation();

  if (loading) return <NFTCardSkeleton count={1} />;

  return (
    <div
      data-testid="nft-card"
      aria-label={`Vaccination record: ${record.vaccine_name}`}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 12,
        padding: '1.25rem',
        marginBottom: '1rem',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        width: '100%',
        boxSizing: 'border-box',
        minWidth: 0,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#38bdf8')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#334155')}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#38bdf8', minWidth: 0, wordBreak: 'break-word' }}>
          💉 {record.vaccine_name}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {record.dose_number == null && record.dose_series != null && (
            <span style={{ fontSize: '0.72rem', color: '#93c5fd' }}>{record.dose_series}-dose series</span>
          )}
          {record.dose_number != null && (
            <span
              role="img"
              aria-label={`Dose ${record.dose_number}${record.dose_series != null ? ` of ${record.dose_series}` : ''}`}
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.15rem 0.5rem',
                borderRadius: 99,
                background: record.dose_series != null && record.dose_number >= record.dose_series
                  ? '#166534'
                  : '#1e3a5f',
                color: record.dose_series != null && record.dose_number >= record.dose_series
                  ? '#86efac'
                  : '#93c5fd',
                whiteSpace: 'nowrap',
              }}
            >
              {record.dose_series != null
                ? `${record.dose_number}/${record.dose_series} doses`
                : `Dose ${record.dose_number}`}
            </span>
          )}
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center' }} aria-label={`Token ID ${record.token_id}`}>
            #{record.token_id}
            <CopyButton text={String(record.token_id)} label="token ID" />
          </span>
        </div>
      </div>
      <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
        Date: {record.date_administered}
      </p>
      <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem' }}>
        Issuer: {record.issuer?.slice(0, 8)}…{record.issuer?.slice(-4)}
      </p>
      <button
        aria-label={`Export certificate for ${record.vaccine_name}`}
        onClick={(e) => { e.stopPropagation(); exportCertificate(record, patientWallet); }}
        style={{
          marginTop: '0.75rem',
          padding: '0.35rem 0.85rem',
          fontSize: '0.8rem',
          background: 'transparent',
          border: '1px solid #38bdf8',
          borderRadius: 6,
          color: '#38bdf8',
          cursor: 'pointer',
        }}
      >
        📄 {t('exportCertificate', 'Export Certificate')}
      </button>
    </div>
  );
}
