import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import CountUp from './CountUp';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  CalendarIcon,
  ScaleIcon,
  RefreshIcon,
  InvoiceIcon,
  IceIcon,
  StaffIcon,
} from './Icons';

export default function ProfitLossWidget() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getFirstOfMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const [period, setPeriod] = useState('this_month');
  const [singleDate, setSingleDate] = useState(getTodayStr());
  const [customStart, setCustomStart] = useState(getFirstOfMonthStr());
  const [customEnd, setCustomEnd] = useState(getTodayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPnl = async (overrideParams) => {
    setLoading(true);
    try {
      const activePeriod = overrideParams?.period || period;
      const params = { period: activePeriod };

      if (activePeriod === 'single_day') {
        const d = overrideParams?.startDate || singleDate;
        params.startDate = d;
        params.endDate = d;
      } else if (activePeriod === 'custom') {
        const s = overrideParams?.startDate || customStart;
        const e = overrideParams?.endDate || customEnd;
        if (!s || !e) {
          setLoading(false);
          return;
        }
        params.startDate = s;
        params.endDate = e;
      }

      const finalParams = overrideParams ? { ...params, ...overrideParams } : params;
      const res = await dashboardAPI.getProfitLoss(finalParams);
      setData(res.data);
    } catch (err) {
      // Keep existing data on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPnl();
  }, [period]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    if (newPeriod === 'single_day') {
      loadPnl({ period: 'single_day', startDate: singleDate, endDate: singleDate });
    } else if (newPeriod === 'custom') {
      if (customStart && customEnd) {
        loadPnl({ period: 'custom', startDate: customStart, endDate: customEnd });
      }
    } else {
      loadPnl({ period: newPeriod });
    }
  };

  const handleApplySingleDate = (e) => {
    if (e) e.preventDefault();
    if (!singleDate) return;
    loadPnl({ period: 'single_day', startDate: singleDate, endDate: singleDate });
  };

  const handleApplyCustomRange = (e) => {
    if (e) e.preventDefault();
    if (!customStart || !customEnd) return;
    loadPnl({ period: 'custom', startDate: customStart, endDate: customEnd });
  };

  const handleDrilldownDay = (dateStr) => {
    setSingleDate(dateStr);
    setPeriod('single_day');
    loadPnl({ period: 'single_day', startDate: dateStr, endDate: dateStr });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPnl();
  };

  const pnl = data?.pnl || { netProfit: 0, marginPercent: 0, status: 'PROFIT' };
  const revenue = data?.revenue || { totalRevenue: 0, invoiceSales: 0, invoiceCount: 0, wastageSales: 0, wastageKg: 0 };
  const expenses = data?.expenses || { totalExpenses: 0, staffWages: 0, staffEntries: 0, iceExpenses: 0, iceBlocks: 0 };
  const isProfit = pnl.netProfit >= 0;

  // Active period display label
  const displayPeriodLabel = () => {
    if (period === 'today') return 'Today';
    if (period === 'yesterday') return 'Yesterday';
    if (period === 'this_week') return 'This Week';
    if (period === 'this_month') return 'This Month';
    if (period === 'single_day') {
      try {
        return new Date(singleDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch (e) {
        return singleDate;
      }
    }
    if (period === 'custom') {
      return `${customStart} to ${customEnd}`;
    }
    return data?.periodLabel || 'This Month';
  };

  return (
    <div
      className="card fade-in"
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '22px 24px',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.05)',
        marginBottom: '24px',
      }}
    >
      {/* 1. Header & Period Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '16px',
        }}
      >
        {/* Title and Active Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#eff6ff',
              border: '1px solid #dbeafe',
              color: '#0b5394',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TrendingUpIcon size={20} color="#0b5394" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px' }}>
                Live Profit &amp; Loss (P&amp;L)
              </h3>
              <span
                style={{
                  background: isProfit ? '#f0fdf4' : '#fef2f2',
                  color: isProfit ? '#16a34a' : '#dc2626',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: `1px solid ${isProfit ? '#bbf7d0' : '#fecaca'}`,
                }}
              >
                {displayPeriodLabel()}
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Real-time margins: Seafood Sales + Wastage vs Worker Wages + Ice Procurement
            </p>
          </div>
        </div>

        {/* Action Controls & Preset Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="Refresh P&L calculation"
            style={{ height: '34px', width: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <RefreshIcon size={14} color="#0b5394" spinning={refreshing || loading} />
          </button>

          <div
            style={{
              display: 'flex',
              background: '#f1f5f9',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              gap: '2px',
              flexWrap: 'wrap',
            }}
          >
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'single_day', label: '📅 Single Day' },
              { id: 'custom', label: '🗓️ Range' },
            ].map((pItem) => {
              const active = period === pItem.id;
              return (
                <button
                  key={pItem.id}
                  type="button"
                  onClick={() => handlePeriodChange(pItem.id)}
                  style={{
                    background: active ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: active ? 800 : 600,
                    color: active ? '#0b5394' : '#64748b',
                    cursor: 'pointer',
                    boxShadow: active ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {pItem.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Sub-Toolbar for Single Day Selection */}
      {period === 'single_day' && (
        <form
          onSubmit={handleApplySingleDate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            padding: '12px 14px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            marginBottom: '18px',
          }}
        >
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>
            Inspect Specific Date:
          </span>
          <input
            type="date"
            className="form-input"
            value={singleDate}
            onChange={(e) => setSingleDate(e.target.value)}
            style={{ width: 'auto', height: '34px', fontSize: '0.82rem', padding: '0 10px' }}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{ background: '#0b5394', fontWeight: 800, height: '34px', padding: '0 14px' }}
          >
            Load Day
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const t = getTodayStr();
              setSingleDate(t);
              loadPnl({ period: 'single_day', startDate: t, endDate: t });
            }}
            style={{ height: '34px', fontSize: '0.76rem', fontWeight: 700 }}
          >
            Today
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const y = new Date();
              y.setDate(y.getDate() - 1);
              const yStr = y.toISOString().split('T')[0];
              setSingleDate(yStr);
              loadPnl({ period: 'single_day', startDate: yStr, endDate: yStr });
            }}
            style={{ height: '34px', fontSize: '0.76rem', fontWeight: 700 }}
          >
            Yesterday
          </button>
        </form>
      )}

      {/* 3. Sub-Toolbar for Custom Date Range */}
      {period === 'custom' && (
        <form
          onSubmit={handleApplyCustomRange}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '12px 14px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            marginBottom: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569' }}>From:</span>
            <input
              type="date"
              className="form-input"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              style={{ width: 'auto', height: '34px', fontSize: '0.82rem', padding: '0 10px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569' }}>To:</span>
            <input
              type="date"
              className="form-input"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={{ width: 'auto', height: '34px', fontSize: '0.82rem', padding: '0 10px' }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{ background: '#0b5394', fontWeight: 800, height: '34px', padding: '0 16px' }}
          >
            Apply Range
          </button>
        </form>
      )}

      {/* 4. Main Body */}
      {loading ? (
        <div style={{ padding: '36px 0', textAlign: 'center' }}>
          <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 10px' }} />
          <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Calculating profit &amp; loss metrics...</span>
        </div>
      ) : (
        <>
          {/* Bento KPI Grid (Matching stat-card-compact of Dashboard) */}
          <div className="dashboard-stats-grid" style={{ marginBottom: '20px' }}>
            {/* 1. Total Revenue Card */}
            <div className="stat-card-compact">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="stat-label" style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Revenue
                  </span>
                  <div className="stat-value" style={{ fontSize: '1.55rem', fontWeight: 900, color: '#059669', marginTop: '4px', letterSpacing: '-0.5px' }}>
                    <CountUp value={revenue.totalRevenue} isCurrency />
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
                  <TrendingUpIcon size={18} />
                </div>
              </div>

              <div className="stat-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                  Invoices: {formatCurrency(revenue.invoiceSales)} • Wastage: {formatCurrency(revenue.wastageSales)}
                </span>
                <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                  {revenue.invoiceCount || 0} Bills
                </span>
              </div>
            </div>

            {/* 2. Total Operating Costs Card */}
            <div className="stat-card-compact">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="stat-label" style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Operating Expenses
                  </span>
                  <div className="stat-value" style={{ fontSize: '1.55rem', fontWeight: 900, color: '#c2410c', marginTop: '4px', letterSpacing: '-0.5px' }}>
                    <CountUp value={expenses.totalExpenses} isCurrency />
                  </div>
                </div>
                <div
                  className="stat-icon"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    color: '#ea580c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ScaleIcon size={18} />
                </div>
              </div>

              <div className="stat-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                  Wages: {formatCurrency(expenses.staffWages)} • Ice: {formatCurrency(expenses.iceExpenses)}
                </span>
                <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                  {expenses.iceBlocks || 0} Blocks
                </span>
              </div>
            </div>

            {/* 3. Net Profit / Loss Card */}
            <div className="stat-card-compact">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="stat-label" style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Net {isProfit ? 'Profit' : 'Loss'}
                  </span>
                  <div
                    className="stat-value"
                    style={{
                      fontSize: '1.55rem',
                      fontWeight: 900,
                      color: isProfit ? '#047857' : '#b91c1c',
                      marginTop: '4px',
                      letterSpacing: '-0.5px',
                    }}
                  >
                    <CountUp value={Math.abs(pnl.netProfit)} isCurrency prefix={isProfit ? '+ ' : '- '} />
                  </div>
                </div>
                <div
                  className="stat-icon"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: isProfit ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${isProfit ? '#a7f3d0' : '#fecaca'}`,
                    color: isProfit ? '#059669' : '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isProfit ? <TrendingUpIcon size={18} /> : <TrendingDownIcon size={18} />}
                </div>
              </div>

              <div className="stat-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.74rem', color: isProfit ? '#059669' : '#dc2626', fontWeight: 700 }}>
                  {isProfit ? 'Operating in surplus' : 'Expenses exceed sales'}
                </span>
                <span
                  style={{
                    background: isProfit ? '#ecfdf5' : '#fef2f2',
                    color: isProfit ? '#059669' : '#dc2626',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {isProfit ? 'Surplus' : 'Deficit'}
                </span>
              </div>
            </div>

            {/* 4. Operating Margin % Card */}
            <div className="stat-card-compact">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="stat-label" style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Operating Margin
                  </span>
                  <div className="stat-value" style={{ fontSize: '1.55rem', fontWeight: 900, color: '#0b5394', marginTop: '4px', letterSpacing: '-0.5px' }}>
                    {pnl.marginPercent}%
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
                  <CalendarIcon size={18} />
                </div>
              </div>

              <div className="stat-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                  Margin on {formatCurrency(revenue.totalRevenue)} sales
                </span>
                <span
                  style={{
                    background: '#eff6ff',
                    color: '#0b5394',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {pnl.marginPercent >= 20 ? 'Healthy' : pnl.marginPercent > 0 ? 'Moderate' : 'Low'}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Breakdown Section: Single Day vs Multi-Day */}
          {period === 'single_day' ? (
            /* Single Day Operational Breakdown Card */
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                  Operational Breakdown for {displayPeriodLabel()}
                </h4>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                  Seafood Sales vs Factory Costs
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  marginBottom: '14px',
                }}
              >
                {/* A. Seafood Invoices */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontSize: '0.76rem', fontWeight: 800 }}>
                    <InvoiceIcon size={14} /> Seafood Sales (Invoices)
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
                    {formatCurrency(revenue.invoiceSales)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {revenue.invoiceCount || 0} bills generated
                  </div>
                </div>

                {/* B. Wastage Head Sales */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontSize: '0.76rem', fontWeight: 800 }}>
                    <ScaleIcon size={14} /> Prawn Head Wastage
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
                    {formatCurrency(revenue.wastageSales)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {data?.revenue?.wastageKg || 0} KG sold
                  </div>
                </div>

                {/* C. Worker Wages */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ea580c', fontSize: '0.76rem', fontWeight: 800 }}>
                    <StaffIcon size={14} /> Worker Peeling Labor
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
                    {formatCurrency(expenses.staffWages)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {data?.expenses?.staffEntries || 0} shifts recorded
                  </div>
                </div>

                {/* D. Ice Procurement */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ea580c', fontSize: '0.76rem', fontWeight: 800 }}>
                    <IceIcon size={14} /> Ice Procurement
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
                    {formatCurrency(expenses.iceExpenses)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {data?.expenses?.iceBlocks || 0} blocks consumed
                  </div>
                </div>
              </div>

              {/* Day Bottom Balance Strip */}
              <div
                style={{
                  background: isProfit ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${isProfit ? '#a7f3d0' : '#fecaca'}`,
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isProfit ? '#065f46' : '#991b1b' }}>
                  Day Inflow ({formatCurrency(revenue.totalRevenue)}) − Day Costs ({formatCurrency(expenses.totalExpenses)})
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: isProfit ? '#047857' : '#b91c1c' }}>
                  Net Margin: {isProfit ? '+' : ''}{formatCurrency(pnl.netProfit)} ({pnl.marginPercent}%)
                </div>
              </div>
            </div>
          ) : (
            /* Multi-Day Performance Breakdown Table */
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>
                  Daily Timeline &amp; Profit Margins ({data?.timeline?.length || 0} active days)
                </div>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Click &ldquo;Inspect&rdquo; to view detailed operational breakdown for that day
                </span>
              </div>

              {!data?.timeline || data.timeline.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
                  <CalendarIcon size={32} color="#cbd5e1" />
                  <div style={{ margin: '8px 0 2px 0', fontWeight: 700, fontSize: '0.9rem' }}>
                    No recorded operations for this period
                  </div>
                  <p style={{ margin: 0, fontSize: '0.76rem' }}>
                    Try selecting &ldquo;This Month&rdquo; or pick a custom date range above.
                  </p>
                </div>
              ) : (
                <div className="table-container" style={{ margin: 0, border: 'none' }}>
                  <table className="table" style={{ margin: 0, fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ fontWeight: 800, color: '#475569' }}>Date</th>
                        <th className="text-right" style={{ fontWeight: 800, color: '#166534' }}>Revenue (Inflow)</th>
                        <th className="text-right" style={{ fontWeight: 800, color: '#9a3412' }}>Operating Costs</th>
                        <th className="text-right" style={{ fontWeight: 800, color: '#0f172a' }}>Net Profit / Loss</th>
                        <th className="text-center" style={{ fontWeight: 800, color: '#475569' }}>Margin %</th>
                        <th className="text-center" style={{ fontWeight: 800, color: '#475569', width: '90px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.timeline.map((day) => {
                        const dayProfit = day.netProfit >= 0;
                        let formattedDate = day.date;
                        try {
                          formattedDate = new Date(day.date).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          });
                        } catch (e) {}

                        return (
                          <tr key={day.date} style={{ transition: 'background 0.15s ease' }}>
                            <td style={{ fontWeight: 800, color: '#1e293b' }}>
                              {formattedDate}
                            </td>
                            <td className="text-right">
                              <div style={{ fontWeight: 800, color: '#15803d' }}>
                                {formatCurrency(day.revenue)}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                Bills: {formatCurrency(day.invoiceSales)} • Waste: {formatCurrency(day.wastageSales)}
                              </div>
                            </td>
                            <td className="text-right">
                              <div style={{ fontWeight: 800, color: '#c2410c' }}>
                                {formatCurrency(day.expenses)}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                Wages: {formatCurrency(day.staffWages)} • Ice: {formatCurrency(day.iceExpenses)}
                              </div>
                            </td>
                            <td className="text-right" style={{ fontWeight: 900, color: dayProfit ? '#047857' : '#b91c1c' }}>
                              {dayProfit ? '+' : ''}{formatCurrency(day.netProfit)}
                            </td>
                            <td className="text-center">
                              <span
                                style={{
                                  background: dayProfit ? '#ecfdf5' : '#fef2f2',
                                  color: dayProfit ? '#059669' : '#dc2626',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 800,
                                  fontSize: '0.74rem',
                                  display: 'inline-block',
                                }}
                              >
                                {day.marginPercent}%
                              </span>
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleDrilldownDay(day.date)}
                                title={`Inspect detailed breakdown for ${day.date}`}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.74rem',
                                  fontWeight: 800,
                                  color: '#0b5394',
                                }}
                              >
                                Inspect ↗
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
