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
  const netDailyExpense = Math.round((totalOperatingCosts - wastageRevenue) * 100) / 100;

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
          {/* Main Net Financial Health Card */}
          <div
            className="card"
            style={{
              padding: '24px',
              marginBottom: '24px',
              background: 'linear-gradient(135deg, #0b5394 0%, #1e40af 100%)',
              color: '#ffffff',
              borderRadius: '14px',
              boxShadow: '0 8px 24px rgba(11, 83, 148, 0.22)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.18)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Date: {formatDate(selectedDate)}
                </span>
                <h2 style={{ margin: '10px 0 4px 0', fontSize: '1.8rem', fontWeight: 900 }}>
                  Net Factory Operating Cost
                </h2>
                <p style={{ margin: 0, opacity: 0.9, fontSize: '0.86rem' }}>
                  (Worker Wages + Ice Blocks Cost) - Prawn Head Wastage Revenue
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase' }}>
                  Net Daily Balance
                </div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, marginTop: '4px', letterSpacing: '-0.5px' }}>
                  {formatCurrency(netDailyExpense)}
                </div>
              </div>
            </div>

            {/* Quick Flow Bar */}
            <div
              style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ opacity: 0.8, fontSize: '0.75rem', fontWeight: 700 }}>Total Factory Outflow</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fca5a5' }}>
                  {formatCurrency(totalOperatingCosts)}
                </div>
              </div>

              <div>
                <div style={{ opacity: 0.8, fontSize: '0.75rem', fontWeight: 700 }}>Total Wastage Inflow</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#86efac' }}>
                  + {formatCurrency(wastageRevenue)}
                </div>
              </div>

              <div>
                <div style={{ opacity: 0.8, fontSize: '0.75rem', fontWeight: 700 }}>Wastage Cost Recovery</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                  {totalOperatingCosts > 0 ? `${Math.round((wastageRevenue / totalOperatingCosts) * 100)}%` : '0%'}
                </div>
              </div>
            </div>
          </div>

          {/* Three Component Breakdown Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            {/* 1. Worker Labor Wages */}
            <div className="card" style={{ padding: '20px', borderTop: '4px solid #0b5394' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '8px', color: '#0b5394' }}>
                    <StaffIcon size={18} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800 }}>1. Worker Labor Wages</h4>
                </div>
                <span className="badge badge-blue">Expense</span>
              </div>

              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0b5394', marginBottom: '12px' }}>
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
            <div className="card" style={{ padding: '20px', borderTop: '4px solid #0284c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: '#e0f2fe', padding: '6px', borderRadius: '8px', color: '#0284c7' }}>
                    <IceIcon size={18} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800 }}>2. Ice Blocks Used</h4>
                </div>
                <span className="badge badge-blue">Expense</span>
              </div>

              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0284c7', marginBottom: '12px' }}>
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
            <div className="card" style={{ padding: '20px', borderTop: '4px solid #16a34a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '8px', color: '#16a34a' }}>
                    <ScaleIcon size={18} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800 }}>3. Prawn Head Wastage</h4>
                </div>
                <span className="badge badge-green">Revenue</span>
              </div>

              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#16a34a', marginBottom: '12px' }}>
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
