import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, useToast, Toast } from '../utils/helpers';
import { TrendingUpIcon, CalendarIcon, FileCheckIcon, PlusIcon, WhatsAppIcon, ShareIcon } from '../components/Icons';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [dailySummary, setDailySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const { toast, showToast } = useToast();

  const canSeeSales = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await dashboardAPI.summary();
      setData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDailySummary = async () => {
    setLoadingSummary(true);
    setShowSummaryModal(true);
    try {
      const res = await dashboardAPI.getDailySummary();
      setDailySummary(res.data);
    } catch (err) {
      showToast('Failed to generate daily summary', 'error');
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleSendWhatsAppSummary = (targetPhone = '') => {
    if (!dailySummary?.whatsappMessage) return;
    const cleanPhone = (targetPhone || '').replace(/\D/g, '');
    const encoded = encodeURIComponent(dailySummary.whatsappMessage);
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleCopySummary = () => {
    if (!dailySummary?.whatsappMessage) return;
    navigator.clipboard.writeText(dailySummary.whatsappMessage);
    showToast('Daily summary copied to clipboard!', 'success');
  };

  if (loading) return <div className="spinner"></div>;

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2>Dashboard</h2>
          <p>{canSeeSales ? "Business Overview & Daily Trading Summary" : "Employee Portal — Create & manage invoices"}</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {canSeeSales && (
            <button
              className="btn btn-whatsapp"
              onClick={handleOpenDailySummary}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <WhatsAppIcon size={18} color="#ffffff" /> Daily Summary
            </button>
          )}

          <button
            className="btn btn-primary btn-large"
            onClick={() => navigate('/new-bill')}
          >
            <PlusIcon size={18} /> New Invoice
          </button>

          {canSeeSales && (
            <button
              className="btn btn-secondary btn-large"
              onClick={() => navigate('/ledger')}
            >
              Customer Ledger
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards — Visible only to Owner and Admin */}
      {canSeeSales && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '28px' }}>
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-value">{formatCurrency(data?.today?.totalSales || 0)}</div>
              <div className="stat-label">Today's Sales ({data?.today?.billCount || 0} bills)</div>
            </div>
            <div className="stat-icon-wrapper indigo">
              <TrendingUpIcon size={22} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-value">{formatCurrency(data?.month?.totalSales || 0)}</div>
              <div className="stat-label">This Month Sales ({data?.month?.billCount || 0} bills)</div>
            </div>
            <div className="stat-icon-wrapper emerald">
              <CalendarIcon size={22} />
            </div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#d97706' }}>
                {formatCurrency(data?.receivables?.totalPending || 0)}
              </div>
              <div className="stat-label">Outstanding Receivables ({data?.receivables?.pendingCount || 0} pending)</div>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
              <TrendingUpIcon size={22} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-value">{data?.totalBills || 0}</div>
              <div className="stat-label">Total Lifetime Invoices</div>
            </div>
            <div className="stat-icon-wrapper slate">
              <FileCheckIcon size={22} />
            </div>
          </div>
        </div>
      )}

      {/* Recent Invoices */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Invoices</h3>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/bills')}
          >
            View All →
          </button>
        </div>

        {data?.recentBills?.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Company Name</th>
                  <th className="text-right">Qty (KG)</th>
                  <th>Status</th>
                  {canSeeSales && <th className="text-right">Total Amount</th>}
                </tr>
              </thead>
              <tbody>
                {data.recentBills.map((bill) => (
                  <tr
                    key={bill._id}
                    className="clickable-row"
                    onClick={() => navigate(`/bills/${bill._id}`)}
                  >
                    <td>
                      <span className="badge badge-blue">#{bill.billNo}</span>
                    </td>
                    <td>{formatDate(bill.date)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {bill.companyName}
                    </td>
                    <td className="text-right">{bill.quantity} kg</td>
                    <td>
                      <span className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}>
                        {bill.paymentStatus || 'Pending'}
                      </span>
                    </td>
                    {canSeeSales && (
                      <td className="text-right" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(bill.grandTotal || bill.total)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No invoices created yet</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/new-bill')}
            >
              Create Your First Invoice
            </button>
          </div>
        )}
      </div>

      {/* Daily Summary WhatsApp Modal */}
      {showSummaryModal && (
        <div className="modal-backdrop" onClick={() => setShowSummaryModal(false)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#25D366', color: '#ffffff', borderRadius: '50%', padding: '6px', display: 'flex' }}>
                  <WhatsAppIcon size={20} color="#ffffff" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Daily Business Summary</h3>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowSummaryModal(false)}
                style={{ fontSize: '1.2rem', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            {loadingSummary ? (
              <div className="spinner" style={{ margin: '30px auto' }}></div>
            ) : (
              <div>
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.88rem',
                  lineHeight: '1.6',
                  color: '#1e293b',
                  marginBottom: '20px',
                  maxHeight: '320px',
                  overflowY: 'auto'
                }}>
                  {dailySummary?.whatsappMessage}
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-whatsapp"
                    style={{ flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
                    onClick={() => handleSendWhatsAppSummary()}
                  >
                    <WhatsAppIcon size={18} color="#ffffff" /> Share on WhatsApp
                  </button>

                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, minWidth: '130px', padding: '12px' }}
                    onClick={handleCopySummary}
                  >
                    📋 Copy Text
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
