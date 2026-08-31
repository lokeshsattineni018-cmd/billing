import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency, formatDate, useToast, Toast } from '../utils/helpers';
import { TrendingUpIcon, CalendarIcon, FileCheckIcon, PlusIcon, WhatsAppIcon, ShareIcon, DownloadIcon } from '../components/Icons';
import { RevenueTrendChart, TopCustomersBarChart, PaymentStatusDonut } from '../components/AnalyticsCharts';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [dailySummary, setDailySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const { toast, showToast } = useToast();

  const isAdmin = user?.role === 'admin';
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    loadDashboard();
    if (isAdmin) {
      loadAnalytics();
    }
  }, [isAdmin]);

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

  const loadAnalytics = async () => {
    try {
      const res = await dashboardAPI.getAnalytics();
      setAnalytics(res.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
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

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>{t('dashboard')}</h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {isOwnerOrAdmin ? t('businessOverview') : t('createManageInvoices')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: isAdmin ? '380px' : '200px' }}>
          {/* Daily Summary Button — Visible ONLY for Admin */}
          {isAdmin && (
            <button
              className="btn btn-whatsapp"
              onClick={handleOpenDailySummary}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 12px', fontSize: '0.88rem' }}
            >
              <WhatsAppIcon size={18} color="#ffffff" /> {t('dailySummary')}
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => navigate('/new-bill')}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 12px', fontSize: '0.88rem', background: '#ffffff', border: '1.5px solid #0b5394', color: '#0b5394', fontWeight: 800 }}
          >
            <PlusIcon size={18} color="#0b5394" /> {t('newInvoice')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {isOwnerOrAdmin && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '24px' }}>
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-value">{formatCurrency(data?.today?.totalSales || 0)}</div>
              <div className="stat-label">{t('todaysSales')} ({data?.today?.billCount || 0} {t('bills')})</div>
            </div>
            <div className="stat-icon-wrapper indigo">
              <TrendingUpIcon size={22} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-value">{formatCurrency(data?.month?.totalSales || 0)}</div>
              <div className="stat-label">{t('thisMonthSales')} ({data?.month?.billCount || 0} {t('bills')})</div>
            </div>
            <div className="stat-icon-wrapper emerald">
              <CalendarIcon size={22} />
            </div>
          </div>

          {/* Outstanding Receivables Card — Visible ONLY for Admin */}
          {isAdmin && (
            <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#d97706' }}>
                  {formatCurrency(data?.receivables?.totalPending || 0)}
                </div>
                <div className="stat-label">{t('outstandingReceivables')} ({data?.receivables?.pendingCount || 0} {t('pending')})</div>
              </div>
              <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
                <TrendingUpIcon size={22} />
              </div>
            </div>
          )}

          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-value">{data?.totalBills || 0}</div>
              <div className="stat-label">{t('totalLifetimeInvoices')}</div>
            </div>
            <div className="stat-icon-wrapper slate">
              <FileCheckIcon size={22} />
            </div>
          </div>
        </div>
      )}

      {/* Admin Visual Analytics & Trends (Admin Exclusive) */}
      {isAdmin && analytics && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              📈 Business Revenue & Sales Trends
            </h3>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/reports')}
              style={{ color: '#0b5394', fontWeight: 800 }}
            >
              Full Sales Report →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <RevenueTrendChart
                data={analytics.dailyTrends}
                title="📅 7-Day Revenue Trend (₹)"
              />
            </div>
            <PaymentStatusDonut
              paid={data?.month?.totalSales ? data.month.totalSales - (data?.receivables?.totalPending || 0) : 0}
              pending={data?.receivables?.totalPending || 0}
            />
          </div>

          {analytics.topCustomers?.length > 0 && (
            <TopCustomersBarChart data={analytics.topCustomers} />
          )}
        </div>
      )}

      {/* Recent Invoices Card */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: '14px' }}>
          <h3 className="card-title" style={{ fontSize: '1.05rem', fontWeight: 800 }}>{t('recentInvoices')}</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/bills')} style={{ color: '#0b5394', fontWeight: 700 }}>
            {t('viewAll')} →
          </button>
        </div>

        {/* Mobile Invoice Cards */}
        <div className="mobile-bills-list">
          {(!data?.recentBills || data.recentBills.length === 0) ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <p>No invoices created yet.</p>
            </div>
          ) : (
            data.recentBills.map((bill) => (
              <div
                key={bill._id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/bills/${bill._id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: '#eff6ff', color: '#0b5394', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', fontSize: '0.82rem' }}>
                      #{bill.billNo}
                    </span>
                    <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{bill.companyName}</strong>
                  </div>
                  <span className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '0.72rem' }}>
                    {bill.paymentStatus === 'Paid' ? t('paid') : t('pending')}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#64748b', marginTop: '6px' }}>
                  <span>{formatDate(bill.date)} • {bill.quantity || 0} kg</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0b5394' }}>
                    {formatCurrency(bill.grandTotal || bill.total)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="table-container desktop-only-table">
          <table className="table">
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: '80px' }}>{t('invoiceNo')}</th>
                <th>{t('date')}</th>
                <th>{t('companyName')}</th>
                <th style={{ textAlign: 'right' }}>{t('qtyKg')}</th>
                <th>{t('status')}</th>
                <th style={{ textAlign: 'right' }}>{t('totalAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {(!data?.recentBills || data.recentBills.length === 0) ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '28px', color: '#94a3b8' }}>
                    No invoices created yet.
                  </td>
                </tr>
              ) : (
                data.recentBills.map((bill) => (
                  <tr
                    key={bill._id}
                    onClick={() => navigate(`/bills/${bill._id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="badge badge-blue">#{bill.billNo}</span>
                    </td>
                    <td>{formatDate(bill.date)}</td>
                    <td style={{ fontWeight: 600, color: '#0b5394' }}>{bill.companyName}</td>
                    <td style={{ textAlign: 'right' }}>{bill.quantity} kg</td>
                    <td>
                      <span className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}>
                        {bill.paymentStatus === 'Paid' ? t('paid') : t('pending')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {formatCurrency(bill.grandTotal || bill.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WhatsApp Daily Summary Modal (Admin Only) */}
      {showSummaryModal && dailySummary && (
        <div className="modal-backdrop" onClick={() => setShowSummaryModal(false)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#25d366', color: '#ffffff', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <WhatsAppIcon size={18} color="#ffffff" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Daily Business Summary</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSummaryModal(false)}>✕</button>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.5', maxHeight: '240px', overflowY: 'auto', color: '#0f172a' }}>
              {dailySummary.whatsappMessage}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                className="btn btn-whatsapp"
                style={{ flex: 1, padding: '10px' }}
                onClick={() => handleSendWhatsAppSummary()}
              >
                <WhatsAppIcon size={16} color="#ffffff" /> Share WhatsApp
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '10px 14px' }}
                onClick={handleCopySummary}
              >
                <ShareIcon size={16} /> Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
