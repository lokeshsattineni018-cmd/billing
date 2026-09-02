import { useState, useEffect } from 'react';
import { activityLogsAPI } from '../services/api';
import { useToast, Toast } from '../utils/helpers';

const ACTION_CONFIG = {
  CREATE_BILL: { emoji: '📝', color: '#16a34a', bg: '#dcfce7', label: 'created Invoice' },
  EDIT_BILL: { emoji: '✏️', color: '#0284c7', bg: '#e0f2fe', label: 'edited Invoice' },
  VOID_BILL: { emoji: '⛔', color: '#dc2626', bg: '#fee2e2', label: 'voided Invoice' },
  UPDATE_PAYMENT_STATUS: { emoji: '💰', color: '#d97706', bg: '#fef3c7', label: 'updated payment for Invoice' },
  SET_CREDIT_LIMIT: { emoji: '🏦', color: '#9333ea', bg: '#f3e8ff', label: 'set credit limit for' },
  UPDATE_SETTINGS: { emoji: '⚙️', color: '#475569', bg: '#f1f5f9', label: 'updated settings' },
  EXPORT_CSV: { emoji: '📊', color: '#475569', bg: '#f1f5f9', label: 'exported CSV report' },
  EXPORT_TALLY: { emoji: '📑', color: '#0b5394', bg: '#dbeafe', label: 'exported Tally data' },
  SEND_REMINDER: { emoji: '📲', color: '#059669', bg: '#dcfce7', label: 'sent payment reminder for Invoice' },
  CREATE_USER: { emoji: '👤', color: '#16a34a', bg: '#dcfce7', label: 'created user account' },
  DELETE_USER: { emoji: '🗑️', color: '#dc2626', bg: '#fee2e2', label: 'deleted user account' },
  UPDATE_USER: { emoji: '👤', color: '#0284c7', bg: '#e0f2fe', label: 'updated user account' },
  RESET_PASSWORD: { emoji: '🔑', color: '#d97706', bg: '#fef3c7', label: 'reset password for' },
};

function getRelativeDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today - target) / 86400000);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function buildSentence(log) {
  const cfg = ACTION_CONFIG[log.action] || { label: log.action, emoji: '📋' };
  let sentence = `${cfg.label}`;

  if (log.targetId && ['CREATE_BILL', 'EDIT_BILL', 'VOID_BILL', 'UPDATE_PAYMENT_STATUS', 'SEND_REMINDER'].includes(log.action)) {
    sentence += ` #${log.targetId}`;
  }

  if (log.details?.customer) sentence += ` for ${log.details.customer}`;
  if (log.details?.amount) sentence += ` (₹${Number(log.details.amount).toLocaleString('en-IN')})`;
  if (log.details?.status) sentence += ` → ${log.details.status}`;
  if (log.details?.reason) sentence += ` — "${log.details.reason}"`;
  if (log.details?.creditLimit !== undefined) sentence += ` ₹${Number(log.details.creditLimit).toLocaleString('en-IN')}`;
  if (log.details?.count) sentence += ` (${log.details.count} records)`;

  return sentence;
}

