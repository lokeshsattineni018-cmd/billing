import React from 'react';
import { TrashIcon } from './Icons';

export default function ConfirmModal({
  isOpen,
  title = 'Delete Entry?',
  subtitle = 'Confirmation Required',
  message = 'Are you sure you want to delete this record? This action cannot be undone.',
  itemDetails = null,
  confirmText = 'Yes, Delete',
  cancelText = 'Cancel',
  confirmType = 'danger', // 'danger' | 'warning' | 'primary'
  loading = false,
  confirmLoadingText = 'Processing...',
  customIcon = null,
  warningText = 'This action is permanent and will update all corresponding accounts and balances immediately.',
  children = null,
  onConfirm,
  onClose,
}) {
  if (!isOpen) return null;

  const isDanger = confirmType === 'danger';
  const iconBg = isDanger ? '#fee2e2' : '#fef3c7';
  const iconColor = isDanger ? '#dc2626' : '#d97706';
  const btnBg = isDanger ? '#dc2626' : '#d97706';

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onClose}>
      <div
        className="modal-content fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', padding: '24px' }}
      >
        {/* Header with Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '1.25rem',
            }}
          >
            {customIcon || <TrashIcon size={22} color={iconColor} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: '#0f172a' }}>
              {title}
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              {subtitle}
            </span>
          </div>
        </div>

        {/* Message */}
        <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: '1.5', margin: '0 0 16px 0' }}>
          {message}
        </p>

        {/* Optional Item Details Card */}
        {itemDetails && (
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
            {itemDetails.map((detail, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.84rem',
                }}
              >
                <span style={{ color: '#64748b', fontWeight: 600 }}>{detail.label}:</span>
                <span style={{ color: '#0f172a', fontWeight: 700, fontFamily: detail.isMono ? 'monospace' : 'inherit' }}>
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Optional Custom Children (e.g. input fields, reason for voiding, notes) */}
        {children && (
          <div style={{ marginBottom: '16px' }}>
            {children}
          </div>
        )}

        {/* Warning Banner */}
        {warningText && (
          <div
            style={{
              background: isDanger ? '#fff5f5' : '#fffbeb',
              border: `1px solid ${isDanger ? '#fecaca' : '#fde68a'}`,
              borderRadius: '8px',
              padding: '10px 12px',
              marginBottom: '20px',
              fontSize: '0.8rem',
              color: isDanger ? '#991b1b' : '#92400e',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              lineHeight: '1.4',
            }}
          >
            <span>⚠️</span>
            <span>{warningText}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
            style={{ fontWeight: 700, padding: '9px 18px', fontSize: '0.88rem' }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="btn"
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: btnBg,
              color: '#ffffff',
              fontWeight: 800,
              padding: '9px 20px',
              fontSize: '0.88rem',
              border: 'none',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: isDanger ? '0 2px 8px rgba(220, 38, 38, 0.25)' : '0 2px 8px rgba(217, 119, 6, 0.25)',
            }}
          >
            {loading ? (
              <>
                <span className="btn-spinner" style={{ width: '14px', height: '14px' }}></span>
                <span>{confirmLoadingText}</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
