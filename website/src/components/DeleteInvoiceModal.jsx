import React, { useState, useEffect } from 'react';
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

  const generateNewCode = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
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
  const isMatch = typedCode.trim() === securityCode;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!isMatch) {
      setErrorMsg(
        lang === 'te'
          ? 'దయచేసి పై నిర్ధారణ కోడ్‌ను సరిగ్గా నమోదు చేయండి.'
          : 'Please enter the exact 6-digit confirmation code shown above.'
      );
      return;
    }
    setErrorMsg('');
    onConfirm({ confirmationCode: typedCode.trim(), reason: reason.trim() });
  };

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onClose}>
      <div
        className="modal-content fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '450px', padding: '24px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TrashIcon size={22} color="#dc2626" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: '#0f172a' }}>
              {lang === 'te' ? `ఇన్‌వాయిస్ #${billNo} తొలగించాలా?` : `Delete Invoice #${billNo}?`}
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              {lang === 'te' ? 'అడ్మిన్ అధీకృత చర్య' : 'Admin Authorized Action — Recoverable from Recycle Bin'}
            </span>
          </div>
        </div>

        {/* Item summary */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>{lang === 'te' ? 'కస్టమర్:' : 'Customer:'}</span>
            <span style={{ color: '#0f172a', fontWeight: 700 }}>
              {bill.companyName || bill.customerName || '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>{lang === 'te' ? 'మొత్తం:' : 'Amount:'}</span>
            <span style={{ color: '#0b5394', fontWeight: 800, fontFamily: 'monospace' }}>
              ₹{Number(bill.grandTotal || bill.total || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Security Code */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label" style={{ margin: 0 }}>
              {lang === 'te' ? '6-అంకెల నిర్ధారణ కోడ్' : 'Confirmation Code'}
              <span style={{ color: '#dc2626' }}> *</span>
            </label>
            <button
              type="button"
              onClick={generateNewCode}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              🔄 {lang === 'te' ? 'కొత్త కోడ్' : 'New code'}
            </button>
          </div>

          {/* Code display — matches the same card style as item summary */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              textAlign: 'center',
              marginBottom: '10px',
            }}
          >
            <span
              style={{
                fontSize: '2rem',
                fontWeight: 900,
                letterSpacing: '10px',
                color: '#0f172a',
                fontFamily: 'monospace',
                userSelect: 'all',
              }}
            >
              {securityCode}
            </span>
          </div>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            className="form-input"
            placeholder={lang === 'te' ? `${securityCode} టైప్ చేయండి` : `Type ${securityCode} to confirm`}
            value={typedCode}
            onChange={(e) => {
              setTypedCode(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            style={{
              textAlign: 'center',
              fontSize: '1.1rem',
              fontWeight: 700,
              letterSpacing: '4px',
              borderColor: isMatch ? '#16a34a' : typedCode.length > 0 ? '#dc2626' : undefined,
            }}
          />

          {errorMsg && (
            <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: '6px 0 0', fontWeight: 600 }}>
              {errorMsg}
            </p>
          )}
          {isMatch && (
            <p style={{ color: '#16a34a', fontSize: '0.8rem', margin: '6px 0 0', fontWeight: 700 }}>
              ✓ {lang === 'te' ? 'కోడ్ సరిపోలింది' : 'Code matched — ready to delete'}
            </p>
          )}
        </div>

        {/* Reason */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">
            {lang === 'te' ? 'తొలగించడానికి కారణం (ఐచ్ఛికం)' : 'Reason for Deletion (Optional)'}
          </label>
          <input
            type="text"
            className="form-input"
            placeholder={lang === 'te' ? 'ఉదా. తప్పుడు ఎంట్రీ...' : 'e.g. Mistake in weights, customer cancelled'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {/* Info notice */}
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '20px',
            fontSize: '0.8rem',
            color: '#92400e',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            lineHeight: '1.4',
          }}
        >
          <span>⚠️</span>
          <span>
            {lang === 'te'
              ? `ఇన్‌వాయిస్ #${billNo} తొలగించబడితే, తదుపరి ఇన్‌వాయిస్ నంబర్ #${billNo} అవుతుంది. అడ్మిన్ రీసైకిల్ బిన్ నుండి తిరిగి పొందవచ్చు.`
              : `Deleting Invoice #${billNo} will reset the sequence so your next created invoice will be #${billNo}. You can restore it from the Admin Recycle Bin.`}
          </span>
        </div>

        {/* Footer buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
            style={{ fontWeight: 700, padding: '9px 18px', fontSize: '0.88rem' }}
          >
            {lang === 'te' ? 'రద్దు' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleSubmit}
            disabled={!isMatch || loading}
            style={{
              background: isMatch ? '#dc2626' : '#cbd5e1',
              color: '#ffffff',
              fontWeight: 800,
              padding: '9px 20px',
              fontSize: '0.88rem',
              border: 'none',
              borderRadius: '8px',
              cursor: isMatch && !loading ? 'pointer' : 'not-allowed',
              boxShadow: isMatch ? '0 2px 8px rgba(220, 38, 38, 0.25)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {loading ? (
              <>
                <span className="btn-spinner" style={{ width: '14px', height: '14px' }}></span>
                <span>{lang === 'te' ? 'తొలగిస్తోంది...' : 'Deleting...'}</span>
              </>
            ) : (
              lang === 'te' ? 'ఖచ్చితంగా తొలగించు' : 'Confirm & Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