export default function ActivityLog() {
  const { toast, showToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  useEffect(() => {
    loadLogs(page, actionFilter, roleFilter);
  }, [page, actionFilter, roleFilter]);

  const loadLogs = async (p = 1, act = '', role = '') => {
    setLoading(true);
    try {
      const res = await activityLogsAPI.list({ page: p, action: act, userRole: role, limit: 30 });
      setLogs(res.data.logs);
      setTotalPages(res.data.totalPages || 1);
      setTotalLogs(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
      showToast('Failed to load activity logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Group logs by date
  const grouped = {};
  logs.forEach((log) => {
    const key = getRelativeDate(log.createdAt);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(log);
  });

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            📋 Activity Timeline
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>
            Live audit trail of all staff, owner & admin actions
          </p>
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>
          Total: <span style={{ color: '#0b5394' }}>{totalLogs}</span> actions
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>Action Type</label>
          <select className="form-select" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
            <option value="">All Actions</option>
            <option value="CREATE_BILL">Create Bill</option>
            <option value="EDIT_BILL">Edit Bill</option>
            <option value="VOID_BILL">Void Bill</option>
            <option value="UPDATE_PAYMENT_STATUS">Payment Status</option>
            <option value="SET_CREDIT_LIMIT">Credit Limit</option>
            <option value="EXPORT_CSV">Export CSV</option>
            <option value="EXPORT_TALLY">Export Tally</option>
            <option value="SEND_REMINDER">Send Reminder</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>User Role</label>
          <select className="form-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
            <option value="">All Roles</option>
            <option value="admin">Admin Only</option>
            <option value="owner">Owner Only</option>
            <option value="staff">Staff Only</option>
          </select>
        </div>
        {(actionFilter || roleFilter) && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end', marginBottom: '2px' }}
            onClick={() => { setActionFilter(''); setRoleFilter(''); setPage(1); }}>
            Reset Filters
          </button>
        )}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="spinner" style={{ minHeight: '300px' }}></div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          No activity logs found for the selected filters.
        </div>
      ) : (
        <div>
          {Object.entries(grouped).map(([dateLabel, dateLogs]) => (
            <div key={dateLabel} style={{ marginBottom: '24px' }}>
              {/* Date Header */}
              <div style={{
                fontSize: '0.78rem', fontWeight: 800, color: '#0b5394', textTransform: 'uppercase',
                letterSpacing: '0.06em', marginBottom: '12px', paddingLeft: '4px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0b5394', display: 'inline-block' }}></span>
                {dateLabel}
                <span style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></span>
              </div>

              {/* Timeline Items */}
              <div style={{ paddingLeft: '18px', borderLeft: '2px solid #e2e8f0', marginLeft: '3px' }}>
                {dateLogs.map((log) => {
                  const cfg = ACTION_CONFIG[log.action] || { emoji: '📋', color: '#64748b', bg: '#f1f5f9' };
                  return (
                    <div key={log._id} style={{
                      position: 'relative', padding: '10px 14px', marginBottom: '8px',
                      background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '10px',
                      marginLeft: '16px', transition: 'box-shadow 0.2s',
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      {/* Dot connector */}
                      <div style={{
                        position: 'absolute', left: '-26px', top: '14px',
                        width: '12px', height: '12px', borderRadius: '50%',
                        background: cfg.color, border: '2px solid #ffffff',
                        boxShadow: '0 0 0 2px ' + cfg.bg,
                      }}></div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ flex: 1 }}>
                          {/* User + Action */}
                          <div style={{ fontSize: '0.9rem', lineHeight: 1.45 }}>
                            <span style={{ fontWeight: 800, color: '#0f172a' }}>{log.userName}</span>
                            <span style={{
                              display: 'inline-block', fontSize: '0.7rem', fontWeight: 700,
                              padding: '1px 6px', borderRadius: '4px', marginLeft: '6px',
                              background: log.userRole === 'admin' ? '#dbeafe' : log.userRole === 'owner' ? '#dcfce7' : '#f1f5f9',
                              color: log.userRole === 'admin' ? '#0b5394' : log.userRole === 'owner' ? '#16a34a' : '#64748b',
                            }}>
                              {log.userRole}
                            </span>
                            <span style={{ color: '#475569', marginLeft: '6px' }}>
                              {cfg.emoji} {buildSentence(log)}
                            </span>
                          </div>
                        </div>

                        {/* Time */}
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {formatTime(log.createdAt)}
                        </div>
                      </div>

                      {/* IP (subtle) */}
                      {log.ip && (
                        <div style={{ fontSize: '0.68rem', color: '#cbd5e1', fontFamily: 'monospace', marginTop: '2px' }}>
                          {log.ip}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ← Previous
              </button>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#64748b' }}>
                Page {page} of {totalPages}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
