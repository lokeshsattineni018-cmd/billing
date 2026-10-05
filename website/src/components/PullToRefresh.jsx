import { useState, useRef, useEffect } from 'react';

/**
 * Mobile-first Pull-to-Refresh wrapper container
 * Adds a pull down to refresh gesture for mobile and touch devices
 */
export default function PullToRefresh({ onRefresh, children, disabled = false }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const THRESHOLD = 65;

  const handleTouchStart = (e) => {
    if (disabled || refreshing) return;
    // Only allow pull-down when scrolled to the very top of the window
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollTop <= 2) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    } else {
      isPulling.current = false;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling.current || disabled || refreshing) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - touchStartY.current;

    if (delta > 0) {
      // Apply rubber-band resistance curve
      const pull = Math.min(delta * 0.45, 90);
      setPullY(pull);
      if (pull >= THRESHOLD && pullY < THRESHOLD) {
        if (navigator.vibrate) navigator.vibrate(12);
      }
    } else {
      setPullY(0);
      isPulling.current = false;
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling.current || disabled || refreshing) return;
    isPulling.current = false;

    if (pullY >= THRESHOLD) {
      setRefreshing(true);
      setPullY(45); // Keep visible during refresh
      if (navigator.vibrate) navigator.vibrate([15, 30]);
      try {
        if (onRefresh) await onRefresh();
      } finally {
        setRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative', width: '100%', minHeight: '100%' }}
    >
      {/* Pull Indicator */}
      <div
        style={{
          position: 'fixed',
          top: `${Math.max(0, pullY - 45)}px`,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9998,
          pointerEvents: 'none',
          opacity: pullY > 10 ? 1 : 0,
          transition: isPulling.current ? 'none' : 'top 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
          border: '1.5px solid #0b5394',
        }}
      >
        {refreshing ? (
          <div
            className="spinner"
            style={{
              width: '18px',
              height: '18px',
              borderWidth: '2.5px',
              borderColor: '#0b5394 #bfdbfe #bfdbfe #bfdbfe',
            }}
          />
        ) : (
          <span
            style={{
              fontSize: '1.1rem',
              color: '#0b5394',
              transform: `rotate(${Math.min(pullY * 3, 180)}deg)`,
              transition: 'transform 0.1s',
              display: 'inline-block',
              lineHeight: 1,
            }}
          >
            ↓
          </span>
        )}
      </div>

      <div
        style={{
          transform: `translateY(${pullY * 0.4}px)`,
          transition: isPulling.current ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
