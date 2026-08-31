import { useState, useEffect } from 'react';
import { billsAPI } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';

export default function PaymentModal({ billId, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [billData, setBillData] = useState(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (billId) {
      loadBillPayments();
    }
  }, [billId]);

  const loadBillPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await billsAPI.getPayments(billId);
      setBillData(res.data);
      setAmount(res.data.balanceDue > 0 ? String(res.data.balanceDue) : '');
    } catch (err) {
      console.error('Failed to load bill payments:', err);
      setError('Failed to load invoice payment details.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayFull = () => {
    if (billData?.balanceDue) {
      setAmount(String(billData.balanceDue));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setError('Please enter a valid positive payment amount.');
      return;
    }

    if (billData && numAmt > billData.balanceDue + 0.01) {
      setError(`Payment amount cannot exceed remaining balance of ${formatCurrency(billData.balanceDue)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await billsAPI.recordPayment(billId, {
        amount: numAmt,
        mode,
        reference,
        notes,
        date,
      });
      if (onSuccess) {
        onSuccess(res.data.message);
      }
      onClose();
    } catch (err) {
      console.error('Record payment error:', err);
      setError(err.response?.data?.message || 'Failed to record payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
              Record Payment
            </h3>
            {billData && (
              <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Invoice #{billData.billNo} • {billData.companyName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}
          >
            ×
          </button>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#991b1b',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="spinner" style={{ minHeight: '180px' }}></div>
        ) : billData ? (
          <div>
            {/* Balance Overview Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '18px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Total Bill
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                  {formatCurrency(billData.total)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Paid So Far
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                  {formatCurrency(billData.paidAmount)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>
                  Balance Due
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#d97706', marginTop: '2px' }}>
                  {formatCurrency(billData.balanceDue)}
                </div>
              </div>
            </div>

            {/* Payment Input Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                    Payment Amount (INR):
                  </label>
                  {billData.balanceDue > 0 && (
                    <button
                      type="button"
                      onClick={handlePayFull}
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#0b5394',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Pay Full ({formatCurrency(billData.balanceDue)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Enter amount paid"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="any"
                  min="1"
                  max={billData.balanceDue}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Payment Mode:
                  </label>
                  <select
                    className="form-input"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI (PhonePe / GPay)</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Payment Date:
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Reference / UTR / Cheque No. (Optional):
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. UTR12345678 or Cheque #4521"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Notes / Remarks (Optional):
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Received via PhonePe from buyer"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || billData.balanceDue <= 0}
                  style={{
                    flex: 1,
                    fontWeight: 800,
                    padding: '12px',
                    background: '#0b5394',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                  }}
                >
                  {submitting ? 'Saving Payment...' : `Save Payment of ${amount ? formatCurrency(parseFloat(amount) || 0) : ''}`}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onClose}
                  style={{ padding: '12px 16px', color: '#64748b' }}
                >
                  Cancel
                </button>
              </div>
            </form>

            {/* Payment History Ledger */}
            {billData.payments && billData.payments.length > 0 && (
              <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                  Payment History on this Invoice
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {billData.payments.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, color: '#16a34a' }}>
                          + {formatCurrency(p.amount)} ({p.mode})
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                          {formatDate(p.date)} {p.reference ? `• Ref: ${p.reference}` : ''}
                        </div>
                      </div>
                      <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                        Recorded
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
