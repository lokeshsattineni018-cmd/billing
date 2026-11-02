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
    url: '/ledger',
  });
}

/**
 * Triggered when a new invoice is generated
 */
export function notifyNewBillCreated(billNumber, customerName, totalAmount) {
  sendBrowserNotification(`📄 New Invoice #${billNumber}`, {
    body: `Bill generated for ${customerName || 'Customer'} — ₹${Number(totalAmount).toLocaleString('en-IN')}`,
    tag: `bill-${billNumber}`,
    url: '/bills',
  });
}

/**
 * Triggered when offline shed mode entries are synced to the cloud
 */
export function notifySyncComplete(itemCount) {
  if (!itemCount) return;
  sendBrowserNotification('☁️ Offline Entries Synced', {
    body: `Successfully synchronized ${itemCount} offline record(s) to the server.`,
    tag: `sync-${Date.now()}`,
  });
}

/**
 * Triggered on backup completion or error
 */
export function notifyBackupResult(success, message) {
  sendBrowserNotification(success ? '✅ Backup Completed' : '⚠️ Backup Alert', {
    body: message || (success ? 'System backup saved successfully.' : 'Backup encountered an issue.'),
    tag: `backup-${Date.now()}`,
    url: '/settings',
  });
}

/**
 * Triggered when staff wage payouts are completed
 */
export function notifyWageBatchPaid(workerCount, totalAmount) {
  sendBrowserNotification('👥 Worker Wages Settled', {
    body: `Paid ₹${Number(totalAmount).toLocaleString('en-IN')} across ${workerCount} worker(s).`,
    tag: `wages-${Date.now()}`,
    url: '/staff',
  });
}

/**
 * Triggered when a customer crosses warning credit threshold
 */
export function notifyCreditAlert(customerName, balance) {
  sendBrowserNotification('⚠️ High Credit Alert', {
    body: `${customerName} outstanding balance has reached ₹${Number(balance).toLocaleString('en-IN')}.`,
    tag: `credit-${customerName}`,
    url: '/ledger',
  });
}


