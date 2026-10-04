import { useState, useEffect } from 'react';
import { activityLogsAPI } from '../services/api';
import { useToast, Toast } from '../utils/helpers';
import { useLanguage } from '../context/LanguageContext';

const ACTION_CONFIG = {
  CREATE_BILL: { emoji: '📝', color: '#16a34a', bg: '#dcfce7', label: 'created Invoice', labelTe: 'ఇన్వాయిస్ బిల్లు తయారు చేశారు' },
  EDIT_BILL: { emoji: '✏️', color: '#0284c7', bg: '#e0f2fe', label: 'edited Invoice', labelTe: 'ఇన్వాయిస్ బిల్లు సవరించారు' },
  VOID_BILL: { emoji: '⛔', color: '#dc2626', bg: '#fee2e2', label: 'voided Invoice', labelTe: 'ఇన్వాయిస్ బిల్లు రద్దు చేశారు' },
  UPDATE_PAYMENT_STATUS: { emoji: '💰', color: '#d97706', bg: '#fef3c7', label: 'updated payment for Invoice', labelTe: 'ఇన్వాయిస్ చెల్లింపు స్థితి మార్చారు' },
  SET_CREDIT_LIMIT: { emoji: '🏦', color: '#9333ea', bg: '#f3e8ff', label: 'set credit limit for', labelTe: 'క్రెడిట్ పరిమితి నిర్ణయించారు:' },
  UPDATE_SETTINGS: { emoji: '⚙️', color: '#475569', bg: '#f1f5f9', label: 'updated settings', labelTe: 'సిస్టమ్ సెట్టింగ్స్ సవరించారు' },
  EXPORT_CSV: { emoji: '📊', color: '#475569', bg: '#f1f5f9', label: 'exported CSV report', labelTe: 'CSV నివేదిక ఎగుమతి చేశారు' },
  EXPORT_TALLY: { emoji: '📑', color: '#0b5394', bg: '#dbeafe', label: 'exported Tally data', labelTe: 'టాలీ XML ఎగుమతి చేశారు' },
  SEND_REMINDER: { emoji: '📲', color: '#059669', bg: '#dcfce7', label: 'sent payment reminder for Invoice', labelTe: 'చెల్లింపు రిమైండర్ పంపారు: ఇన్వాయిస్' },
  CREATE_USER: { emoji: '👤', color: '#16a34a', bg: '#dcfce7', label: 'created user account', labelTe: 'వినియోగదారు ఖాతా సృష్టించారు' },
  DELETE_USER: { emoji: '🗑️', color: '#dc2626', bg: '#fee2e2', label: 'deleted user account', labelTe: 'వినియోగదారు ఖాతా తొలగించారు' },
  UPDATE_USER: { emoji: '👤', color: '#0284c7', bg: '#e0f2fe', label: 'updated user account', labelTe: 'వినియోగదారు ఖాతా సవరించారు' },
  RESET_PASSWORD: { emoji: '🔑', color: '#d97706', bg: '#fef3c7', label: 'reset password for', labelTe: 'పాస్‌వర్డ్ రీసెట్ చేశారు:' },

  // Staff & Daily Operations Actions
  STAFF_WORK_RECORDED: { emoji: '👷', color: '#0b5394', bg: '#dbeafe', label: 'recorded Worker Wage entry', labelTe: 'కార్మికుని కూలీ పని నమోదు చేశారు' },
  STAFF_WORK_BULK_RECORDED: { emoji: '⚡', color: '#7c3aed', bg: '#ede9fe', label: 'recorded Bulk Staff Attendance', labelTe: 'బల్క్ సిబ్బంది హాజరు నమోదు చేశారు' },
  STAFF_WORK_UPDATED: { emoji: '✏️', color: '#0284c7', bg: '#e0f2fe', label: 'updated Worker Wage entry', labelTe: 'కార్మికుని కూలీ పని వివరాలు సవరించారు' },
  STAFF_WORK_PAYMENT_TOGGLED: { emoji: '💵', color: '#059669', bg: '#d1fae5', label: 'updated Wage Payment status', labelTe: 'కూలీ చెల్లింపు స్థితి మార్చారు' },
  STAFF_WORK_DELETED: { emoji: '🗑️', color: '#dc2626', bg: '#fee2e2', label: 'deleted Worker Wage entry', labelTe: 'కార్మికుని కూలీ ఎంట్రీ తొలగించారు' },

  // Ice Blocks Tracking Actions
  ICE_RECORDED: { emoji: '🧊', color: '#0284c7', bg: '#e0f2fe', label: 'recorded Ice Blocks purchase', labelTe: 'ఐస్ బ్లాకుల కొనుగోలు నమోదు చేశారు' },
  ICE_UPDATED: { emoji: '✏️', color: '#0284c7', bg: '#e0f2fe', label: 'updated Ice Blocks record', labelTe: 'ఐస్ బ్లాకుల రికార్డు సవరించారు' },
  ICE_DELETED: { emoji: '🗑️', color: '#dc2626', bg: '#fee2e2', label: 'deleted Ice Blocks record', labelTe: 'ఐస్ బ్లాకుల రికార్డు తొలగించారు' },

  // Prawn Head Wastage Tracking Actions
  WASTAGE_RECORDED: { emoji: '🦐', color: '#16a34a', bg: '#dcfce7', label: 'recorded Prawn Head Wastage sale', labelTe: 'రొయ్య తలల వేస్టేజ్ అమ్మకం నమోదు చేశారు' },
  WASTAGE_UPDATED: { emoji: '✏️', color: '#16a34a', bg: '#dcfce7', label: 'updated Wastage sale record', labelTe: 'వేస్టేజ్ అమ్మకం రికార్డు సవరించారు' },
  WASTAGE_DELETED: { emoji: '🗑️', color: '#dc2626', bg: '#fee2e2', label: 'deleted Wastage sale record', labelTe: 'వేస్టేజ్ అమ్మకం రికార్డు తొలగించారు' },
};

