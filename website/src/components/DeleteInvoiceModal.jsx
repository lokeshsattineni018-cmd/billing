import React, { useState, useEffect } from 'react';
import { TrashIcon } from './Icons';
import Modal from './Modal';

const DELETE_REASONS = [
  {
    id: 'order_cancelled',
    labelEn: 'Order Cancelled by Customer',
    labelTe: 'కస్టమర్ ఆర్డర్ రద్దు చేశారు',
  },
  {
    id: 'entry_mistake',
    labelEn: 'Mistake in Rate, Weight or Counts',
    labelTe: 'రేటు, బరువు లేదా కౌంట్లలో తప్పు నమోదు',
  },
  {
    id: 'duplicate_bill',
    labelEn: 'Duplicate Invoice Entry',
    labelTe: 'డూప్లికేట్ బిల్లు ఎంట్రీ',
  },
  {
    id: 'customer_change',
    labelEn: 'Wrong Customer or Agency Selected',
    labelTe: 'తప్పుడు కస్టమర్ ఎంపిక చేయబడింది',
  },
  {
    id: 'other',
    labelEn: 'Other Reason',
    labelTe: 'ఇతర కారణం',
  },
];

export default function DeleteInvoiceModal({
  isOpen,
  bill,
  onClose,
  onConfirm,
  loading = false,
  lang = 'en',
}) {
  const [step, setStep] = useState(1); // Step 1: Select Reason, Step 2: Confirm Tap
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedReasonId('');
      setCustomReason('');
      setErrorMsg('');
    }
  }, [isOpen, bill?._id]);

  if (!isOpen || !bill) return null;

  const billNo = bill.billNo || bill.originalBillNo;
  const isTe = lang === 'te';

  const getFullReasonText = () => {
    const found = DELETE_REASONS.find((r) => r.id === selectedReasonId);
    if (!found) return '';
    const mainText = isTe ? found.labelTe : found.labelEn;
    if (selectedReasonId === 'other' && customReason.trim()) {
      return `${mainText}: ${customReason.trim()}`;
    }
    return mainText;
  };

  const handleProceedToStep2 = () => {
    if (!selectedReasonId) {
      setErrorMsg(
        isTe
          ? 'దయచేసి తొలగించడానికి ఒక కారణాన్ని ఎంచుకోండి.'
          : 'Please select a reason for deletion from the dropdown.'
      );
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleFinalConfirm = () => {
    const reasonText = getFullReasonText();
    // Send CONFIRMED as the confirmationCode to satisfy server-side validation
    onConfirm({
      confirmationCode: 'CONFIRMED',
      reason: reasonText,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      disableBackdropClose={loading}
      disableEscapeClose={loading}
      maxWidth="460px"
      labelledBy="delete-invoice-modal-title"
      contentStyle={{ padding: '24px' }}
    >
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TrashIcon size={24} color="#dc2626" />
          </div>
          <div>
            <h3 id="delete-invoice-modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              {isTe ? `ఇన్‌వాయిస్ #${billNo} తొలగించాలా?` : `Delete Invoice #${billNo}?`}
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
              {step === 1
                ? isTe
                  ? 'దశ 1/2: కారణాన్ని ఎంచుకోండి'
                  : 'Step 1 of 2: Select Reason'
                : isTe
                ? 'దశ 2/2: తుది నిర్ధారణ'
                : 'Step 2 of 2: Final Confirmation'}
            </span>
          </div>
        </div>

        {/* Invoice Summary Card */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>{isTe ? 'కస్టమర్:' : 'Customer:'}</span>
            <span style={{ color: '#0f172a', fontWeight: 700 }}>
              {bill.companyName || bill.customerName || '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>{isTe ? 'మొత్తం:' : 'Amount:'}</span>
            <span style={{ color: '#0b5394', fontWeight: 800, fontFamily: 'monospace' }}>
              ₹{Number(bill.grandTotal || bill.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* STEP 1: Reason Dropdown */}
        {step === 1 && (
          <div style={{ marginBottom: '18px' }}>
            <label
              className="form-label"
              htmlFor="delete-reason-select"
              style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}
            >
              {isTe ? 'తొలగించడానికి కారణం' : 'Reason for Deletion'}
              <span style={{ color: '#dc2626' }}> *</span>
            </label>
            <select
              id="delete-reason-select"
              className="form-input"
              value={selectedReasonId}
              onChange={(e) => {
                setSelectedReasonId(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              style={{
                fontSize: '0.95rem',
                padding: '12px 14px',
                minHeight: '48px',
                background: '#ffffff',
                borderColor: errorMsg ? '#dc2626' : undefined,
              }}
            >
              <option value="">
                {isTe ? '-- కారణాన్ని ఎంచుకోండి --' : '-- Select a Reason --'}
              </option>
              {DELETE_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {isTe ? `${r.labelTe} (${r.labelEn})` : `${r.labelEn} / ${r.labelTe}`}
                </option>
              ))}
            </select>

            {selectedReasonId === 'other' && (
              <input
                type="text"
                className="form-input"
                placeholder={isTe ? 'వివరాలు నమోదు చేయండి (ఐచ్ఛికం)...' : 'Enter specific details (optional)...'}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                style={{ marginTop: '10px', fontSize: '0.9rem', minHeight: '44px' }}
              />
            )}

            {errorMsg && (
              <p style={{ color: '#dc2626', fontSize: '0.82rem', margin: '8px 0 0', fontWeight: 600 }}>
                {errorMsg}
              </p>
            )}

            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '10px 12px',
                marginTop: '16px',
                fontSize: '0.8rem',
                color: '#92400e',
                lineHeight: '1.4',
              }}
            >
              ℹ️ {isTe
                ? `ఇది సురక్షితమైన సాఫ్ట్-డిలీట్. బిల్లు రీసైకిల్ బిన్‌లో సేవ్ చేయబడుతుంది.`
                : `This is a safe soft-delete. The invoice is archived in the Admin Recycle Bin.`}
            </div>
          </div>
        )}

        {/* STEP 2: Final Confirmation Tap */}
        {step === 2 && (
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                background: '#fef2f2',
                border: '1.5px solid #f87171',
                borderRadius: '10px',
                padding: '16px',
                textAlign: 'center',
                marginBottom: '16px',
              }}
            >
              <p style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 800, color: '#991b1b' }}>
                {isTe ? `ఇన్‌వాయిస్ #${billNo}ను ఖచ్చితంగా తొలగించాలా?` : `Are you sure you want to delete Invoice #${billNo}?`}
              </p>
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#7f1d1d', fontWeight: 600 }}>
                {isTe ? 'కారణం:' : 'Reason:'} <strong>{getFullReasonText()}</strong>
              </p>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0, textAlign: 'center' }}>
              {isTe
                ? 'తొలగించడానికి క్రింది ఎరుపు బటన్‌ను నొక్కండి. అవసరమైతే రీసైకిల్ బిన్ నుండి పునరుద్ధరించవచ్చు.'
                : 'Tap the red button below to finalize deletion. You can restore it later from Recycle Bin.'}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
          {step === 1 ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
                style={{ minHeight: '48px', minWidth: '90px', fontWeight: 700, padding: '10px 18px' }}
              >
                {isTe ? 'రద్దు' : 'Cancel'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleProceedToStep2}
                disabled={!selectedReasonId || loading}
                style={{
                  minHeight: '48px',
                  fontWeight: 800,
                  padding: '10px 22px',
                  background: selectedReasonId ? '#dc2626' : '#cbd5e1',
                  borderColor: selectedReasonId ? '#dc2626' : '#cbd5e1',
                  color: '#ffffff',
                  cursor: selectedReasonId ? 'pointer' : 'not-allowed',
                }}
              >
                  {isTe ? 'ముందుకు వెళ్ళు' : 'Next Step'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  style={{ minHeight: '48px', minWidth: '90px', fontWeight: 600, padding: '10px 18px' }}
                >
                  {isTe ? 'వెనుకకు' : 'Back'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={handleFinalConfirm}
                  disabled={loading}
                  style={{
                    minHeight: '48px',
                    background: '#b42318',
                    color: '#ffffff',
                    fontWeight: 600,
                    padding: '10px 24px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {loading ? (
                    <>
                      <span className="btn-spinner" style={{ width: '16px', height: '16px' }}></span>
                      <span>{isTe ? 'తొలగిస్తోంది...' : 'Deleting...'}</span>
                    </>
                  ) : (
                    <>
                      <TrashIcon size={16} color="#ffffff" />
                      <span>{isTe ? 'ఖచ్చితంగా తొలగించు' : 'Confirm Delete'}</span>
                    </>
                  )}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
