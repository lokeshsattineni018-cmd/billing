import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { billsAPI, settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency, formatDate, useToast, Toast } from '../utils/helpers';
import { CANONICAL_BANK_DETAILS } from '../constants/bankDetails';
import { TrendingUpIcon, FileCheckIcon, WhatsAppIcon, SearchIcon } from '../components/Icons';

export default function CustomerLedger() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast, showToast } = useToast();

  const [ledgerData, setLedgerData] = useState({ customers: [], summary: {} });
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');

  const canSeeSales = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    loadLedger();
  }, []);

  const loadLedger = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ledgerRes, settingsRes] = await Promise.all([
        billsAPI.getLedger(),
        settingsAPI.get(),
      ]);
      setLedgerData(ledgerRes.data);
      setSettings(settingsRes.data);
    } catch (error) {
      if (import.meta.env.DEV) { console.error('Failed to load customer ledger:', error); }
      setLoadError('Failed to load customer ledger. Please check connection and retry.');
      showToast('Failed to load customer ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = (customer) => {
    const phone = customer.customerPhone ? customer.customerPhone.replace(/[^0-9]/g, '') : '';
    const pendingAmount = formatCurrency(customer.outstandingBalance);
    const bank = CANONICAL_BANK_DETAILS.bankName;
    const accName = CANONICAL_BANK_DETAILS.accountName;
    const acc = CANONICAL_BANK_DETAILS.accountNo;
    const ifsc = CANONICAL_BANK_DETAILS.ifsc;
    const branch = CANONICAL_BANK_DETAILS.branch;

    const message = `PAYMENT REMINDER — VIJAYA DURGA AGENCIES

Dear ${customer.companyName},

This is a gentle reminder regarding your outstanding balance with VIJAYA DURGA AGENCIES.

Total Pending Balance: ${pendingAmount}
Pending Invoices: ${customer.unpaidBillsCount} bill(s)

${CANONICAL_BANK_DETAILS.title}
• A/C Name: ${accName}
• Bank: ${bank}
• Account No: ${acc}
• IFSC Code: ${ifsc}
• Branch: ${branch}

Kindly process the payment at your earliest convenience. If already paid, please ignore this message.

Thank you!
VIJAYA DURGA AGENCIES
Phone: ${settings?.phone || '9441429745'}`;

    const waUrl = phone
      ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.location.href = waUrl;
  };

  if (!canSeeSales) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p>Access restricted to Owner and Admin</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const filteredCustomers = (ledgerData?.customers || []).filter((c) =>
    (c?.companyName || 'Unknown Customer').toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      <div className="page-header">
        <h1>{t('customerLedger')}</h1>
        <p>{t('customerLedgerSubtitle')}</p>
      </div>

      {loadError && (
        <div className="card u-mb-16" style={{ padding: '16px 20px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ color: '#991b1b', fontWeight: 700, fontSize: '0.9rem' }}>{loadError}</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={loadLedger}>Retry</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#d97706' }}>
              {formatCurrency(ledgerData.summary?.totalReceivables || 0)}
            </div>
            <div className="stat-label">{t('totalOutstandingBalance')}</div>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
            <TrendingUpIcon size={20} />
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#059669' }}>
              {formatCurrency(ledgerData.summary?.totalCollected || 0)}
            </div>
            <div className="stat-label">Total Paid Amount</div>
          </div>
          <div className="stat-icon-wrapper emerald">
            <FileCheckIcon size={20} />
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #0f172a' }}>
          <div className="stat-info">
            <div className="stat-value">
              {formatCurrency(ledgerData.summary?.totalRevenue || 0)}
            </div>
            <div className="stat-label">Total Billed Amount</div>
          </div>
          <div className="stat-icon-wrapper indigo">
            <TrendingUpIcon size={20} />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          className="form-input"
          placeholder="Search customer name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="btn btn-ghost" onClick={() => setSearch('')}>Clear</button>
        )}
      </div>

      {/* Customer Ledger Table */}
      <div className="card">
        {loading ? (
          <div className="spinner"></div>
        ) : filteredCustomers.length > 0 ? (
          <>
            {/* Mobile Cards View (<= 768px) */}
            <div className="mobile-bills-list">
              {filteredCustomers.map((cust, idx) => {
                const hasPending = cust.outstandingBalance > 0;
                return (
                  <div key={`mob-${cust._id || cust.companyName}-${idx}`} className="mobile-bill-card">
                    <div className="mobile-bill-header">
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.96rem' }}>
                          {cust.companyName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          GSTIN: {cust.companyGstin || '37KATPS1500Q1ZR'} {cust.customerPhone && `• Cell: ${cust.customerPhone}`}
                        </div>
                      </div>
                      {cust.unpaidBillsCount > 0 ? (
                        <span className="badge badge-amber">{cust.unpaidBillsCount} unpaid</span>
                      ) : (
                        <span className="badge badge-green">All Paid</span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '8px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        margin: '10px 0',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.68rem', color: '#52606d', fontWeight: 600 }}>Invoiced</div>
                        <div className="tabular-num" style={{ fontSize: '0.84rem', fontWeight: 600 }}>{formatCurrency(cust.totalInvoiced)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: '#52606d', fontWeight: 600 }}>Paid</div>
                        <div className="tabular-num" style={{ fontSize: '0.84rem', fontWeight: 600, color: '#166534' }}>{formatCurrency(cust.totalPaid)}</div>
                      </div>
                      <div className="u-text-right">
                        <div style={{ fontSize: '0.68rem', color: '#52606d', fontWeight: 600 }}>Balance</div>
                        <div className="tabular-num" style={{ fontSize: '0.88rem', fontWeight: 700, color: hasPending ? '#b42318' : '#166534' }}>
                          {formatCurrency(cust.outstandingBalance)}
                        </div>
                      </div>
                    </div>

                    <div className="u-flex-wrap-gap">
                      {hasPending && (
                        <button
                          type="button"
                          className="btn btn-whatsapp btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => handleSendReminder(cust)}
                        >
                          <WhatsAppIcon size={14} color="#ffffff" /> Reminder
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => navigate(`/bills?search=${encodeURIComponent(cust.companyName)}`)}
                      >
                        View Bills ({cust.totalBills})
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="table-container desktop-only-table">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer Name (M/s)</th>
                    <th className="text-center">Total Bills</th>
                    <th className="text-center">Pending Bills</th>
                    <th className="text-right">Total Invoiced</th>
                    <th className="text-right">Total Paid</th>
                    <th className="text-right">Outstanding Balance</th>
                    <th className="text-center" style={{ width: '220px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((cust, idx) => {
                    const hasPending = cust.outstandingBalance > 0;
                    return (
                      <tr key={`${cust._id || cust.companyName}-${idx}`}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{cust.companyName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            GSTIN: {cust.companyGstin || '37KATPS1500Q1ZR'} {cust.customerPhone && `• Cell: ${cust.customerPhone}`}
                          </div>
                        </td>
                        <td className="text-center tabular-num">
                          <span className="badge badge-blue">{cust.totalBills}</span>
                        </td>
                        <td className="text-center">
                          {cust.unpaidBillsCount > 0 ? (
                            <span className="badge badge-amber">{cust.unpaidBillsCount} unpaid</span>
                          ) : (
                            <span className="badge badge-green">All Paid</span>
                          )}
                        </td>
                        <td className="text-right tabular-num u-fw-semibold" >
                          {formatCurrency(cust.totalInvoiced)}
                        </td>
                        <td className="text-right tabular-num" style={{ color: '#166534', fontWeight: 600 }}>
                          {formatCurrency(cust.totalPaid)}
                        </td>
                        <td className="text-right tabular-num" style={{ fontWeight: 700, fontSize: '1.05rem', color: hasPending ? '#b42318' : '#166534' }}>
                          {formatCurrency(cust.outstandingBalance)}
                        </td>
                        <td className="text-center">
                          <div className="action-buttons" style={{ justifyContent: 'center' }}>
                            {hasPending && (
                              <button
                                type="button"
                                className="btn btn-whatsapp btn-sm"
                                onClick={() => handleSendReminder(cust)}
                                title="Send WhatsApp Payment Reminder with Bank details"
                              >
                                <WhatsAppIcon size={14} color="#ffffff" /> Reminder
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => navigate(`/bills?search=${encodeURIComponent(cust.companyName)}`)}
                              title="View all bills for this customer"
                            >
                              View Bills
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.4 }}>👥</div>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              No customer records found
            </p>
            {search && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Try adjusting your search
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {search && (
                <button
                  className="btn btn-secondary"
                  style={{ minHeight: '44px', padding: '10px 20px', fontSize: '0.9rem' }}
                  onClick={() => setSearch('')}
                >
                  Clear Filters
                </button>
              )}
              <button
                className="btn btn-primary"
                style={{ minHeight: '44px', padding: '10px 20px', fontSize: '0.9rem' }}
                onClick={() => navigate('/new-bill')}
              >
                + New Invoice
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
