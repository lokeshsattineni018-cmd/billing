import { useEffect, useState, useRef } from 'react';

/**
 * AnimatedCounter component
 * Smoothly counts up from 0 (or previous value) to the target value.
 * Supports Currency (INR), Integers, custom formatters.
 */
export default function AnimatedCounter({
  value = 0,
  duration = 900,
  isCurrency = false,
  decimals = isCurrency ? 2 : 0,
  prefix = '',
  suffix = '',
  formatter = null,
  style = {},
  className = '',
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    const startVal = prevValueRef.current;
    const diff = target - startVal;

    if (diff === 0) {
      setDisplayValue(target);
      return;
    }

    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic: 1 - (1 - progress)^3
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startVal + diff * easeProgress;

      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(target);
        prevValueRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  const formatNumber = (num) => {
    if (formatter) return formatter(num);

    if (isCurrency) {
      const fixed = Number(num || 0).toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      return `₹ ${fixed}`;
    }

    if (decimals > 0) {
      return Number(num || 0).toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }

    return Math.round(num || 0).toLocaleString('en-IN');
  };

  return (
    <span className={className} style={{ display: 'inline-block', fontVariantNumeric: 'tabular-nums', ...style }}>
      {prefix}{formatNumber(displayValue)}{suffix}
    </span>
  );
}
