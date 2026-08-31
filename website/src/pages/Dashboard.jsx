import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, billsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency, formatDate, useToast, Toast } from '../utils/helpers';
import { TrendingUpIcon, CalendarIcon, PlusIcon, WhatsAppIcon, InvoiceIcon } from '../components/Icons';
import { RevenueTrendChart, TopCustomersBarChart, PaymentStatusDonut } from '../components/AnalyticsCharts';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [trendView, setTrendView] = useState('daily'); // 'daily' | 'monthly'
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
    showToast('Daily summary copied to clipboard', 'success');
  };

  const currentDateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (loading) return <div className="spinner" style={{ minHeight: '60vh' }}></div>;

  return (
    <div className="page-container fade-in" style={{ maxWidth: '1440px', margin: '0 auto' }}>
      <Toast toast={toast} />

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE COMMAND HERO (ADMIN) OR SIMPLE HEADER (STAFF/OWNER)          */}
      {/* ========================================================================= */}
      {isAdmin ? (
        <div
          style={{
            background: 'linear-gradient(135deg, #091E3A 0%, #102A45 50%, #0B3B60 100%)',
            borderRadius: '20px',
            padding: '24px 28px',
            color: '#ffffff',
            marginBottom: '24px',
            boxShadow: '0 12px 30px -8px rgba(9, 30, 58, 0.4)',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          {/* Subtle Ambient Radial Glow */}
          <div
            style={{
              position: 'absolute',
              top: '-60px',
              right: '-60px',
              width: '260px',
              height: '260px',
              background: 'radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, rgba(56, 189, 248, 0) 70%)',
              borderRadius: '50%',
              pointerEvents: 'none',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#6ee7b7',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.6px',
                    textTransform: 'uppercase',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                  SYSTEM ACTIVE
                </span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                  {currentDateStr}
                </span>
              </div>

              <h1 style={{ fontSize: '1.65rem', fontWeight: 900, margin: 0, letterSpacing: '-0.6px', color: '#ffffff' }}>
                Executive Billing Center
              </h1>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.84rem', color: '#94a3b8', fontWeight: 500 }}>
                VIJAYA DURGA AGENCIES • Real-time Financial Command
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-whatsapp"
                onClick={handleOpenDailySummary}
                style={{
                  fontWeight: 800,
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '10px',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
                }}
              >
                <WhatsAppIcon size={16} color="#ffffff" /> Daily Summary
              </button>
              <button
                type="button"
                onClick={() => navigate('/new-bill')}
                style={{
                  background: '#ffffff',
                  color: '#0b5394',
                  fontWeight: 900,
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  transition: 'all 0.2s ease',
                }}
              >
                <PlusIcon size={18} color="#0b5394" /> Create Invoice
              </button>
            </div>
          </div>

          {/* Quick Nav Command Bar */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              marginTop: '18px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {[
              { label: 'Sales Reports →', path: '/reports' },
              { label: 'Customers →', path: '/customers' },
              { label: 'Tally XML Export', action: () => window.open(billsAPI.exportTallyUrl(), '_blank') },
              { label: 'Activity Audit Log →', path: '/activity-log' },
            ].map((btn, i) => (
              <button
                key={i}
                type="button"
                onClick={btn.action || (() => navigate(btn.path))}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  color: '#e2e8f0',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.16)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.color = '#e2e8f0';
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>{t('dashboard')}</h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {isOwnerOrAdmin ? t('businessOverview') : t('createManageInvoices')}
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/new-bill')}
            style={{ background: '#0b5394', color: '#ffffff', fontWeight: 800, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <PlusIcon size={18} color="#ffffff" /> {t('newInvoice')}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. HIGH-END BENTO KPI CARDS WITH SPARKLINES                               */}
      {/* ========================================================================= */}
      {/* 2. ENTERPRISE KPI CARDS (Compact Mobile Bento Grid)                      */}
      {/* ========================================================================= */}
      {isOwnerOrAdmin && (
        <div className="dashboard-stats-grid">
          {/* Today's Sales Card */}
          <div className="stat-card-compact">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="stat-label" style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('todaysSales')}
                </span>
                <div className="stat-value" style={{ fontSize: '1.55rem', fontWeight: 900, color: '#0b5394', marginTop: '4px', letterSpacing: '-0.5px' }}>
                  {formatCurrency(data?.today?.totalSales || 0)}
                </div>
              </div>
              <div
                className="stat-icon"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  border: '1px solid #dbeafe',
                  color: '#0b5394',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <TrendingUpIcon size={18} />
              </div>
            </div>

            <div className="stat-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                {data?.today?.billCount || 0} {t('bills')}
              </span>
              <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                Today
              </span>
            </div>
          </div>

          {/* This Month's Sales Card */}
          <div className="stat-card-compact">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="stat-label" style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('thisMonthSales')}
                </span>
                <div className="stat-value" style={{ fontSize: '1.55rem', fontWeight: 900, color: '#10b981', marginTop: '4px', letterSpacing: '-0.5px' }}>
                  {formatCurrency(data?.month?.totalSales || 0)}
                </div>
              </div>
              <div
                className="stat-icon"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#f0fdf4',
                  border: '1px solid #dcfce7',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CalendarIcon size={18} />
              </div>
            </div>

            <div className="stat-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                {data?.month?.billCount || 0} {t('bills')}
              </span>
              <span style={{ background: '#ecfdf5', color: '#059669', fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                MTD
              </span>
            </div>
          </div>

          {/* Outstanding Receivables Card */}
          <div className="stat-card-compact">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="stat-label" style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('outstandingReceivables')}
                </span>
                <div className="stat-value" style={{ fontSize: '1.55rem', fontWeight: 900, color: '#d97706', marginTop: '4px', letterSpacing: '-0.5px' }}>
                  {formatCurrency(data?.receivables?.totalPending || 0)}
                </div>
              </div>
              <div
                className="stat-icon"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <TrendingUpIcon size={18} />
              </div>
            </div>

            <div className="stat-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                {data?.receivables?.pendingCount || 0} unpaid
              </span>
              <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                Pending
              </span>
            </div>
          </div>

          {/* Total Lifetime Invoices Card */}
          <div className="stat-card-compact">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="stat-label" style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('totalLifetimeInvoices')}
                </span>
                <div className="stat-value" style={{ fontSize: '1.55rem', fontWeight: 900, color: '#4338ca', marginTop: '4px', letterSpacing: '-0.5px' }}>
                  {data?.totalBills || 0}
                </div>
              </div>
              <div
                className="stat-icon"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#f5f3ff',
                  border: '1px solid #ede9fe',
                  color: '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <InvoiceIcon size={18} />
              </div>
            </div>

            <div className="stat-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                Lifetime
              </span>
              <span style={{ background: '#ede9fe', color: '#6366f1', fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                All Time
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VISUAL ANALYTICS & REVENUE TREND ENGINE (ADMIN EXCLUSIVE)               */}
      {/* ========================================================================= */}
      {isAdmin && analytics && (
        <div style={{ marginBottom: '24px' }}>
          {/* Section Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
                Business Revenue & Analytics
              </h3>
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setTrendView('daily')}
                  style={{
                    background: trendView === 'daily' ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    color: trendView === 'daily' ? '#0b5394' : '#64748b',
                    cursor: 'pointer',
                    boxShadow: trendView === 'daily' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  7 Days Daily
                </button>
                <button
                  type="button"
                  onClick={() => setTrendView('monthly')}
                  style={{
                    background: trendView === 'monthly' ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    color: trendView === 'monthly' ? '#0b5394' : '#64748b',
                    cursor: 'pointer',
                    boxShadow: trendView === 'monthly' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  6 Months Trend
                </button>
              </div>
            </div>

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/reports')}
              style={{ color: '#0b5394', fontWeight: 800, fontSize: '0.84rem' }}
            >
              Full Sales Report →
            </button>
          </div>

          {/* Grid: Spline Area Chart (Left) + Radial Health (Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <RevenueTrendChart
                data={trendView === 'daily' ? analytics.dailyTrends : analytics.monthlyTrends}
                title={trendView === 'daily' ? '7-Day Revenue Curve (INR)' : '6-Month Revenue Curve (INR)'}
              />
            </div>
            <div>
              <PaymentStatusDonut
                paid={data?.month?.totalSales ? Math.max(0, data.month.totalSales - (data?.receivables?.totalPending || 0)) : 0}
                pending={data?.receivables?.totalPending || 0}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. RECENT INVOICES STREAM                                                 */}
      {/* ========================================================================= */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '22px 24px',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, color: '#0f172a', letterSpacing: '-0.3px' }}>
              {t('recentInvoices')}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Latest generated bills and transactions
            </p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/bills')}
            style={{ color: '#0b5394', fontWeight: 800, fontSize: '0.84rem' }}
          >
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
                  borderRadius: '12px',
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
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: '100px' }}>{t('invoiceNo')}</th>
                <th>{t('date')}</th>
                <th>{t('companyName')}</th>
                <th style={{ textAlign: 'right' }}>{t('qtyKg')}</th>
                <th style={{ textAlign: 'center' }}>{t('status')}</th>
                <th style={{ textAlign: 'right' }}>{t('totalAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {(!data?.recentBills || data.recentBills.length === 0) ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    No invoices generated yet.
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
                    <td style={{ color: '#64748b', fontSize: '0.84rem' }}>{formatDate(bill.date)}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{bill.companyName}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{bill.quantity || 0} kg</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}>
                        {bill.paymentStatus === 'Paid' ? t('paid') : t('pending')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#0b5394' }}>
                      {formatCurrency(bill.grandTotal || bill.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. DAILY SUMMARY MODAL                                                    */}
      {/* ========================================================================= */}
      {showSummaryModal && (
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
          onClick={() => setShowSummaryModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '480px',
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
                  Daily Business Summary
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  {dailySummary?.date || currentDateStr}
                </p>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                ×
              </button>
            </div>

            {loadingSummary ? (
              <div className="spinner" style={{ minHeight: '180px' }}></div>
            ) : dailySummary ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Today's Sales</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0b5394', marginTop: '2px' }}>
                      {formatCurrency(dailySummary.today.totalSales)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{dailySummary.today.billCount} bills</div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Month Total</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
                      {formatCurrency(dailySummary.month.totalSales)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{dailySummary.month.billCount} bills</div>
                  </div>
                </div>

                {dailySummary.topBuyerToday && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>Top Buyer Today</div>
                    <div style={{ fontWeight: 800, color: '#15803d', fontSize: '0.92rem', marginTop: '2px' }}>
                      {dailySummary.topBuyerToday.name} — {formatCurrency(dailySummary.topBuyerToday.amount)} ({dailySummary.topBuyerToday.bills} bills)
                    </div>
                  </div>
                )}

                {/* Message Preview */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Formatted Message Preview:
                  </label>
                  <pre
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '0.78rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: '#334155',
                      fontFamily: 'monospace',
                      maxHeight: '180px',
                      overflowY: 'auto',
                    }}
                  >
                    {dailySummary.whatsappMessage}
                  </pre>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-whatsapp"
                    onClick={() => handleSendWhatsAppSummary()}
                    style={{ flex: 1, fontWeight: 800, padding: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <WhatsAppIcon size={16} color="#ffffff" /> Share on WhatsApp
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCopySummary}
                    style={{ padding: '10px 14px', fontWeight: 700, fontSize: '0.85rem' }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
