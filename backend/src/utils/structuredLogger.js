/**
 * Structured JSON Logger for Production Observability
 * Emits standard machine-readable JSON logs for log ingestion systems
 * (Datadog, Render Logs, CloudWatch, Papertrail, Better Stack).
 */

const os = require('os');

function formatActor(req) {
  if (!req) return { type: 'system' };
  const user = req.user;
  const ip = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '';
  return {
    userId: user?._id?.toString() || 'unauthenticated',
    userName: user?.name || 'Anonymous',
    role: user?.role || 'none',
    ip: String(ip).split(',')[0].trim(),
    userAgent: req.headers?.['user-agent'] || 'unknown',
  };
}

function emitLog(level, event, message, metadata = {}, req = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'srsf-billing-backend',
    hostname: os.hostname(),
    event,
    message,
    actor: formatActor(req),
    data: metadata,
  };

  // Output as a single serialized line for standard cloud log collectors
  const jsonStr = JSON.stringify(logEntry);
  if (level === 'ERROR' || level === 'FATAL') {
    process.stderr.write(jsonStr + '\n');
  } else {
    process.stdout.write(jsonStr + '\n');
  }

  return logEntry;
}

const logger = {
  info: (event, message, data, req) => emitLog('INFO', event, message, data, req),
  warn: (event, message, data, req) => emitLog('WARN', event, message, data, req),
  error: (event, message, data, req) => emitLog('ERROR', event, message, data, req),

  /**
   * Dedicated structured logger for financial & billing operations
   */
  logBillOperation: (action, bill, req, extra = {}) => {
    emitLog(
      'INFO',
      `BILL_${action}`,
      `Bill #${bill.formattedBillNo || bill.billNo} ${action.toLowerCase()} by ${req?.user?.name || 'System'}`,
      {
        billId: bill._id?.toString(),
        billNo: bill.billNo,
        formattedBillNo: bill.formattedBillNo,
        companyName: bill.companyName,
        customerPhone: bill.customerPhone,
        total: bill.grandTotal || bill.total,
        paymentStatus: bill.paymentStatus,
        isVoided: !!bill.isVoided,
        itemCount: bill.items?.length || 0,
        ...extra,
      },
      req
    );
  },
};

module.exports = logger;
