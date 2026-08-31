import { useState, useEffect } from 'react';
import { billsAPI } from '../services/api';
import { formatCurrency, useToast } from '../utils/helpers';
import { WhatsAppIcon } from './Icons';

export default function ReminderModal({ billId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customMsg, setCustomMsg] = useState('');
  const [msgMode, setMsgMode] = useState('whatsapp'); // 'whatsapp' | 'sms'
  const { showToast } = useToast();

  useEffect(() => {
    if (billId) {
      loadReminder();
    }
  }, [billId]);

  const loadReminder = async () => {
    setLoading(true);
    try {
      const res = await billsAPI.getReminder(billId);
      setData(res.data);
      setCustomMsg(res.data.whatsappMessage);
    } catch (err) {
      console.error('Failed to load reminder:', err);
      showToast('Failed to load reminder message', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (mode) => {
    setMsgMode(mode);
    if (data) {
      setCustomMsg(mode === 'whatsapp' ? data.whatsappMessage : data.smsMessage);
    }
  };

  const handleSendWhatsApp = () => {
    if (!customMsg) return;
    const phone = (data?.customerPhone || '').replace(/\D/g, '').slice(-10);
    const encoded = encodeURIComponent(customMsg);
    const url = phone
      ? `https://api.whatsapp.com/send?phone=91${phone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
    onClose();
  };

  const handleSendSMS = () => {
    if (!customMsg) return;
    const phone = (data?.customerPhone || '').replace(/\D/g, '').slice(-10);
    const encoded = encodeURIComponent(customMsg);
    // Universal device native SMS URI
    const url = `sms:${phone}?body=${encoded}`;
    window.open(url, '_self');
    onClose();
  };

  const handleCopy = () => {
    if (!customMsg) return;
    navigator.clipboard.writeText(customMsg);
    showToast('Reminder copied to clipboard!', 'success');
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
          borderRadius: '14px',
          padding: '24px',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
              📢 Send Payment Reminder
            </h3>
            {data && (
              <p style={{ margin: '2px 0 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                Invoice #{data.billNo} • {data.companyName} ({formatCurrency(data.amount)})
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

        {loading ? (
          <div className="spinner" style={{ minHeight: '150px' }}></div>
        ) : (
          <div>
            {/* Mode Switcher */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <button
                type="button"
                className={`btn btn-sm ${msgMode === 'whatsapp' ? 'btn-primary' : 'btn-secondary'}`}
                style={msgMode === 'whatsapp' ? { background: '#25D366', borderColor: '#25D366', color: '#ffffff' } : {}}
                onClick={() => handleModeChange('whatsapp')}
              >
                💬 WhatsApp Format
              </button>
              <button
                type="button"
                className={`btn btn-sm ${msgMode === 'sms' ? 'btn-primary' : 'btn-secondary'}`}
                style={msgMode === 'sms' ? { background: '#0b5394', borderColor: '#0b5394', color: '#ffffff' } : {}}
                onClick={() => handleModeChange('sms')}
              >
                📱 SMS Format
              </button>
            </div>

            {/* Recipient phone */}
            <div style={{ marginBottom: '12px', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 700, color: '#475569' }}>Recipient Phone: </span>
              <span style={{ fontWeight: 800, color: '#0b5394' }}>
                {data?.customerPhone ? `+91 ${data.customerPhone}` : '⚠️ No phone number saved on bill'}
              </span>
            </div>

            {/* Editable Message Box */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                Message Preview (Editable):
              </label>
              <textarea
                className="form-input"
                rows={9}
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '0.82rem',
                  lineHeight: '1.4',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {msgMode === 'whatsapp' ? (
                <button
                  type="button"
                  className="btn btn-whatsapp"
                  onClick={handleSendWhatsApp}
                  style={{ flex: 1, fontWeight: 800, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <WhatsAppIcon size={18} color="#ffffff" /> Open in WhatsApp
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSendSMS}
                  style={{ flex: 1, fontWeight: 800, padding: '12px 16px', background: '#0b5394', color: '#ffffff' }}
                >
                  📱 Send via Device SMS
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopy}
                style={{ padding: '12px 16px', fontWeight: 700 }}
              >
                📋 Copy
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                style={{ padding: '12px 14px', color: '#64748b' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
