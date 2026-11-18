// Route chunk prefetching utilities for instant navigation
export const loadNewBill = () => import('../pages/NewBill');
export const loadBillHistory = () => import('../pages/BillHistory');

let hasPrefetched = false;

/**
 * Prefetches high-traffic core routes (NewBill, BillHistory) during browser idle time.
 * Uses requestIdleCallback with a 2-second timeout fallback.
 */
export function prefetchCoreRoutes() {
  if (typeof window === 'undefined') return;
  if (hasPrefetched) return;
  hasPrefetched = true;

  const runIdle = (callback) => {
    if (typeof window.requestIdleCallback === 'function') {
      return window.requestIdleCallback(callback, { timeout: 2000 });
    }
    return setTimeout(callback, 100);
  };

  runIdle(() => {
    // Initiate chunk download and parsing in the background
    loadNewBill().catch(() => {});
    loadBillHistory().catch(() => {});
  });
}

/**
 * Resets the prefetch guard (useful for logout/re-login transitions).
 */
export function resetPrefetchGuard() {
  hasPrefetched = false;
}
