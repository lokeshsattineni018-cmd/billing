/**
 * Browser Push & Local Notifications Utility
 */

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    return { success: false, reason: 'unsupported' };
  }

  try {
    const permission = await Notification.requestPermission();
    return { success: permission === 'granted', permission };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Notification permission request error:', err);
    }
    return { success: false, reason: 'error', error: err };
  }
}

export function sendBrowserNotification(title, options = {}) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const defaultOptions = {
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      ...options,
    };

    const notification = new Notification(title, defaultOptions);

    notification.onclick = function (event) {
      event.preventDefault();
      window.focus();
      if (options.url) {
        window.location.href = options.url;
      }
      notification.close();
    };

    return true;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('Failed to dispatch notification:', err);
    }
    return false;
  }
}

/**
 * Triggered when a customer payment is recorded
 */
export function notifyPaymentReceived(customerName, amount) {
  sendBrowserNotification('💰 Payment Received!', {
    body: `Received ₹${Number(amount).toLocaleString('en-IN')} from ${customerName || 'Customer'}.`,
    tag: `payment-${Date.now()}`,
    url: '/bills',
  });
}

/**
 * Triggered when a new invoice is generated
 */
export function notifyInvoiceCreated(billNo, customerName, total) {
  sendBrowserNotification(`🧾 Invoice #${billNo} Created`, {
    body: `Total: ₹${Number(total).toLocaleString('en-IN')} for ${customerName || 'Customer'}.`,
    tag: `bill-${billNo}`,
    url: '/bills',
  });
}

/**
 * Check for overdue bills and show reminder alert
 */
export function notifyOverdueBills(overdueBills = []) {
  if (!overdueBills || overdueBills.length === 0) return;

  const count = overdueBills.length;
  const totalAmount = overdueBills.reduce((sum, b) => sum + (b.grandTotal || b.total || 0), 0);

  sendBrowserNotification(`⚠️ ${count} Overdue Invoice${count > 1 ? 's' : ''}`, {
    body: `Total pending: ₹${totalAmount.toLocaleString('en-IN')}. Tap to view outstanding list.`,
    tag: 'overdue-bills-alert',
    url: '/bills',
  });
}
