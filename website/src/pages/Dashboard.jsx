import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, billsAPI } from '../services/api';
import { getMasterCache, setMasterCache, getUserCacheKey } from '../utils/offlineDb';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency, formatDate, useToast, Toast } from '../utils/helpers';
import { TrendingUpIcon, CalendarIcon, PlusIcon, WhatsAppIcon, InvoiceIcon, RefreshIcon, CloseIcon } from '../components/Icons';
import { RevenueTrendChart, TopCustomersBarChart, PaymentStatusDonut } from '../components/AnalyticsCharts';
import { SkeletonKPIGrid, SkeletonTable, SkeletonChart, SkeletonCard, Skeleton } from '../components/Skeleton';
import CountUp from '../components/CountUp';
import PullToRefresh from '../components/PullToRefresh';
import ProfitLossWidget from '../components/ProfitLossWidget';
import ErrorBoundary from '../components/ErrorBoundary';
import Modal from '../components/Modal';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [trendView, setTrendView] = useState('daily'); // 'daily' | 'monthly'
  const [dailySummary, setDailySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);

  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const { toast, showToast } = useToast();

  const isAdmin = user?.role === 'admin';
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';
  const isUpdating = refreshing || isRevalidating;

  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!isOwnerOrAdmin) {
      if (!isSilent) setLoading(false);
      return;
    }
    if (!isSilent) setLoading(true);
    try {
      const response = await dashboardAPI.combined();
      if (response.data?.summary) {
        setData(response.data.summary);
        setMasterCache(getUserCacheKey('dashboardSummary', user), response.data.summary).catch(() => {});
      }
      if (response.data?.analytics && isAdmin) {
        setAnalytics(response.data.analytics);
        setMasterCache(getUserCacheKey('dashboardAnalytics', user), response.data.analytics).catch(() => {});
      }
    } catch (error) {
      if (import.meta.env.DEV) { console.error('Combined dashboard failed, falling back to legacy endpoints:', error); }
      try {
        const [sumRes, anaRes] = await Promise.all([
          dashboardAPI.summary(),
          isAdmin ? dashboardAPI.getAnalytics() : Promise.resolve({ data: null }),
        ]);
        if (sumRes?.data) {
          setData(sumRes.data);
          setMasterCache(getUserCacheKey('dashboardSummary', user), sumRes.data).catch(() => {});
        }
        if (anaRes?.data && isAdmin) {
          setAnalytics(anaRes.data);
          setMasterCache(getUserCacheKey('dashboardAnalytics', user), anaRes.data).catch(() => {});
        }
      } catch {
        throw error;
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [isAdmin, isOwnerOrAdmin, user]);

  // Stale-While-Revalidate: load cached snapshot instantly, then revalidate in background
  useEffect(() => {
    let active = true;

    async function initDashboard() {
      // 1. Instant Cache Render (only for owner/admin)
      if (isOwnerOrAdmin) {
        try {
          const summaryKey = getUserCacheKey('dashboardSummary', user);
          const analyticsKey = getUserCacheKey('dashboardAnalytics', user);
          const [cachedSummary, cachedAnalytics] = await Promise.all([
            getMasterCache(summaryKey),
            isAdmin ? getMasterCache(analyticsKey) : Promise.resolve(null),
          ]);
          if (active && cachedSummary) {
            setData(cachedSummary);
            if (cachedAnalytics && isAdmin) setAnalytics(cachedAnalytics);
            setLoading(false); // Immediate render with zero network delay
            setIsRevalidating(true);
          }
        } catch (err) {
          // Fall back to network loading
        }
      } else {
        // Staff role: strictly clear any state and avoid rendering owner/admin revenue metrics
        setData(null);
        setAnalytics(null);
        setLoading(false);
      }

      // 2. Background Revalidation via single combined round-trip (owner/admin only)
      if (isOwnerOrAdmin) {
        try {
          await loadDashboardData(true);
        } catch (error) {
          // Handled in loadDashboardData
        } finally {
          if (active) {
            setLoading(false);
            setIsRevalidating(false);
          }
        }
      }
    }

    initDashboard();

    // Listen for cache invalidation events (e.g. bill create, edit, payment, void, delete)
    const handleInvalidation = () => {
      if (isOwnerOrAdmin) {
        loadDashboardData(true).catch(() => {});
      }
    };
    window.addEventListener('vda-cache-invalidated', handleInvalidation);

    return () => {
      active = false;
      window.removeEventListener('vda-cache-invalidated', handleInvalidation);
    };
  }, [isAdmin, isOwnerOrAdmin, user, loadDashboardData]);

  // Live Auto-Refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setRefreshing(true);
        loadDashboardData(true).finally(() => {
          setRefreshing(false);
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const handleManualRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const minSpin = new Promise((resolve) => setTimeout(resolve, 600));
      await Promise.all([loadDashboardData(true), minSpin]);
      showToast('Dashboard data refreshed', 'success');
    } catch (error) {
      showToast('Failed to refresh dashboard. Please retry.', 'error');
    } finally {
      setRefreshing(false);
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

  const fallbackCopyText = (text) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Daily summary copied to clipboard', 'success');
    } catch {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleSendWhatsAppSummary = (targetPhone = '') => {
    const rawMsg = (dailySummary?.whatsappMessage || '').replace(/\*/g, '');
    if (!rawMsg) return;
    const cleanPhone = (targetPhone || '').replace(/\D/g, '');
    const encoded = encodeURIComponent(rawMsg);
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    setShowSummaryModal(false);
    try {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = url;
      }
    } catch {
      window.location.href = url;
    }
  };

  const handleCopySummary = () => {
    const rawMsg = (dailySummary?.whatsappMessage || '').replace(/\*/g, '');
    if (!rawMsg) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(rawMsg)
        .then(() => showToast('Daily summary copied to clipboard', 'success'))
        .catch(() => fallbackCopyText(rawMsg));
    } else {
      fallbackCopyText(rawMsg);
    }
  };

  const currentDateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="page-container fade-in" style={{ maxWidth: '1440px', margin: '0 auto' }}>
        <div style={{ padding: '24px 28px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <Skeleton width="220px" height="28px" style={{ marginBottom: '8px' }} />
          <Skeleton width="340px" height="14px" />
        </div>
        <SkeletonKPIGrid count={4} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          <SkeletonChart />
          <SkeletonCard height="260px" />
        </div>
        <SkeletonTable rows={5} cols={6} />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleManualRefresh}>
      <div className="page-container fade-in" style={{ maxWidth: '1440px', margin: '0 auto' }}>
        <Toast toast={toast} />

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE COMMAND HERO (ADMIN) OR SIMPLE HEADER (STAFF/OWNER)          */}
      {/* ========================================================================= */}
      {isAdmin ? (
        <div
          className="dashboard-hero"
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px 28px',
            color: '#0f172a',
            marginBottom: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
          }}
        >

          {/* Header Row: Title & Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div className="dashboard-hero-title-area" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 className="dashboard-hero-title" style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, letterSpacing: '-0.3px', color: '#102a43' }}>
                  Vijaya Durga Agencies
                </h1>
                <p className="dashboard-hero-subtitle" style={{ margin: '3px 0 0 0', fontSize: '0.84rem', color: '#52606d', fontWeight: 500 }}>
                  {user?.name || 'Operations'} • Daily Billing &amp; Settlement Overview • {currentDateStr}
                </p>
              </div>
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="show-on-mobile-flex"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  minHeight: '48px',
                  minWidth: '48px',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#0b5394',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  flexShrink: 0,
                }}
                title="Reload dashboard data"
              >
                <RefreshIcon size={16} color="#0b5394" spinning={isUpdating} />
                <span>{isUpdating ? '...' : 'Reload'}</span>
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="dashboard-hero-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isUpdating}
                className="hide-on-mobile"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#0b5394',
                  transition: 'background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), border-color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
                title="Click to refresh dashboard data"
              >
                <RefreshIcon size={16} color="#0b5394" spinning={isUpdating} />
                <span>{isUpdating ? 'Updating...' : 'Refresh'}</span>
              </button>
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
                className="btn btn-primary"
                onClick={() => navigate('/new-bill')}
                style={{
                  background: '#0b5394',
                  color: '#ffffff',
                  fontWeight: 800,
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <PlusIcon size={18} color="#ffffff" /> Create Invoice
              </button>
            </div>
          </div>


            {/* Smart Outstanding Alert Pill */}
            {(data?.receivables?.pendingCount > 0 || data?.receivables?.totalPending > 0) && (
              <div
                className="dashboard-awaiting-banner"
                onClick={() => navigate('/bills')}
                style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>⚠️</span>
                  <span style={{ color: '#92400e', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {data.receivables.pendingCount} Invoices Pending
                  </span>
                  <span style={{ color: '#b45309', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    ({formatCurrency(data.receivables.totalPending)})
                  </span>
                </div>
                <span style={{ color: '#b45309', fontWeight: 800, fontSize: '0.74rem', whiteSpace: 'nowrap', marginLeft: '8px', flexShrink: 0 }}>
                  Review →
                </span>
              </div>
            )}
          </div>
      ) : (
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>{t('dashboard')}</h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {isOwnerOrAdmin ? t('businessOverview') : t('createManageInvoices')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '9px 13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#0b5394',
              }}
              title="Refresh dashboard"
            >
              <RefreshIcon size={15} color="#0b5394" spinning={isUpdating} />
              <span>{isUpdating ? '...' : 'Refresh'}</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/new-bill')}
              style={{ background: '#0b5394', color: '#ffffff', fontWeight: 800, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <PlusIcon size={18} color="#ffffff" /> {t('newInvoice')}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. HIGH-END BENTO KPI CARDS WITH SPARKLINES                               */}
      {/* ========================================================================= */}
      {/* 2. ENTERPRISE KPI CARDS (Compact Mobile Bento Grid)                      */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 2. ENTERPRISE KPI CARDS WITH DYNAMIC DATE FILTER                         */}
      {/* ========================================================================= */}
      {isOwnerOrAdmin && (
        <>
          <div className="dashboard-stats-grid">
            {/* Today's Sales Card */}
            <div className="stat-card-compact stat-hero">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="stat-label" style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {t('todaysSales')}
                  </span>
                  <div className="stat-value" style={{ fontSize: '1.55rem', fontWeight: 700, color: '#0b5394', marginTop: '4px', letterSpacing: '-0.5px' }}>
                    <CountUp value={data?.today?.totalSales ?? data?.selectedPeriod?.totalSales ?? 0} isCurrency />
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
                  <CountUp value={data?.today?.billCount ?? data?.selectedPeriod?.billCount ?? 0} /> {t('bills')}
                </span>
                <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                  Today
                </span>
              </div>
            </div>

          {/* This Month's Sales Card */}
          <div className="stat-card-compact stat-hero">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="stat-label" style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('thisMonthSales')}
                </span>
                <div className="stat-value" style={{ fontSize: '1.55rem', fontWeight: 700, color: '#10b981', marginTop: '4px', letterSpacing: '-0.5px' }}>
                  <CountUp value={data?.month?.totalSales || 0} isCurrency />
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
                <CountUp value={data?.month?.billCount || 0} /> {t('bills')}
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
                <div className="stat-value" style={{ fontSize: '1.55rem', fontWeight: 700, color: '#d97706', marginTop: '4px', letterSpacing: '-0.5px' }}>
                  <CountUp value={data?.receivables?.totalPending || 0} isCurrency />
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
                <CountUp value={data?.receivables?.pendingCount || 0} /> unpaid
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
                <div className="stat-value" style={{ fontSize: '1.55rem', fontWeight: 700, color: '#4338ca', marginTop: '4px', letterSpacing: '-0.5px' }}>
                  <CountUp value={data?.totalBills || 0} />
                </div>
              </div>

              <div
                className="stat-icon"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#e8f1fa',
                  border: '1px solid rgba(11, 83, 148, 0.18)',
                  color: '#0b5394',
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
              <span style={{ fontSize: '0.75rem', color: '#52606d', fontWeight: 600 }}>
                Lifetime
              </span>
              <span style={{ background: '#e8f1fa', color: '#0b5394', fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '6px' }}>
                All Time
              </span>
            </div>
          </div>
        </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 2.5 LIVE PROFIT & LOSS (P&L) WITH MARGIN TRACKING                          */}
      {/* ========================================================================= */}
      {isAdmin && (
        <ErrorBoundary inline>
          <ProfitLossWidget />
        </ErrorBoundary>
      )}

      {/* ========================================================================= */}
      {/* 3. VISUAL ANALYTICS & REVENUE TREND ENGINE (ADMIN EXCLUSIVE)               */}
      {/* ========================================================================= */}
      {isAdmin && analytics && (
        <div style={{ marginBottom: '24px' }}>
          {/* Section Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#102a43', margin: 0, letterSpacing: '-0.2px' }}>
                Business Revenue &amp; Analytics
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
                    fontWeight: 600,
                    color: trendView === 'daily' ? '#0b5394' : '#52606d',
                    cursor: 'pointer',
                    boxShadow: trendView === 'daily' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    transition: 'background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
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
                    fontWeight: 600,
                    color: trendView === 'monthly' ? '#0b5394' : '#52606d',
                    cursor: 'pointer',
                    boxShadow: trendView === 'monthly' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    transition: 'background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
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
              <ErrorBoundary inline>
                <RevenueTrendChart
                  data={trendView === 'daily' ? analytics.dailyTrends : analytics.monthlyTrends}
                  title={trendView === 'daily' ? '7-Day Revenue Curve (INR)' : '6-Month Revenue Curve (INR)'}
                />
              </ErrorBoundary>
            </div>
            <div>
              <ErrorBoundary inline>
                <PaymentStatusDonut
                  paid={data?.month?.totalSales ? Math.max(0, data.month.totalSales - (data?.receivables?.totalPending || 0)) : 0}
                  pending={data?.receivables?.totalPending || 0}
                />
              </ErrorBoundary>
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
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '-0.3px' }}>
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
      <Modal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        maxWidth="480px"
        labelledBy="daily-summary-modal-title"
        contentStyle={{ padding: '24px', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 id="daily-summary-modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                Daily Business Summary
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#52606d' }}>
                {dailySummary?.date || currentDateStr}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSummaryModal(false)}
              aria-label="Close daily business summary"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#52606d',
                minWidth: '48px',
                minHeight: '48px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
              }}
            >
              <CloseIcon size={18} />
            </button>
          </div>

            {loadingSummary ? (
              <div className="spinner" style={{ minHeight: '180px' }}></div>
            ) : dailySummary ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Today's Sales</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0b5394', marginTop: '2px' }}>
                      {formatCurrency(dailySummary.today.totalSales)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{dailySummary.today.billCount} bills</div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Month Total</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
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
                    {(dailySummary.whatsappMessage || '').replace(/\*/g, '')}
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
      </Modal>
      </div>
    </PullToRefresh>
  );
}
