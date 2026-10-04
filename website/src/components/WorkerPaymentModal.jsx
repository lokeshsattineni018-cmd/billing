import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '../utils/helpers';
import { staffAPI } from '../services/api';
import { CheckIcon } from './Icons';

export default function WorkerPaymentModal({
  isOpen,
  entry,
  onClose,
  onSuccess,
}) {
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !entry) return;

    const total = Number(entry.totalAmount) || 0;
    const currentPaid = Number(entry.amountPaid) || (entry.paymentStatus === 'Paid' ? total : 0);
    const balance = Math.max(0, Math.round((total - currentPaid) * 100) / 100);

    // If unpaid or partial, suggest the remaining balance. If already paid, show total amount.
    if (balance > 0) {
      setPayAmount(String(balance));
    } else {
      setPayAmount(String(currentPaid || total));
    }

    setPayMode(entry.paymentMode || 'Cash');
    setPayDate(entry.paymentDate ? entry.paymentDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setPayNotes(entry.notes || '');
    setError('');
  }, [isOpen, entry]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !entry) return null;

  const totalAmount = Number(entry.totalAmount) || 0;
  const currentPaid = Number(entry.amountPaid) || (entry.paymentStatus === 'Paid' ? totalAmount : 0);
  const balanceDue = Math.max(0, Math.round((totalAmount - currentPaid) * 100) / 100);

  const numPaying = parseFloat(payAmount) || 0;
  // If entry was pending: new total paid = numPaying
  // If entry already had some payment and user enters total to pay, let's treat entered amount as the cumulative total paid for this entry
  const resultingPaid = Math.min(totalAmount, Math.max(0, Math.round(numPaying * 100) / 100));
  const resultingRemaining = Math.max(0, Math.round((totalAmount - resultingPaid) * 100) / 100);

  let resultingStatus = 'Pending';
  if (resultingPaid >= totalAmount && totalAmount > 0) {
    resultingStatus = 'Paid';
  } else if (resultingPaid > 0) {
    resultingStatus = 'Partial';
  }

  const handlePayFullBalance = () => {
    setPayAmount(String(totalAmount));
    setError('');
  };

  const handlePayHalf = () => {
    const half = Math.round((totalAmount / 2) * 100) / 100;
    setPayAmount(String(half));
    setError('');
  };

  const handleResetToPending = async () => {
    if (!window.confirm(`Reset wage payment for ${entry.staffName} to Pending (₹0.00)?`)) {
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await staffAPI.togglePayment(entry._id, {
        amountPaid: 0,
        status: 'Pending',
      });
      onSuccess(res.data.entry || { ...entry, amountPaid: 0, paymentStatus: 'Pending', paymentDate: null });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedAmt = parseFloat(payAmount);
    if (isNaN(parsedAmt) || parsedAmt < 0) {
      setError('Please enter a valid non-negative payment amount.');
      return;
    }

    if (parsedAmt > totalAmount + 0.01) {
      setError(`Payment amount cannot exceed total wage of ${formatCurrency(totalAmount)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await staffAPI.togglePayment(entry._id, {
        amountPaid: parsedAmt,
        paymentMode: payMode,
        paymentDate: payDate,
        notes: payNotes,
      });

      const updated = res.data.entry || {
        ...entry,
        amountPaid: parsedAmt,
        paymentStatus: resultingStatus,
        paymentMode: payMode,
        paymentDate: payDate,
        notes: payNotes,
      };

      onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record wage payment');
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
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        overflowY: 'auto',
        padding: '24px 16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0b5394, #083b6f)',
            color: '#ffffff',
            padding: '18px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85, fontWeight: 700 }}>
              Worker Wage Payment
            </div>
            <h3 style={{ margin: '3px 0 0 0', fontSize: '1.25rem', fontWeight: 800 }}>
              {entry.staffName}
            </h3>
            <div style={{ fontSize: '0.78rem', opacity: 0.9, marginTop: '2px' }}>
              📅 {formatDate(entry.date)} &nbsp;•&nbsp; {entry.quantity} kg @ ₹{entry.price}/kg
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#ffffff',
              fontSize: '1.1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* 3 Metric Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            padding: '16px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ background: '#ffffff', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Total Wage
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0b5394', marginTop: '3px' }}>
              {formatCurrency(totalAmount)}
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Already Paid
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#16a34a', marginTop: '3px' }}>
              {formatCurrency(currentPaid)}
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Balance Due
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: balanceDue > 0 ? '#ea580c' : '#16a34a', marginTop: '3px' }}>
              {formatCurrency(balanceDue)}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 22px' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', marginBottom: '16px', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Amount Paying Input */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                Amount Paying Now (₹) *
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handlePayFullBalance}
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: '#eff6ff',
                    color: '#0b5394',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    cursor: 'pointer',
                  }}
                >
                  Pay Full ({formatCurrency(totalAmount)})
                </button>
                {totalAmount > 0 && (
                  <button
                    type="button"
                    onClick={handlePayHalf}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: '#f8fafc',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    50% ({formatCurrency(Math.round(totalAmount / 2))})
                  </button>
                )}
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#64748b', fontSize: '1.1rem' }}>
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                max={totalAmount}
                className="form-input"
                style={{
                  paddingLeft: '32px',
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: '#0b5394',
                  height: '46px',
                }}
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => {
                  setPayAmount(e.target.value);
                  setError('');
                }}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Payment Mode */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
              Payment Mode
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { id: 'Cash', label: '💵 Cash' },
                { id: 'UPI', label: '📱 PhonePe / UPI' },
                { id: 'Bank Transfer', label: '🏦 Bank Transfer' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPayMode(m.id)}
                  style={{
                    padding: '8px 6px',
                    borderRadius: '8px',
                    border: payMode === m.id ? '2px solid #0b5394' : '1px solid #cbd5e1',
                    background: payMode === m.id ? '#eff6ff' : '#ffffff',
                    color: payMode === m.id ? '#0b5394' : '#475569',
                    fontWeight: payMode === m.id ? 800 : 600,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Date */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
              Payment Date
            </label>
            <input
              type="date"
              className="form-input"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              style={{ height: '40px', fontSize: '0.9rem' }}
            />
          </div>

          {/* Notes (Optional) */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>
              Notes / Remarks (Optional)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. advance paid, daily settlement, GooglePay"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              style={{ height: '40px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Status Preview Banner */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background:
                resultingStatus === 'Paid'
                  ? '#ecfdf5'
                  : resultingStatus === 'Partial'
                  ? '#fffbeb'
                  : '#f8fafc',
              border:
                resultingStatus === 'Paid'
                  ? '1px solid #a7f3d0'
                  : resultingStatus === 'Partial'
                  ? '1px solid #fde68a'
                  : '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Resulting Status
              </div>
              <div
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 900,
                  color:
                    resultingStatus === 'Paid'
                      ? '#047857'
                      : resultingStatus === 'Partial'
                      ? '#b45309'
                      : '#64748b',
                  marginTop: '2px',
                }}
              >
                {resultingStatus === 'Paid' && '✓ Full Wage Paid (Settled)'}
                {resultingStatus === 'Partial' && `⚡ Partial Payment (₹${resultingRemaining.toFixed(2)} Remaining Due)`}
                {resultingStatus === 'Pending' && '⏳ Unpaid / Pending'}
              </div>
            </div>
            <span
              className={`badge ${
                resultingStatus === 'Paid'
                  ? 'badge-green'
                  : resultingStatus === 'Partial'
                  ? 'badge-amber'
                  : 'badge-gray'
              }`}
              style={{ fontWeight: 800, fontSize: '0.8rem', padding: '4px 10px' }}
            >
              {resultingStatus}
            </span>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {currentPaid > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: '#ef4444', fontWeight: 700, padding: '8px 12px' }}
                onClick={handleResetToPending}
                disabled={submitting}
              >
                Reset to Pending
              </button>
            )}

            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={submitting}
                style={{ fontWeight: 700 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                }}
              >
                <CheckIcon size={16} />
                <span>{submitting ? 'Saving...' : `Pay ₹${resultingPaid.toFixed(2)}`}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
