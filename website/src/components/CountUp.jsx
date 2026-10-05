import { useEffect, useState, useRef } from 'react';
import { formatCurrency } from '../utils/helpers';

export default function CountUp({ value = 0, isCurrency = false, duration = 750, prefix = '', suffix = '' }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startVal = useRef(0);
  const targetVal = Number(value) || 0;

  useEffect(() => {
    let startTime = null;
    let animId = null;
    const initial = startVal.current;
    const diff = targetVal - initial;

    if (diff === 0) {
      setDisplayValue(targetVal);
      return;
    }

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // ease-out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round((initial + diff * easeProgress) * 100) / 100;
      setDisplayValue(current);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        startVal.current = targetVal;
        setDisplayValue(targetVal);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [targetVal, duration]);

  if (isCurrency) {
    return <span>{prefix}{formatCurrency(displayValue)}{suffix}</span>;
  }

  return <span>{prefix}{Math.round(displayValue).toLocaleString('en-IN')}{suffix}</span>;
}