function getRelativeDate(dateStr, lang) {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today - target) / 86400000);

  if (diff === 0) return lang === 'te' ? 'ఈ రోజు' : 'Today';
  if (diff === 1) return lang === 'te' ? 'నిన్న' : 'Yesterday';
  return d.toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function buildSentence(log, lang) {
  const cfg = ACTION_CONFIG[log.action] || { label: log.action, labelTe: log.action, emoji: '📋' };
  const isTe = lang === 'te';

  if (isTe) {
    if (log.action === 'CREATE_BILL') {
      return `ఇన్వాయిస్ #${log.targetId}${log.details?.customer ? ' (' + log.details.customer + ')' : ''} తయారు చేశారు (${log.details?.amount ? '₹' + Number(log.details.amount).toLocaleString('en-IN') : ''})`;
    }
    if (log.action === 'EDIT_BILL') {
      return `ఇన్వాయిస్ #${log.targetId}${log.details?.customer ? ' (' + log.details.customer + ')' : ''} సవరించారు`;
    }
    if (log.action === 'VOID_BILL') {
      return `ఇన్వాయిస్ #${log.targetId} రద్దు చేశారు${log.details?.reason ? ' — "' + log.details.reason + '"' : ''}`;
    }
    if (log.action === 'UPDATE_PAYMENT_STATUS') {
      return `ఇన్వాయిస్ #${log.targetId} చెల్లింపు స్థితి మార్చారు → ${log.details?.status === 'Paid' ? 'చెల్లించబడింది' : 'బాకీ'}`;
    }
    if (log.action === 'STAFF_WORK_RECORDED') {
      return `${log.details?.staffName ? log.details.staffName + ' కి ' : ''}కూలీ పని నమోదు చేశారు (${log.details?.quantity ? log.details.quantity + ' కేజీలు' : ''} ${log.details?.price ? '@ ₹' + log.details.price : ''} = ₹${Number(log.details?.totalAmount || 0).toLocaleString('en-IN')})`;
    }
    if (log.action === 'STAFF_WORK_BULK_RECORDED') {
      return `బల్క్ సిబ్బంది హాజరు నమోదు చేశారు (${log.details?.count || 0} మంది కార్మికులు, మొత్తం ₹${Number(log.details?.totalAmount || 0).toLocaleString('en-IN')})`;
    }
    if (log.action === 'STAFF_WORK_UPDATED') {
      return `${log.details?.staffName ? log.details.staffName + ' కూలీ ' : ''}వివరాలు సవరించారు (మొత్తం ₹${Number(log.details?.totalAmount || 0).toLocaleString('en-IN')})`;
    }
    if (log.action === 'STAFF_WORK_PAYMENT_TOGGLED') {
      return `${log.details?.staffName ? log.details.staffName + ' కి ' : ''}కూలీ చెల్లింపు స్థితి మార్చారు → ${log.details?.status === 'Paid' ? 'చెల్లించబడింది' : 'బాకీ ఉంది'} (₹${Number(log.details?.amount || 0).toLocaleString('en-IN')})`;
    }
    if (log.action === 'STAFF_WORK_DELETED') {
      return `${log.details?.staffName ? log.details.staffName + ' కూలీ ' : ''}ఎంట్రీ తొలగించారు`;
    }
    if (log.action === 'ICE_RECORDED') {
      return `ఐస్ బ్లాకుల కొనుగోలు నమోదు చేశారు (${log.details?.blocks || 0} బ్లాకులు @ ₹${log.details?.rate || 0} = ₹${Number(log.details?.totalAmount || 0).toLocaleString('en-IN')}${log.details?.iceFrom ? ', ఎవరి నుండి: ' + log.details.iceFrom : ''}${log.details?.iceTo ? ', ఎవరికి: ' + log.details.iceTo : ''})`;
    }
    if (log.action === 'ICE_UPDATED') {
      return `ఐస్ బ్లాకుల రికార్డు సవరించారు (${log.details?.blocks || 0} బ్లాకులు, ₹${Number(log.details?.totalAmount || 0).toLocaleString('en-IN')})`;
    }
    if (log.action === 'ICE_DELETED') {
      return `ఐస్ బ్లాకుల రికార్డు తొలగించారు (${log.details?.blocks || 0} బ్లాకులు)`;
    }
    if (log.action === 'WASTAGE_RECORDED') {
      return `రొయ్య తలల వేస్టేజ్ అమ్మకం నమోదు చేశారు (${log.details?.quantityKg || 0} కేజీలు @ ₹${log.details?.rate || 0} = ₹${Number(log.details?.totalAmount || 0).toLocaleString('en-IN')}${log.details?.buyerName ? ', కొనుగోలుదారు: ' + log.details.buyerName : ''})`;
    }
    if (log.action === 'WASTAGE_UPDATED') {
      return `వేస్టేజ్ అమ్మకం రికార్డు సవరించారు (${log.details?.quantityKg || 0} కేజీలు, ₹${Number(log.details?.totalAmount || 0).toLocaleString('en-IN')})`;
    }
    if (log.action === 'WASTAGE_DELETED') {
      return `వేస్టేజ్ అమ్మకం రికార్డు తొలగించారు`;
    }
    return `${cfg.labelTe || cfg.label}${log.details?.customer ? ' (' + log.details.customer + ')' : ''}`;
  }

  // English sentence
  let sentence = `${cfg.label}`;

  if (log.targetId && ['CREATE_BILL', 'EDIT_BILL', 'VOID_BILL', 'UPDATE_PAYMENT_STATUS', 'SEND_REMINDER'].includes(log.action)) {
    sentence += ` #${log.targetId}`;
  }

  if (log.details?.customer) sentence += ` for ${log.details.customer}`;
  if (log.details?.staffName) sentence += ` for ${log.details.staffName}`;
  if (log.details?.quantity) sentence += ` (${log.details.quantity} kg @ ₹${log.details.price || 0})`;
  if (log.details?.blocks) sentence += ` (${log.details.blocks} blocks @ ₹${log.details.rate || 0})`;
  if (log.details?.quantityKg) sentence += ` (${log.details.quantityKg} kg @ ₹${log.details.rate || 0})`;
  if (log.details?.iceFrom) sentence += ` [From: ${log.details.iceFrom}${log.details?.iceTo ? ' → To: ' + log.details.iceTo : ''}]`;
  if (log.details?.buyerName) sentence += ` (Buyer: ${log.details.buyerName})`;
  if (log.details?.amount) sentence += ` (₹${Number(log.details.amount).toLocaleString('en-IN')})`;
  else if (log.details?.totalAmount) sentence += ` (₹${Number(log.details.totalAmount).toLocaleString('en-IN')})`;
  if (log.details?.status) sentence += ` → ${log.details.status}`;
  if (log.details?.reason) sentence += ` — "${log.details.reason}"`;
  if (log.details?.creditLimit !== undefined) sentence += ` ₹${Number(log.details.creditLimit).toLocaleString('en-IN')}`;
  if (log.details?.count) sentence += ` (${log.details.count} records)`;

  return sentence;
}

