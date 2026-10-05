import { useState, useMemo } from 'react';
import { formatCurrency, formatDate } from '../utils/helpers';
import { useLanguage } from '../context/LanguageContext';
import { StaffIcon, PrintIcon, CheckIcon, CloseIcon } from './Icons';

export default function StaffAttendanceCalendar({ entries = [], staffNames = [], defaultWorker = '' }) {
  const { t } = useLanguage();

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedWorker, setSelectedWorker] = useState(defaultWorker || (staffNames[0]?.staffName || staffNames[0] || ''));
  const [showSlipModal, setShowSlipModal] = useState(false);

  // Available worker names
  const workerList = useMemo(() => {
    const fromNames = (staffNames || []).map((w) => (typeof w === 'string' ? w : w.staffName)).filter(Boolean);
    const fromEntries = (entries || []).map((e) => e.staffName).filter(Boolean);
    const unique = Array.from(new Set([...fromNames, ...fromEntries])).sort();
    return unique;
  }, [staffNames, entries]);

  // Ensure selected worker is set if not already
  const activeWorker = selectedWorker || workerList[0] || '';

  // Calendar calculations
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Map entries for selected worker by date (YYYY-MM-DD)
  const workerEntriesByDate = useMemo(() => {
    const map = {};
    if (!activeWorker) return map;

    entries.forEach((entry) => {
      if (entry.staffName?.toLowerCase() === activeWorker.toLowerCase()) {
        const dateStr = entry.date ? entry.date.split('T')[0] : '';
        if (dateStr) {
          if (!map[dateStr]) map[dateStr] = [];
          map[dateStr].push(entry);
        }
      }
    });

    return map;
  }, [entries, activeWorker]);

  // Aggregate monthly stats for selected worker
  const monthlyStats = useMemo(() => {
    let daysPresent = 0;
    let totalKg = 0;
    let totalEarnings = 0;
    let totalPaid = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const dateKey = `${currentYear}-${monthStr}-${dayStr}`;

      const dayEntries = workerEntriesByDate[dateKey];
      if (dayEntries && dayEntries.length > 0) {
        daysPresent++;
        dayEntries.forEach((e) => {
          totalKg += e.quantity || 0;
          totalEarnings += e.totalAmount || 0;
          if (e.paymentStatus === 'Paid') {
            totalPaid += e.totalAmount || 0;
          } else if (e.paymentStatus === 'Partial') {
            totalPaid += e.amountPaid || 0;
          }
        });
      }
    }

    const avgDailyKg = daysPresent > 0 ? (totalKg / daysPresent).toFixed(1) : 0;
    const unpaidAmount = Math.max(0, totalEarnings - totalPaid);

    return {
      daysPresent,
      totalKg: Math.round(totalKg * 100) / 100,
      totalEarnings: Math.round(totalEarnings),
      totalPaid: Math.round(totalPaid),
      unpaidAmount: Math.round(unpaidAmount),
      avgDailyKg,
    };
  }, [workerEntriesByDate, currentYear, currentMonth, daysInMonth]);

  // Build calendar cells (empty blanks before day 1 + days of month)
  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push({ type: 'empty', key: `empty-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const dateKey = `${currentYear}-${monthStr}-${dayStr}`;
    const dayEntries = workerEntriesByDate[dateKey] || [];
    const isPresent = dayEntries.length > 0;
    const dayKg = dayEntries.reduce((sum, e) => sum + (e.quantity || 0), 0);
    const dayWage = dayEntries.reduce((sum, e) => sum + (e.totalAmount || 0), 0);

    calendarCells.push({
      type: 'day',
      day,
      dateKey,
      isPresent,
      dayKg,
      dayWage,
      entries: dayEntries,
      key: dateKey,
    });
  }

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="attendance-calendar-container fade-in">
      {/* Header Controls: Worker Selection & Month Switcher */}
      <div
        className="card"
        style={{
          padding: '18px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Worker Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0b5394', whiteSpace: 'nowrap' }}>
            👤 {t('selectWorker') || 'Select Worker'}:
          </label>
          <select
            className="form-input"
            value={activeWorker}
            onChange={(e) => setSelectedWorker(e.target.value)}
            style={{
              padding: '8px 14px',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: '#0f172a',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              minWidth: '200px',
              background: '#f8fafc',
            }}
          >
            {workerList.length === 0 ? (
              <option value="">No workers found</option>
            ) : (
              workerList.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Month Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handlePrevMonth}
            style={{ padding: '6px 12px', fontWeight: 800, fontSize: '0.9rem', borderRadius: '8px' }}
            title="Previous Month"
          >
            ‹
          </button>
          <span
            style={{
              fontSize: '1rem',
              fontWeight: 800,
              color: '#0b5394',
              minWidth: '150px',
              textAlign: 'center',
            }}
          >
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleNextMonth}
            style={{ padding: '6px 12px', fontWeight: 800, fontSize: '0.9rem', borderRadius: '8px' }}
            title="Next Month"
          >
            ›
          </button>

          {activeWorker && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowSlipModal(true)}
              style={{
                marginLeft: '8px',
                padding: '7px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                background: '#0b5394',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
              }}
            >
              <PrintIcon size={14} color="#ffffff" />
              {t('wageSlip') || 'Wage Slip'}
            </button>
          )}
        </div>
      </div>

      {/* Worker Monthly Summary KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div
          className="card"
          style={{
            padding: '16px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '12px',
          }}
        >
          <div style={{ fontSize: '0.76rem', color: '#166534', fontWeight: 800, textTransform: 'uppercase' }}>
            📅 {t('presentDays') || 'Days Present'}
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#15803d', marginTop: '4px' }}>
            {monthlyStats.daysPresent}{' '}
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#166534' }}>
              / {daysInMonth} days
            </span>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
          }}
        >
          <div style={{ fontSize: '0.76rem', color: '#1e40af', fontWeight: 800, textTransform: 'uppercase' }}>
            ⚖️ {t('totalKgProcessed') || 'Total KG Processed'}
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1d4ed8', marginTop: '4px' }}>
            {monthlyStats.totalKg.toLocaleString('en-IN')}{' '}
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>KG</span>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px',
            background: '#fefce8',
            border: '1px solid #fef08a',
            borderRadius: '12px',
          }}
        >
          <div style={{ fontSize: '0.76rem', color: '#854d0e', fontWeight: 800, textTransform: 'uppercase' }}>
            💰 {t('totalWagesEarned') || 'Total Wages Earned'}
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#a16207', marginTop: '4px' }}>
            {formatCurrency(monthlyStats.totalEarnings)}
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px',
            background: monthlyStats.unpaidAmount > 0 ? '#fff1f2' : '#f8fafc',
            border: `1px solid ${monthlyStats.unpaidAmount > 0 ? '#fecdd3' : '#e2e8f0'}`,
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              fontSize: '0.76rem',
              color: monthlyStats.unpaidAmount > 0 ? '#9f1239' : '#64748b',
              fontWeight: 800,
              textTransform: 'uppercase',
            }}
          >
            ⏳ {t('unpaidWages') || 'Pending Balance'}
          </div>
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 900,
              color: monthlyStats.unpaidAmount > 0 ? '#e11d48' : '#059669',
              marginTop: '4px',
            }}
          >
            {monthlyStats.unpaidAmount > 0 ? formatCurrency(monthlyStats.unpaidAmount) : '✓ Cleared'}
          </div>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div
        className="card"
        style={{
          padding: '20px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          overflowX: 'auto',
        }}
      >
        <div style={{ minWidth: '640px' }}>
          {/* Day of Week Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px',
              marginBottom: '10px',
              textAlign: 'center',
            }}
          >
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, idx) => (
              <div
                key={d}
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: idx === 0 ? '#ef4444' : '#64748b',
                  textTransform: 'uppercase',
                  padding: '6px 0',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px',
            }}
          >
            {calendarCells.map((cell) => {
              if (cell.type === 'empty') {
                return (
                  <div
                    key={cell.key}
                    style={{
                      height: '84px',
                      background: '#f8fafc',
                      borderRadius: '10px',
                      border: '1px dashed #f1f5f9',
                      opacity: 0.4,
                    }}
                  />
                );
              }

              const { day, isPresent, dayKg, dayWage } = cell;

              return (
                <div
                  key={cell.key}
                  style={{
                    minHeight: '84px',
                    padding: '8px',
                    borderRadius: '10px',
                    background: isPresent ? '#f0fdf4' : '#ffffff',
                    border: `1.5px solid ${isPresent ? '#86efac' : '#e2e8f0'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: isPresent ? '0 2px 6px rgba(34, 197, 94, 0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: isPresent ? 900 : 700,
                        color: isPresent ? '#15803d' : '#94a3b8',
                      }}
                    >
                      {day}
                    </span>
                    {isPresent && (
                      <span
                        style={{
                          background: '#22c55e',
                          color: '#ffffff',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 900,
                        }}
                        title="Present"
                      >
                        ✓
                      </span>
                    )}
                  </div>

                  {isPresent ? (
                    <div style={{ marginTop: '4px' }}>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          color: '#166534',
                          background: '#dcfce7',
                          padding: '2px 5px',
                          borderRadius: '4px',
                          marginBottom: '2px',
                          display: 'inline-block',
                        }}
                      >
                        {dayKg} KG
                      </div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0b5394' }}>
                        {formatCurrency(dayWage)}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: '#cbd5e1',
                        textAlign: 'center',
                        marginTop: 'auto',
                        paddingBottom: '4px',
                      }}
                    >
                      —
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Printable Wage Slip Modal */}
      {showSlipModal && (
        <div className="modal-backdrop" onClick={() => setShowSlipModal(false)}>
          <div
            className="modal-content fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', padding: '24px' }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0b5394' }}>
                  📑 {t('wageSlip') || 'Worker Monthly Wage Slip'}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  VIJAYA DURGA AGENCIES • Labor Statement
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowSlipModal(false)}
                style={{ padding: '6px' }}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {/* Slip Paper Content */}
            <div
              id="printable-wage-slip"
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '20px',
                marginBottom: '16px',
              }}
            >
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0b5394', paddingBottom: '12px', marginBottom: '14px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0b5394' }}>
                  VIJAYA DURGA AGENCIES
                </h2>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                  Seafood Processing & Billing Center
                </div>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
                  WAGE STATEMENT FOR: {monthNames[currentMonth].toUpperCase()} {currentYear}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '0.88rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Worker Name: </span>
                  <strong style={{ color: '#0f172a' }}>{activeWorker}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Days Present: </span>
                  <strong style={{ color: '#16a34a' }}>{monthlyStats.daysPresent} days</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Total Processed: </span>
                  <strong style={{ color: '#0b5394' }}>{monthlyStats.totalKg} KG</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Daily Avg Output: </span>
                  <strong>{monthlyStats.avgDailyKg} KG/day</strong>
                </div>
              </div>

              {/* Total Financials */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>Total Wages Payable</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0b5394' }}>
                    {formatCurrency(monthlyStats.totalEarnings)}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>Payment Status</div>
                  <div
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      color: monthlyStats.unpaidAmount === 0 ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {monthlyStats.unpaidAmount === 0
                      ? '✓ Fully Paid'
                      : `Pending: ${formatCurrency(monthlyStats.unpaidAmount)}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSlipModal(false)}
                style={{ padding: '8px 16px', fontWeight: 700 }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePrintSlip}
                style={{
                  padding: '8px 18px',
                  fontWeight: 800,
                  background: '#0b5394',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <PrintIcon size={16} color="#ffffff" />
                {t('printWageSlip') || 'Print Slip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
