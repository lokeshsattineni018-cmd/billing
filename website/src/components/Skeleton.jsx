import React from 'react';

/**
 * Base Shimmer Skeleton Line / Box
 */
export function Skeleton({ width = '100%', height = '16px', borderRadius = '6px', style = {}, className = '' }) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

/**
 * Skeleton for KPI Summary Cards (Dashboard, Reports, Staff Summary)
 */
export function SkeletonKPIGrid({ count = 4 }) {
  return (
    <div className="stats-grid" style={{ marginBottom: '24px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card stat-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <Skeleton width="45%" height="14px" />
            <Skeleton width="36px" height="36px" borderRadius="10px" />
          </div>
          <Skeleton width="70%" height="28px" style={{ marginBottom: '8px' }} />
          <Skeleton width="55%" height="12px" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for Data Tables (Bill History, Staff Entries, Customers)
 */
export function SkeletonTable({ rows = 6, cols = 5, hasHeader = true }) {
  return (
    <div className="card" style={{ padding: '20px', overflow: 'hidden' }}>
      {hasHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <Skeleton width="180px" height="22px" />
          <Skeleton width="120px" height="36px" borderRadius="8px" />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Table Header shimmer */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} height="14px" width={i === 0 ? '60%' : '80%'} />
          ))}
        </div>
        {/* Table Rows shimmer */}
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '16px', alignItems: 'center', padding: '8px 0' }}>
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                height="18px"
                width={c === 0 ? '70%' : c === cols - 1 ? '50%' : '85%'}
                borderRadius="4px"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for Chart sections (Dashboard, Analytics)
 */
export function SkeletonChart() {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <Skeleton width="160px" height="20px" style={{ marginBottom: '6px' }} />
          <Skeleton width="220px" height="12px" />
        </div>
        <Skeleton width="90px" height="32px" borderRadius="8px" />
      </div>
      <div style={{ height: '240px', display: 'flex', alignItems: 'flex-end', gap: '14px', paddingTop: '40px' }}>
        {[40, 65, 85, 50, 95, 75, 60].map((h, i) => (
          <Skeleton key={i} height={`${h}%`} width="100%" borderRadius="6px 6px 0 0" />
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton Card for generic panels
 */
export function SkeletonCard({ height = '180px' }) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <Skeleton width="40%" height="20px" style={{ marginBottom: '16px' }} />
      <Skeleton width="100%" height={height} borderRadius="10px" />
    </div>
  );
}

export default Skeleton;