export default function ActivityLog() {
  const { t, lang } = useLanguage();
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
      setLogs(res.data.logs || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalLogs(res.data.total || 0);
    } catch (err) {
      if (import.meta.env.DEV) { console.error('Failed to load activity logs:', err); }
      showToast(lang === 'te' ? 'కార్యకలాపాలను లోడ్ చేయడం విఫలమైంది' : 'Failed to load activity logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Group logs by relative date
  const grouped = {};
  logs.forEach((log) => {
    const key = getRelativeDate(log.createdAt, lang);
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
            📋 {t('activityTimeline') || 'Activity Timeline'}
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>
            {t('liveAuditTrail') || 'Live audit trail of all staff, owner & admin actions'}
          </p>
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>
          {lang === 'te' ? 'మొత్తం: ' : 'Total: '}<span style={{ color: '#0b5394' }}>{totalLogs}</span> {lang === 'te' ? 'పనులు' : 'actions'}
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>
            {t('actionType') || 'Action Type'}
          </label>
          <select className="form-select" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
            <option value="">{t('allActions') || 'All Actions'}</option>
            <optgroup label={lang === 'te' ? 'ఇన్వాయిస్ బిల్లులు' : 'Invoices & Billing'}>
              <option value="CREATE_BILL">{lang === 'te' ? 'కొత్త బిల్లు' : 'Create Bill'}</option>
              <option value="EDIT_BILL">{lang === 'te' ? 'బిల్లు సవరణ' : 'Edit Bill'}</option>
              <option value="VOID_BILL">{lang === 'te' ? 'బిల్లు రద్దు' : 'Void Bill'}</option>
              <option value="UPDATE_PAYMENT_STATUS">{lang === 'te' ? 'చెల్లింపు స్థితి' : 'Payment Status'}</option>
              <option value="SEND_REMINDER">{lang === 'te' ? 'రిమైండర్ పంపు' : 'Send Reminder'}</option>
            </optgroup>
            <optgroup label={lang === 'te' ? 'కూలీల పని & హాజరు' : 'Staff & Labor'}>
              <option value="STAFF_WORK_RECORDED">{lang === 'te' ? 'కూలీ పని నమోదు' : 'Worker Wage Recorded'}</option>
              <option value="STAFF_WORK_BULK_RECORDED">{lang === 'te' ? 'బల్క్ హాజరు నమోదు' : 'Bulk Attendance Recorded'}</option>
              <option value="STAFF_WORK_UPDATED">{lang === 'te' ? 'కూలీ సవరణ' : 'Worker Wage Updated'}</option>
              <option value="STAFF_WORK_PAYMENT_TOGGLED">{lang === 'te' ? 'కూలీ చెల్లింపు స్థితి' : 'Wage Payment Status'}</option>
              <option value="STAFF_WORK_DELETED">{lang === 'te' ? 'కూలీ ఎంట్రీ తొలగింపు' : 'Worker Wage Deleted'}</option>
            </optgroup>
            <optgroup label={lang === 'te' ? 'ఐస్ బ్లాకులు' : 'Ice Purchases'}>
              <option value="ICE_RECORDED">{lang === 'te' ? 'ఐస్ కొనుగోలు నమోదు' : 'Ice Purchase Recorded'}</option>
              <option value="ICE_UPDATED">{lang === 'te' ? 'ఐస్ రికార్డు సవరణ' : 'Ice Purchase Updated'}</option>
              <option value="ICE_DELETED">{lang === 'te' ? 'ఐస్ రికార్డు తొలగింపు' : 'Ice Purchase Deleted'}</option>
            </optgroup>
            <optgroup label={lang === 'te' ? 'వేస్టేజ్ అమ్మకాలు' : 'Prawn Head Wastage'}>
              <option value="WASTAGE_RECORDED">{lang === 'te' ? 'వేస్టేజ్ అమ్మకం నమోదు' : 'Wastage Sale Recorded'}</option>
              <option value="WASTAGE_UPDATED">{lang === 'te' ? 'వేస్టేజ్ అమ్మకం సవరణ' : 'Wastage Sale Updated'}</option>
              <option value="WASTAGE_DELETED">{lang === 'te' ? 'వేస్టేజ్ అమ్మకం తొలగింపు' : 'Wastage Sale Deleted'}</option>
            </optgroup>
            <optgroup label={lang === 'te' ? 'అకౌంటింగ్ & సిస్టమ్' : 'System & Accounting'}>
              <option value="SET_CREDIT_LIMIT">{lang === 'te' ? 'క్రెడిట్ పరిమితి' : 'Credit Limit'}</option>
              <option value="EXPORT_CSV">{lang === 'te' ? 'CSV ఎగుమతి' : 'Export CSV'}</option>
              <option value="EXPORT_TALLY">{lang === 'te' ? 'టాలీ XML' : 'Export Tally'}</option>
            </optgroup>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>
            {t('userRole') || 'User Role'}
          </label>
          <select className="form-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
            <option value="">{t('allRoles') || 'All Roles'}</option>
            <option value="admin">{t('adminOnly') || 'Admin Only'}</option>
            <option value="owner">{t('ownerOnly') || 'Owner Only'}</option>
            <option value="staff">{t('staffOnly') || 'Staff Only'}</option>
          </select>
        </div>
        {(actionFilter || roleFilter) && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end', marginBottom: '2px', color: '#ef4444', fontWeight: 700 }}
            onClick={() => { setActionFilter(''); setRoleFilter(''); setPage(1); }}>
            {t('resetFilters') || 'Reset Filters'} ✕
          </button>
        )}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="spinner" style={{ minHeight: '300px' }}></div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          {t('noActivityLogs') || 'No activity logs found for the selected filters.'}
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
                              {cfg.emoji} {buildSentence(log, lang)}
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
                ← {lang === 'te' ? 'మునుపటిది' : 'Previous'}
              </button>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#64748b' }}>
                {lang === 'te' ? `పేజీ ${page} / ${totalPages}` : `Page ${page} of ${totalPages}`}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                {lang === 'te' ? 'తదుపరిది' : 'Next'} →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
