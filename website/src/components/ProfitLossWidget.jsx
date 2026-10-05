import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import CountUp from './CountUp';

export default function ProfitLossWidget() {
  const [period, setPeriod] = useState('this_month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadPnl() {
      setLoading(true);
      try {
        const res = await dashboardAPI.getProfitLoss({ period });
        if (isMounted) setData(res.data);
      } catch (err) {
        // failed to load
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadPnl();
    return () => {
      isMounted = false;
    };
  }, [period]);

  const pnl = data?.pnl || { netProfit: 0, marginPercent: 0, status: 'PROFIT' };
  const revenue = data?.revenue || { totalRevenue: 0, invoiceSales: 0, wastageSales: 0 };
  const expenses = data?.expenses || { totalExpenses: 0, staffWages: 0, iceExpenses: 0 };
  const isProfit = pnl.netProfit >= 0;

  return (
    <div
      className="card fade-in"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* Header & Period Switcher */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: isProfit ? '#ecfdf5' : '#fef2f2',
              color: isProfit ? '#059669' : '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              fontWeight: 900,
            }}
          >
            {isProfit ? '📈' : '📉'}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
              Live Profit & Loss (P&L) Command
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Real-time Margins: Seafood Sales + Wastage vs Labor + Ice Costs
            </p>
          </div>
        </div>

        {/* Period Filter Buttons */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', gap: '2px' }}>
          {[
            { key: 'today', label: 'Today' },
            { key: 'this_week', label: 'This Week' },
            { key: 'this_month', label: 'This Month' },
          ].map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => setPeriod(btn.key)}
              style={{
                border: 'none',
                background: period === btn.key ? '#ffffff' : 'transparent',
                color: period === btn.key ? '#0b5394' : '#64748b',
                fontWeight: period === btn.key ? 800 : 600,
                fontSize: '0.78rem',
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: period === btn.key ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center' }}>
          <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 10px' }} />
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Calculating live profit & loss...</span>
        </div>
      ) : (
        <>
          {/* Main 4 Summary Tiles */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '14px',
              marginBottom: '18px',
            }}
          >
            {/* 1. Total Revenue Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '0.76rem', color: '#166534', fontWeight: 800, textTransform: 'uppercase' }}>
                Total Revenue
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#15803d', margin: '4px 0' }}>
                <CountUp value={revenue.totalRevenue} isCurrency />
              </div>
              <div style={{ fontSize: '0.74rem', color: '#166534' }}>
                Invoices: {formatCurrency(revenue.invoiceSales)} • Wastage: {formatCurrency(revenue.wastageSales)}
              </div>
            </div>

            {/* 2. Total Operating Expenses Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                border: '1px solid #fed7aa',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '0.76rem', color: '#9a3412', fontWeight: 800, textTransform: 'uppercase' }}>
                Total Operating Costs
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#c2410c', margin: '4px 0' }}>
                <CountUp value={expenses.totalExpenses} isCurrency />
              </div>
              <div style={{ fontSize: '0.74rem', color: '#9a3412' }}>
                Wages: {formatCurrency(expenses.staffWages)} • Ice: {formatCurrency(expenses.iceExpenses)}
              </div>
            </div>

            {/* 3. Net Profit / Loss Card */}
            <div
              style={{
                background: isProfit
                  ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
                  : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                border: `1.5px solid ${isProfit ? '#6ee7b7' : '#fca5a5'}`,
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div
                style={{
                  fontSize: '0.76rem',
                  color: isProfit ? '#065f46' : '#991b1b',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              >
                Net {isProfit ? 'Profit' : 'Loss'}
              </div>
              <div
                style={{
                  fontSize: '1.45rem',
                  fontWeight: 900,
                  color: isProfit ? '#047857' : '#b91c1c',
                  margin: '4px 0',
                }}
              >
                <CountUp value={Math.abs(pnl.netProfit)} isCurrency prefix={isProfit ? '+ ' : '- '} />
              </div>
              <div style={{ fontSize: '0.74rem', color: isProfit ? '#065f46' : '#991b1b', fontWeight: 700 }}>
                {isProfit ? 'Operating in surplus' : 'Expenses exceed sales'}
              </div>
            </div>

            {/* 4. Profit Margin % Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                border: '1px solid #bfdbfe',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '0.76rem', color: '#1e40af', fontWeight: 800, textTransform: 'uppercase' }}>
                Operating Profit Margin
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1d4ed8', margin: '4px 0' }}>
                {pnl.marginPercent}%
              </div>
              <div style={{ fontSize: '0.74rem', color: '#1e40af' }}>
                Margin on {formatCurrency(revenue.totalRevenue)} sales
              </div>
            </div>
          </div>

          {/* Daily Timeline Mini Bars */}
          {data?.timeline && data.timeline.length > 0 && (
            <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '10px' }}>
                Daily Trend & Net Margins ({data.timeline.length} days recorded)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.timeline.slice(-7).map((day) => {
                  const dayProfit = day.netProfit >= 0;
                  const maxVal = Math.max(day.revenue, day.expenses, 1);
                  const revWidth = Math.min(100, Math.round((day.revenue / maxVal) * 100));
                  const expWidth = Math.min(100, Math.round((day.expenses / maxVal) * 100));

                  return (
                    <div
                      key={day.date}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 1fr 100px 70px',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '0.76rem',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: '#64748b' }}>
                        {new Date(day.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </span>

                      {/* Visual Bars */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div
                            style={{
                              height: '7px',
                              width: `${revWidth}%`,
                              background: '#22c55e',
                              borderRadius: '4px',
                              minWidth: '4px',
                            }}
                          />
                          <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700 }}>
                            {formatCurrency(day.revenue)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div
                            style={{
                              height: '7px',
                              width: `${expWidth}%`,
                              background: '#f97316',
                              borderRadius: '4px',
                              minWidth: '4px',
                            }}
                          />
                          <span style={{ fontSize: '0.7rem', color: '#ea580c', fontWeight: 700 }}>
                            {formatCurrency(day.expenses)}
                          </span>
                        </div>
                      </div>

                      {/* Net Amount */}
                      <span
                        style={{
                          textAlign: 'right',
                          fontWeight: 800,
                          color: dayProfit ? '#059669' : '#dc2626',
                        }}
                      >
                        {dayProfit ? '+' : ''}
                        {formatCurrency(day.netProfit)}
                      </span>

                      {/* Margin % */}
                      <span
                        style={{
                          textAlign: 'right',
                          fontWeight: 800,
                          background: dayProfit ? '#ecfdf5' : '#fef2f2',
                          color: dayProfit ? '#059669' : '#dc2626',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                        }}
                      >
                        {day.marginPercent}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
