import { useState, useEffect } from 'react';
import { activityLogsAPI } from '../services/api';
import { formatDateTime, useToast, Toast } from '../utils/helpers';

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
      const res = await activityLogsAPI.list({
        page: p,
        action: act,
        userRole: role,
        limit: 30,
      });
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

  const getActionBadge = (action) => {
    switch (action) {
      case 'CREATE_BILL':
        return <span className="badge" style={{ background: '#dcfce7', color: '#16a34a', fontWeight: 800 }}>➕ Created Bill</span>;
      case 'EDIT_BILL':
        return <span className="badge" style={{ background: '#e0f2fe', color: '#0284c7', fontWeight: 800 }}>✏️ Edited Bill</span>;
      case 'VOID_BILL':
        return <span className="badge" style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 800 }}>⛔ Voided Bill</span>;
      case 'UPDATE_PAYMENT_STATUS':
        return <span className="badge" style={{ background: '#fef3c7', color: '#d97706', fontWeight: 800 }}>💳 Payment Update</span>;
      case 'SET_CREDIT_LIMIT':
        return <span className="badge" style={{ background: '#f3e8ff', color: '#9333ea', fontWeight: 800 }}>⚙️ Credit Limit</span>;
      case 'EXPORT_CSV':
        return <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontWeight: 800 }}>📊 Exported CSV</span>;
      case 'EXPORT_TALLY':
        return <span className="badge" style={{ background: '#f1f5f9', color: '#0b5394', fontWeight: 800 }}>💼 Exported Tally</span>;
      case 'SEND_REMINDER':
        return <span className="badge" style={{ background: '#dcfce7', color: '#059669', fontWeight: 800 }}>📢 Sent Reminder</span>;
      default:
        return <span className="badge">{action}</span>;
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <span style={{ color: '#0b5394', fontWeight: 800, fontSize: '0.82rem' }}>👑 Admin</span>;
      case 'owner':
        return <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.82rem' }}>👔 Owner</span>;
      default:
        return <span style={{ color: '#64748b', fontWeight: 700, fontSize: '0.82rem' }}>👤 Staff</span>;
    }
  };

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            📜 Multi-User Activity & Audit Log
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>
            Complete chronological audit trail of all staff, owner, and admin actions (Admin Exclusive)
          </p>
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>
          Total Actions Logged: <span style={{ color: '#0b5394' }}>{totalLogs}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>Action Type</label>
          <select
            className="form-select"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
          >
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
          <select
            className="form-select"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Roles</option>
            <option value="admin">Admin Only</option>
            <option value="owner">Owner Only</option>
            <option value="staff">Staff Only</option>
          </select>
        </div>

        {(actionFilter || roleFilter) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ alignSelf: 'flex-end', marginBottom: '2px' }}
            onClick={() => {
              setActionFilter('');
              setRoleFilter('');
              setPage(1);
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Logs Timeline Table */}
      {loading ? (
        <div className="spinner" style={{ minHeight: '300px' }}></div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          No activity logs found for the selected filter criteria.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '170px' }}>Date & Time</th>
                  <th style={{ width: '160px' }}>User & Role</th>
                  <th style={{ width: '160px' }}>Action</th>
                  <th>Target / Details</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{log.userName}</div>
                      <div>{getRoleBadge(log.userRole)}</div>
                    </td>
                    <td>{getActionBadge(log.action)}</td>
                    <td>
                      {log.targetId && (
                        <span style={{ fontWeight: 700, color: '#0b5394', marginRight: '6px' }}>
                          #{log.targetId}
                        </span>
                      )}
                      <span style={{ fontSize: '0.84rem', color: '#334155' }}>
                        {log.details?.customer && `• Customer: ${log.details.customer} `}
                        {log.details?.amount && `• Amount: ₹${Number(log.details.amount).toLocaleString('en-IN')} `}
                        {log.details?.status && `• Status: ${log.details.status} `}
                        {log.details?.reason && `• Reason: "${log.details.reason}" `}
                        {log.details?.creditLimit !== undefined && `• Limit: ₹${Number(log.details.creditLimit).toLocaleString('en-IN')} `}
                        {log.details?.count && `• Total records: ${log.details.count}`}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                      {log.ip || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </button>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#64748b' }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
