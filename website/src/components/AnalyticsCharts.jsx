import { useState, useMemo } from 'react';
import { formatCurrency } from '../utils/helpers';

/**
 * Generate smooth Catmull-Rom / Monotone cubic Bézier spline path
 */
function getCurvedPath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;

  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * High-End Modern Revenue Trend Area & Spline Chart
 */
export function RevenueTrendChart({ data = [], title = 'Revenue Analytics' }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const maxVal = useMemo(() => {
    if (!data || data.length === 0) return 10000;
    const max = Math.max(...data.map((d) => d.revenue || 0), 1000);
    // Round to clean ceiling
    return Math.ceil(max * 1.15);
  }, [data]);

  const totalPeriodRevenue = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data.reduce((sum, d) => sum + (d.revenue || 0), 0);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '40px 20px',
          textAlign: 'center',
          color: '#94a3b8',
          border: '1px solid #e2e8f0',
        }}
      >
        No transaction data recorded for this period.
      </div>
    );
  }

  const width = 640;
  const height = 240;
  const padLeft = 60;
  const padRight = 24;
  const padTop = 30;
  const padBottom = 34;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const points = data.map((d, idx) => {
    const x = padLeft + (idx / Math.max(data.length - 1, 1)) * chartW;
    const y = padTop + chartH - ((d.revenue || 0) / maxVal) * chartH;
    return { x, y, data: d, index: idx };
  });

  const linePath = getCurvedPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)},${(padTop + chartH).toFixed(1)} L ${points[0].x.toFixed(1)},${(padTop + chartH).toFixed(1)} Z`;

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  // Format compact Y-axis numbers
  const formatY = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(val % 100000 === 0 ? 0 : 1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
    return `₹${val}`;
  };

  const yTicks = [1, 0.66, 0.33, 0];

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        borderRadius: '16px',
        padding: '22px 24px',
        boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.05)',
        position: 'relative',
      }}
    >
      {/* Chart Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {title}
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', letterSpacing: '-0.5px' }}>
            {formatCurrency(totalPeriodRevenue)}
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginLeft: '8px' }}>
              period total
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 800,
            }}
          >
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#16a34a' }} />
            Peak: {formatCurrency(Math.max(...data.map((d) => d.revenue || 0)))}
          </span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Luminous Area Gradient */}
            <linearGradient id="modernAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b5394" stopOpacity="0.32" />
              <stop offset="50%" stopColor="#2563eb" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>

            {/* Line Glow Stroke Gradient */}
            <linearGradient id="modernLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0b5394" />
              <stop offset="50%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            {/* Soft Drop Shadow Filter for Line */}
            <filter id="lineShadow" x="-10%" y="-10%" width="130%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0b5394" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Scale */}
          {yTicks.map((pct, i) => {
            const y = padTop + chartH * (1 - pct);
            const val = maxVal * pct;
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1.2"
                  strokeDasharray={i === yTicks.length - 1 ? 'none' : '4 4'}
                />
                <text
                  x={padLeft - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="9.5"
                  fontWeight="600"
                  fill="#94a3b8"
                >
                  {formatY(val)}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaPath} fill="url(#modernAreaGrad)" />

          {/* Smooth Bézier Curve Line */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#modernLineGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#lineShadow)"
          />

          {/* Vertical Crosshair Guide on Hover */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={padTop}
                x2={activePoint.x}
                y2={padTop + chartH}
                stroke="#0b5394"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.6"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="7"
                fill="rgba(11, 83, 148, 0.2)"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="4.5"
                fill="#ffffff"
                stroke="#0b5394"
                strokeWidth="2.5"
              />
            </g>
          )}

          {/* Data Points & Interactive Touch Zones */}
          {points.map((pt, idx) => {
            const isHovered = hoverIndex === idx;
            return (
              <g key={idx}>
                {/* Visible Node */}
                {!isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="3.5"
                    fill="#ffffff"
                    stroke="#0b5394"
                    strokeWidth="2"
                  />
                )}

                {/* X-axis Labels */}
                <text
                  x={pt.x}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isHovered ? '800' : '600'}
                  fill={isHovered ? '#0b5394' : '#64748b'}
                >
                  {pt.data.label}
                </text>

                {/* Invisible wide hit target for seamless mouse hover */}
                <rect
                  x={pt.x - chartW / (points.length * 2)}
                  y={0}
                  width={chartW / Math.max(points.length - 1, 1)}
                  height={height}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoverIndex(idx)}
                />
              </g>
            );
          })}
        </svg>

        {/* High-End Dark Floating Tooltip */}
        {activePoint && (
          <div
            style={{
              position: 'absolute',
              left: `${(activePoint.x / width) * 100}%`,
              top: `${Math.max(10, ((activePoint.y - 45) / height) * 100)}%`,
              transform: 'translate(-50%, -100%)',
              background: '#0f172a',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              boxShadow: '0 10px 20px rgba(0,0,0,0.25)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 10,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '2px', fontWeight: 600 }}>
              {activePoint.data.label}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#38bdf8' }}>
              {formatCurrency(activePoint.data.revenue)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '2px' }}>
              {activePoint.data.count || 0} invoices created
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Modern Radial / Donut Collection Health Gauge
 */
export function PaymentStatusDonut({ paid = 0, pending = 0 }) {
  const total = paid + pending || 1;
  const paidPct = Math.round((paid / total) * 100);
  const pendingPct = 100 - paidPct;

  // SVG circle calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (paidPct / 100) * circumference;

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        borderRadius: '16px',
        padding: '22px 24px',
        boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Payment Health
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
          Collection Ratio
        </div>
      </div>

      {/* Modern Circular Ring */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '20px 0', position: 'relative' }}>
        <div style={{ position: 'relative', width: '130px', height: '130px' }}>
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <defs>
              <linearGradient id="paidGaugeGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>

            {/* Background Track (Pending) */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#fef3c7"
              strokeWidth="9"
            />

            {/* Filled Track (Paid) */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="url(#paidGaugeGrad)"
              strokeWidth="9"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>

          {/* Central KPI */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
              {paidPct}%
            </div>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', marginTop: '3px' }}>
              Collected
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f0fdf4',
            border: '1px solid #dcfce7',
            padding: '8px 12px',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534' }}>Cleared (Paid)</span>
          </div>
          <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#15803d' }}>
            {formatCurrency(paid)} ({paidPct}%)
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            padding: '8px 12px',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e' }}>Pending (Credit)</span>
          </div>
          <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#b45309' }}>
            {formatCurrency(pending)} ({pendingPct}%)
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Top Customers Leaderboard
 */
export function TopCustomersBarChart({ data = [] }) {
  const maxVal = Math.max(...data.map((d) => d.revenue || 0), 1);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        borderRadius: '16px',
        padding: '22px 24px',
        boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Leaderboard
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
            Top Buyers Ranking
          </div>
        </div>
        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>By Total Volume</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {data.slice(0, 5).map((item, idx) => {
          const pct = Math.min(100, Math.round((item.revenue / maxVal) * 100));
          const rankColors = [
            { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' }, // 1st
            { bg: '#f8fafc', text: '#334155', border: '#e2e8f0' }, // 2nd
            { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' }, // 3rd
            { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' }, // 4th
            { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' }, // 5th
          ];
          const rank = rankColors[idx] || rankColors[3];

          return (
            <div key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, paddingRight: '12px' }}>
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      background: rank.bg,
                      border: `1px solid ${rank.border}`,
                      color: rank.text,
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </span>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontWeight: 900, color: '#0b5394', fontSize: '0.92rem' }}>
                    {formatCurrency(item.revenue)}
                  </span>
                </div>
              </div>

              {/* Progress Bar Track */}
              <div style={{ height: '7px', width: '100%', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: idx === 0
                      ? 'linear-gradient(90deg, #0b5394 0%, #3b82f6 100%)'
                      : 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
                    borderRadius: '4px',
                    transition: 'width 0.8s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
