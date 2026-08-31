import { useState } from 'react';
import { formatCurrency } from '../utils/helpers';

/**
 * Responsive SVG Line & Area Chart for Revenue Trends
 */
export function RevenueTrendChart({ data = [], title = 'Revenue Trend' }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
        No data available for the selected period
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.revenue || 0), 1000);
  const width = 600;
  const height = 220;
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = data.map((d, idx) => {
    const x = paddingX + (idx / Math.max(data.length - 1, 1)) * chartWidth;
    const y = height - paddingY - ((d.revenue || 0) / maxVal) * chartHeight;
    return { x, y, data: d };
  });

  const pathD = points.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{title}</h4>
        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
          Peak: {formatCurrency(maxVal)}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0b5394" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0b5394" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = height - paddingY - pct * chartHeight;
          return (
            <line
              key={i}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="#f1f5f9"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#areaGradient)" />

        {/* Trend Line */}
        <path d={pathD} fill="none" stroke="#0b5394" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((pt, idx) => (
          <g key={idx} onMouseEnter={() => setHoveredPoint(pt)} onMouseLeave={() => setHoveredPoint(null)} style={{ cursor: 'pointer' }}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={hoveredPoint === pt ? 6 : 4}
              fill="#ffffff"
              stroke="#0b5394"
              strokeWidth={hoveredPoint === pt ? 3 : 2}
            />
            {/* X-axis labels */}
            <text
              x={pt.x}
              y={height - 8}
              textAnchor="middle"
              fontSize="9"
              fill="#64748b"
              fontWeight="600"
            >
              {pt.data.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredPoint && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '16px',
            background: '#0f172a',
            color: '#ffffff',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {hoveredPoint.data.label}: {formatCurrency(hoveredPoint.data.revenue)} ({hoveredPoint.data.count} bills)
        </div>
      )}
    </div>
  );
}

/**
 * Top Customers Comparison Bar Chart
 */
export function TopCustomersBarChart({ data = [] }) {
  const maxVal = Math.max(...data.map((d) => d.revenue || 0), 1);

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
        🏆 Top Buyers Breakdown
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.slice(0, 5).map((item, idx) => {
          const pct = Math.min(100, Math.round((item.revenue / maxVal) * 100));
          return (
            <div key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 700, marginBottom: '4px' }}>
                <span style={{ color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '65%' }}>
                  {idx + 1}. {item.name}
                </span>
                <span style={{ color: '#0b5394' }}>{formatCurrency(item.revenue)}</span>
              </div>
              <div style={{ height: '8px', width: '100%', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, #0b5394 0%, #3b82f6 100%)',
                    borderRadius: '4px',
                    transition: 'width 0.6s ease',
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

/**
 * Payment Collection Status Donut / Breakdown Chart
 */
export function PaymentStatusDonut({ paid = 0, pending = 0 }) {
  const total = paid + pending || 1;
  const paidPct = Math.round((paid / total) * 100);
  const pendingPct = 100 - paidPct;

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
        💳 Collection Ratio
      </h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ position: 'relative', width: '90px', height: '90px', flexShrink: 0 }}>
          <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#fef3c7" strokeWidth="4.5" />
            <circle
              cx="18"
              cy="18"
              r="15.915"
              fill="transparent"
              stroke="#16a34a"
              strokeWidth="4.5"
              strokeDasharray={`${paidPct} ${100 - paidPct}`}
              strokeDashoffset="0"
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              fontWeight: 800,
              fontSize: '0.85rem',
              color: '#0f172a',
            }}
          >
            {paidPct}%
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#16a34a' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }} />
              Paid: {formatCurrency(paid)} ({paidPct}%)
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#d97706' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706' }} />
              Pending: {formatCurrency(pending)} ({pendingPct}%)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
