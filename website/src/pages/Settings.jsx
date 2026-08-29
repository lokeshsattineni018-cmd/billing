import { useState, useEffect } from 'react';
import { settingsAPI } from '../services/api';
import { useToast, Toast } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { LogoutIcon } from '../components/Icons';

export default function Settings() {
  const { logout } = useAuth();
  const { toast, showToast } = useToast();
  const [form, setForm] = useState({
    businessName: '',
    legalName: '',
    address: '',
    phone: '',
    gstin: '',
    bankName: '',
    accountNo: '',
    ifsc: '',
    branch: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await settingsAPI.get();
      setForm({
        businessName: response.data.businessName || '',
        legalName: response.data.legalName || '',
        address: response.data.address || '',
        phone: response.data.phone || '',
        gstin: response.data.gstin || '',
        bankName: response.data.bankName || '',
        accountNo: response.data.accountNo || '',
        ifsc: response.data.ifsc || '',
        branch: response.data.branch || '',
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsAPI.update(form);
      showToast('Settings saved successfully');
    } catch (error) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) return <div className="spinner"></div>;

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      <div className="page-header">
        <h2>Settings</h2>
        <p>Manage your business & bank information — this appears on all invoices</p>
      </div>

      <div className="settings-grid">
        {/* Settings Form */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '18px' }}>Business Details</h3>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Trade / Business Name</label>
              <input
                type="text"
                className="form-input form-input-lg"
                value={form.businessName}
                onChange={(e) => handleChange('businessName', e.target.value)}
                placeholder="e.g. VIJAYA DURGA AGENCIES"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Legal Name / Proprietor</label>
              <input
                type="text"
                className="form-input"
                value={form.legalName}
                onChange={(e) => handleChange('legalName', e.target.value)}
                placeholder="e.g. SATTINENI VENKATA DHANA LAXMI"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Address of Principal Place of Business</label>
              <textarea
                className="form-input"
                rows="3"
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Business address"
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone / Cell Number</label>
              <input
                type="tel"
                className="form-input"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="e.g. 9441429745"
              />
            </div>

            <div className="form-group">
              <label className="form-label">GSTIN (Registration Number)</label>
              <input
                type="text"
                className="form-input"
                value={form.gstin}
                onChange={(e) => handleChange('gstin', e.target.value)}
                placeholder="e.g. 37KATPS1500Q1ZR"
              />
            </div>

            <h3 className="card-title" style={{ margin: '22px 0 14px 0', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              Bank Account Details
            </h3>

            <div className="form-group">
              <label className="form-label">Bank Name</label>
              <input
                type="text"
                className="form-input"
                value={form.bankName}
                onChange={(e) => handleChange('bankName', e.target.value)}
                placeholder="e.g. KARUR VYSYA BANK"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Account Number</label>
              <input
                type="text"
                className="form-input"
                value={form.accountNo}
                onChange={(e) => handleChange('accountNo', e.target.value)}
                placeholder="e.g. 4805135000002964"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">IFSC Code</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.ifsc}
                  onChange={(e) => handleChange('ifsc', e.target.value)}
                  placeholder="e.g. KVBL0004815"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Branch</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.branch}
                  onChange={(e) => handleChange('branch', e.target.value)}
                  placeholder="e.g. Narasapur"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={saving}
              style={{ marginTop: '10px' }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>

        {/* Invoice Header & Bank Preview */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '18px' }}>Invoice Preview</h3>
          <div className="bill-preview">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#0b5394', fontWeight: 700, marginBottom: '6px' }}>
              <span>TAX INVOICE / CASH / CREDIT</span>
              <span>Cell: {form.phone || '9441429745'}</span>
            </div>
            <h3 style={{ color: '#0b5394', margin: '8px 0 4px 0', fontSize: '1.3rem' }}>{form.businessName || 'VIJAYA DURGA AGENCIES'}</h3>
            {form.legalName && <p style={{ fontWeight: 600, margin: '2px 0' }}>Prop: {form.legalName} | GSTIN: {form.gstin || '37KATPS1500Q1ZR'}</p>}
            {form.address && <p style={{ fontSize: '0.82rem', color: '#555', margin: '4px 0' }}>{form.address}</p>}

            <hr style={{ margin: '14px 0', borderColor: '#e4e4e7' }} />

            <div style={{ fontSize: '0.82rem', color: '#333', textAlign: 'left', lineHeight: '1.6' }}>
              <strong>Bank Details:</strong>
              <div>Bank: {form.bankName || 'KARUR VYSYA BANK'}</div>
              <div>A/c No: {form.accountNo || '4805135000002964'}</div>
              <div>IFSC: {form.ifsc || 'KVBL0004815'} | Branch: {form.branch || 'Narasapur'}</div>
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', color: '#ef4444', border: '1px solid #fecaca', background: '#fff5f5', fontWeight: 700 }}
              onClick={logout}
            >
              <LogoutIcon size={16} color="#ef4444" /> Sign Out of Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
