import { useTranslation } from 'react-i18next';
import CopyButton from './CopyButton';
import NFTCardSkeleton from './NFTCardSkeleton';

async function exportCertificate(record) {
  const [{ jsPDF }, QRCode] = await Promise.all([
    import('jspdf'),
    import('qrcode'),
  ]);

  const verifyUrl = `${window.location.origin}/verify?wallet=${encodeURIComponent(record.patient ?? '')}&token=${encodeURIComponent(String(record.token_id ?? ''))}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 128, margin: 1 });

  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text('VacciChain Vaccination Certificate', 105, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.text(`Vaccine: ${record.vaccine_name ?? 'N/A'}`, 20, 45);
  doc.text(`Date Administered: ${record.date_administered ?? 'N/A'}`, 20, 57);
  doc.text(`Issuer: ${record.issuer ? record.issuer.slice(0, 8) + '…' + record.issuer.slice(-4) : 'N/A'}`, 20, 69);
  doc.text(`Token ID: #${record.token_id ?? 'N/A'}`, 20, 81);

  if (record.dose_number != null || record.dose_series != null) {
    doc.setFontSize(12);
    const doseText = record.dose_series != null
      ? `Dose: ${record.dose_number ?? 'N/A'}/${record.dose_series}`
      : `Dose: ${record.dose_number ?? 'N/A'}`;
    doc.text(doseText, 20, 93);
  }

  doc.addImage(qrDataUrl, 'PNG', 150, 40, 40, 40);
  doc.setFontSize(8);
  doc.text('Scan to verify on-chain', 155, 84);

  const safeName = (record.vaccine_name ?? 'vaccination').replace(/\s+/g, '_');
  const datePart = record.date_administered ?? 'unknown';
  doc.save(`VacciChain_${safeName}_${datePart}.pdf`);
}

export default function NFTCard({ record, onClick, loading = false }) {
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
          {record.dose_number != null && (
            <span
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
        onClick={(e) => { e.stopPropagation(); exportCertificate(record); }}
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
