import { useState, useRef } from 'react';

/**
 * Mobile Swipeable Item wrapper
 * Allows swiping left on list items to reveal quick action buttons
 */
export default function SwipeableItem({ children, actions = [], disabled = false }) {
  const [translateX, setTranslateX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isSwiping = useRef(false);

  // Maximum width of exposed action drawer
  const MAX_REVEAL = actions.length * 64;

  const handleTouchStart = (e) => {
    if (disabled || actions.length === 0) return;
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    isSwiping.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isSwiping.current || disabled) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;

    if (isOpen) {
      // Swiping right from open state
      const newPos = -MAX_REVEAL + diff;
      setTranslateX(Math.min(0, Math.max(-MAX_REVEAL - 20, newPos)));
    } else {
      // Swiping left from closed state
      if (diff < 0) {
        setTranslateX(Math.max(-MAX_REVEAL - 20, diff));
      } else {
        setTranslateX(0);
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping.current || disabled) return;
    isSwiping.current = false;
    const diff = currentX.current - startX.current;

    if (isOpen) {
      if (diff > 40) {
        setIsOpen(false);
        setTranslateX(0);
      } else {
        setTranslateX(-MAX_REVEAL);
      }
    } else {
      if (diff < -50) {
        setIsOpen(true);
        setTranslateX(-MAX_REVEAL);
        if (navigator.vibrate) navigator.vibrate(10);
      } else {
        setTranslateX(0);
      }
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTranslateX(0);
  };

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '12px',
        marginBottom: '10px',
      }}
    >
      {/* Background Actions Drawer (Revealed on Swipe Left) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: `${MAX_REVEAL}px`,
          display: 'flex',
          alignItems: 'stretch',
          zIndex: 1,
        }}
      >
        {actions.map((act, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
              if (act.onClick) act.onClick();
            }}
            style={{
              flex: 1,
              border: 'none',
              background: act.background || '#0b5394',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '6px',
            }}
            title={act.label}
          >
            {act.icon}
            <span>{act.label}</span>
          </button>
        ))}
      </div>

      {/* Foreground Swipeable Content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (isOpen) handleClose();
        }}
        style={{
          position: 'relative',
          zIndex: 2,
          background: '#ffffff',
          transform: `translateX(${translateX}px)`,
          transition: isSwiping.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
