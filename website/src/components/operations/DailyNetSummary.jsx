import { useState, useEffect } from 'react';
import { staffAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useLanguage } from '../../context/LanguageContext';
import { StaffIcon, IceIcon, ScaleIcon, RefreshIcon } from '../Icons';

export default function DailyNetSummary() {
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDailySummary();
  }, [selectedDate]);

  const loadDailySummary = async () => {
    setLoading(true);
    try {
      const res = await staffAPI.getDailyOperations({ date: selectedDate });
      setData(res.data);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load daily operations summary:', err);
      }
    }
    setLoading(false);
  };

  const laborWages = data?.labor?.totalWages || 0;
  const iceCost = data?.ice?.totalCost || 0;
  const totalOperatingCosts = Math.round((laborWages + iceCost) * 100) / 100;
  const wastageRevenue = data?.wastage?.totalRevenue || 0;
  const netSurplus = Math.round((wastageRevenue - totalOperatingCosts) * 100) / 100;
  const isProfit = netSurplus > 0;
  const isLoss = netSurplus < 0;
  const absNet = Math.abs(netSurplus);

  return (
    <div>
      {/* Date Header Picker */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Daily Factory Operations & Net Balance
          </h3>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.84rem' }}>
            Consolidated overview: Worker wages + Ice expenses minus Prawn head byproduct sales
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#475569' }}>Inspect Date:</label>
          <input
            type="date"
            className="form-input"
            style={{ width: 'auto', height: '36px', fontSize: '0.85rem' }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadDailySummary}
            title="Refresh"
          >
            <RefreshIcon size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
          <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
          <p style={{ fontWeight: 600 }}>Calculating Daily Operations Summary...</p>
        </div>
      ) : (
        <>
          {/* Main Net Financial Health Card (Clean White Design) */}
          <div
            className="card"
            style={{
              padding: '20px',
              marginBottom: '20px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderLeft: `5px solid ${isProfit ? '#16a34a' : isLoss ? '#dc2626' : '#0b5394'}`,
              color: '#0f172a',
              borderRadius: '14px',
              boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    Date: {formatDate(selectedDate)}
                  </span>
                  <span
                    className={`badge ${isProfit ? 'badge-green' : isLoss ? 'badge-amber' : 'badge-blue'}`}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    {isProfit ? 'PROFIT / SURPLUS ✨' : isLoss ? 'NET EXPENSE' : 'BREAK-EVEN'}
                  </span>
                </div>
                <h2 style={{ margin: '10px 0 4px 0', fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>
                  {isProfit ? 'Net Factory Profit' : isLoss ? 'Net Factory Operating Cost' : 'Factory Break-Even'}
                </h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.84rem' }}>
                  {isProfit
                    ? `Prawn Head Wastage Revenue (+${formatCurrency(wastageRevenue)}) exceeded all factory expenses (${formatCurrency(totalOperatingCosts)})`
                    : isLoss
                    ? `(Worker Wages + Ice Blocks Cost) - Prawn Head Wastage Revenue`
                    : `Wastage byproduct revenue perfectly balanced all factory operating costs`}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  {isProfit ? 'Net Daily Profit' : isLoss ? 'Net Daily Expense' : 'Net Daily Balance'}
                </div>
                <div
                  style={{
                    fontSize: '1.9rem',
                    fontWeight: 900,
                    marginTop: '4px',
                    letterSpacing: '-0.5px',
                    color: isProfit ? '#16a34a' : isLoss ? '#dc2626' : '#0f172a',
                  }}
                >
                  {isProfit ? `+ ${formatCurrency(absNet)}` : isLoss ? `- ${formatCurrency(absNet)}` : '₹0.00'}
                </div>
              </div>
            </div>

            {/* Quick Flow Bar */}
            <div
              style={{
                marginTop: '16px',
                paddingTop: '14px',
                borderTop: '1px solid #f1f5f9',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>Total Factory Outflow</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>
                  {formatCurrency(totalOperatingCosts)}
                </div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>Total Wastage Inflow</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                  + {formatCurrency(wastageRevenue)}
                </div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>Wastage Cost Recovery</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                  {totalOperatingCosts > 0 ? `${Math.round((wastageRevenue / totalOperatingCosts) * 100)}%` : '0%'}
                  {isProfit && (
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, marginLeft: '6px', color: '#16a34a' }}>
                      (Full Coverage + Profit)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Three Component Breakdown Grid (Clean White with Accent Borders) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {/* 1. Worker Labor Wages */}
            <div className="card" style={{ padding: '16px', border: '1px solid #e2e8f0', borderLeft: '4px solid #0b5394', borderRadius: '12px', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: '#f1f5f9', padding: '6px', borderRadius: '8px', color: '#0b5394' }}>
                    <StaffIcon size={18} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800 }}>1. Worker Labor Wages</h4>
                </div>
                <span className="badge badge-amber">Expense</span>
              </div>

              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', marginBottom: '10px' }}>
                {formatCurrency(laborWages)}
              </div>

              <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Workers Present:</span>
                  <strong>{data?.labor?.workerCount || 0} staff</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Weight Processed:</span>
                  <strong>{data?.labor?.totalKg || 0} kg</strong>
                </div>
              </div>
            </div>

            {/* 2. Ice Blocks Used */}
            <div className="card" style={{ padding: '16px', border: '1px solid #e2e8f0', borderLeft: '4px solid #0284c7', borderRadius: '12px', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: '#f1f5f9', padding: '6px', borderRadius: '8px', color: '#0284c7' }}>
                    <IceIcon size={18} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800 }}>2. Ice Blocks Used</h4>
                </div>
                <span className="badge badge-amber">Expense</span>
              </div>

              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', marginBottom: '10px' }}>
                {formatCurrency(iceCost)}
              </div>

              <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Ice Blocks Used:</span>
                  <strong>{data?.ice?.totalBlocks || 0} blocks</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Avg Rate / Block:</span>
                  <strong>
                    {data?.ice?.totalBlocks > 0
                      ? `₹${(iceCost / data.ice.totalBlocks).toFixed(2)}`
                      : '₹0.00'}
                  </strong>
                </div>
              </div>
            </div>

            {/* 3. Prawn Head Wastage Sold */}
            <div className="card" style={{ padding: '16px', border: '1px solid #e2e8f0', borderLeft: '4px solid #16a34a', borderRadius: '12px', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: '#f1f5f9', padding: '6px', borderRadius: '8px', color: '#16a34a' }}>
                    <ScaleIcon size={18} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800 }}>3. Prawn Head Wastage</h4>
                </div>
                <span className="badge badge-green">Revenue</span>
              </div>

              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16a34a', marginBottom: '10px' }}>
                + {formatCurrency(wastageRevenue)}
              </div>

              <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Wastage Sold:</span>
                  <strong>{data?.wastage?.totalKg || 0} kg</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Avg Selling Rate:</span>
                  <strong>
                    {data?.wastage?.totalKg > 0
                      ? `₹${(wastageRevenue / data.wastage.totalKg).toFixed(2)} / kg`
                      : '₹0.00'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
