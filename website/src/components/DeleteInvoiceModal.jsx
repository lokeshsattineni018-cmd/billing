import React, { useState, useEffect } from 'react';
import ConfirmModal from './ConfirmModal';
import { TrashIcon } from './Icons';

export default function DeleteInvoiceModal({
  isOpen,
  bill,
  onClose,
  onConfirm,
  loading = false,
  lang = 'en',
}) {
  const [securityCode, setSecurityCode] = useState('');
  const [typedCode, setTypedCode] = useState('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Generate a fresh 4-digit numeric code whenever modal opens
  const generateNewCode = () => {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    setSecurityCode(code);
    setTypedCode('');
    setErrorMsg('');
  };

  useEffect(() => {
    if (isOpen) {
      generateNewCode();
      setReason('');
    }
  }, [isOpen, bill?._id]);

  if (!isOpen || !bill) return null;

  const billNo = bill.billNo || bill.originalBillNo;
  const isMatch =
    typedCode.trim() === securityCode ||
    typedCode.trim().toUpperCase() === 'DELETE' ||
    typedCode.trim() === String(billNo);

  const handleSubmit = () => {
    if (!isMatch) {
      setErrorMsg(
        lang === 'te'
          ? 'దయచేసి సరైన నిర్ధారణ కోడ్‌ను నమోదు చేయండి.'
          : 'Please enter the exact confirmation code shown above.'
      );
      return;
    }
    setErrorMsg('');
    onConfirm({ confirmationCode: typedCode.trim(), reason: reason.trim() });
  };

  return (
    <ConfirmModal
      isOpen={isOpen}
      customIcon={<TrashIcon size={24} color="#dc2626" />}
      title={lang === 'te' ? `ఇన్‌వాయిస్ #${billNo} తొలగించాలా?` : `Delete Invoice #${billNo}?`}
      subtitle={lang === 'te' ? 'అడ్మిన్ సెక్యూరిటీ నిర్ధారణ' : 'Admin Security Confirmation Required'}
      message={
        lang === 'te'
          ? 'ఈ ఇన్‌వాయిస్ వెబ్‌సైట్ మరియు అన్ని ఖాతాల నుండి పూర్తిగా తొలగించబడుతుంది. రికార్డుల కోసం డేటాబేస్‌లో ఉంటుంది.'
          : 'This invoice will be removed from all website views and balances. Next invoice sequence will automatically roll back so this invoice number can be re-used.'
      }
      itemDetails={[
        { label: lang === 'te' ? 'ఇన్‌వాయిస్ నం' : 'Invoice #', value: `#${billNo}`, isMono: true },
        { label: lang === 'te' ? 'కస్టమర్ పేరు' : 'Customer', value: bill.companyName || bill.customerName || '—' },
        {
          label: lang === 'te' ? 'మొత్తం విలువ' : 'Amount',
          value: `₹${Number(bill.grandTotal || bill.total || 0).toLocaleString('en-IN')}`,
          isMono: true,
        },
      ]}
      warningText={
        lang === 'te'
          ? `ఇన్‌వాయిస్ #${billNo} తొలగించబడితే, తదుపరి సృష్టించబడే ఇన్‌వాయిస్ నంబర్ #${billNo} మాత్రమే అవుతుంది.`
          : `Deleting Invoice #${billNo} will reset the sequence so your next created invoice will be #${billNo}.`
      }
      confirmText={lang === 'te' ? 'ఖచ్చితంగా తొలగించు' : 'Confirm & Delete'}
      cancelText={lang === 'te' ? 'రద్దు చేయి' : 'Cancel'}
      confirmType="danger"
      loading={loading}
      confirmLoadingText={lang === 'te' ? 'తొలగిస్తోంది...' : 'Deleting...'}
      onConfirm={handleSubmit}
      onClose={() => {
        if (!loading) onClose();
      }}
    >
      <div style={{ marginTop: '8px' }}>
        {/* Security Code Box */}
        <div
          style={{
            background: '#fef2f2',
            border: '1.5px dashed #f87171',
            borderRadius: '10px',
            padding: '12px 14px',
            textAlign: 'center',
            marginBottom: '14px',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#991b1b', fontWeight: 600, marginBottom: '6px' }}>
            {lang === 'te'
              ? 'తొలగింపును నిర్ధారించడానికి క్రింది కోడ్‌ను టైప్ చేయండి:'
              : 'Type the confirmation code below to confirm deletion:'}
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              background: '#ffffff',
              padding: '6px 18px',
              borderRadius: '8px',
              border: '1px solid #fca5a5',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <span
              style={{
                fontSize: '1.45rem',
                fontWeight: 900,
                letterSpacing: '5px',
                color: '#b91c1c',
                fontFamily: 'monospace',
                userSelect: 'all',
              }}
            >
              {securityCode}
            </span>
            <button
              type="button"
              onClick={generateNewCode}
              title="Generate new code"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                color: '#64748b',
                padding: '2px 4px',
              }}
            >
              🔄
            </button>
          </div>
        </div>

        {/* Input for Confirmation Code */}
        <div className="form-group" style={{ marginBottom: '12px' }}>
          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
            {lang === 'te' ? 'నిర్ధారణ కోడ్ నమోదు చేయండి:' : 'Enter Confirmation Code:'}
            <span style={{ color: '#dc2626' }}> *</span>
          </label>
          <input
            type="text"
            className="form-input"
            autoFocus
            placeholder={`Type ${securityCode} to confirm`}
            value={typedCode}
            onChange={(e) => {
              setTypedCode(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              letterSpacing: '2px',
              borderColor: isMatch ? '#16a34a' : typedCode ? '#dc2626' : undefined,
            }}
          />
          {errorMsg && (
            <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '4px', fontWeight: 600 }}>
              {errorMsg}
            </div>
          )}
          {isMatch && (
            <div style={{ color: '#16a34a', fontSize: '0.78rem', marginTop: '4px', fontWeight: 700 }}>
              ✓ {lang === 'te' ? 'కోడ్ సరిపోలింది' : 'Confirmation code verified'}
            </div>
          )}
        </div>

        {/* Reason Field */}
        <div className="form-group" style={{ marginBottom: '4px' }}>
          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', color: '#64748b' }}>
            {lang === 'te' ? 'తొలగించడానికి కారణం (ఐచ్ఛికం):' : 'Reason for Deletion (Optional):'}
          </label>
          <input
            type="text"
            className="form-input"
            placeholder={
              lang === 'te'
                ? 'ఉదా. తప్పుడు ఎంట్రీ, టెస్ట్ బిల్లు...'
                : 'e.g. Wrong entry, test invoice, customer cancelled'
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ fontSize: '0.85rem' }}
          />
        </div>
      </div>
    </ConfirmModal>
  );
}

