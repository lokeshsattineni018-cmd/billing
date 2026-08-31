import { useState, useEffect } from 'react';
import { reportsAPI, billsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, useToast, Toast } from '../utils/helpers';
import { TrendingUpIcon, WhatsAppIcon, DownloadIcon, FileCheckIcon } from '../components/Icons';

export default function Reports() {
  const { user } = useAuth();
  const { toast, showToast } = useToast();

  const [range, setRange] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [range]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = { range };
      if (range === 'custom') {
        if (!customStart || !customEnd) {
          setLoading(false);
          return;
        }
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      const res = await reportsAPI.getSales(params);
      setReport(res.data);
    } catch (err) {
      console.error('Failed to load sales report:', err);
      showToast('Failed to load sales report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCustomDate = (e) => {
    e.preventDefault();
    if (!customStart || !customEnd) {
      showToast('Please select both start and end dates', 'error');
      return;
    }
    loadReport();
  };

  const handleShareWhatsApp = () => {
    if (!report?.whatsappSummary) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(report.whatsappSummary)}`;
    window.open(url, '_blank');
  };

  const handleCopyWhatsApp = () => {
    if (!report?.whatsappSummary) return;
    navigator.clipboard.writeText(report.whatsappSummary);
    showToast('Report summary copied to clipboard!', 'success');
  };

  const handleExportCSV = () => {
    const params = {};
    if (range === 'custom' && customStart && customEnd) {
      params.dateFrom = customStart;
      params.dateTo = customEnd;
    } else if (report?.dateRange?.start && report?.dateRange?.end) {
      params.dateFrom = report.dateRange.start.split('T')[0];
      params.dateTo = report.dateRange.end.split('T')[0];
    }
    window.open(billsAPI.exportCSVUrl(params), '_blank');
  };

  const handleExportTally = () => {
    const params = {};
    if (range === 'custom' && customStart && customEnd) {
      params.dateFrom = customStart;
      params.dateTo = customEnd;
    } else if (report?.dateRange?.start && report?.dateRange?.end) {
      params.dateFrom = report.dateRange.start.split('T')[0];
      params.dateTo = report.dateRange.end.split('T')[0];
    }
    window.open(billsAPI.exportTallyUrl(params), '_blank');
  };

  const summary = report?.summary || {};

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            📊 Sales & Financial Reports
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>
            Comprehensive analytics, tax breakdown, and accounting exports (Admin Exclusive)
          </p>
        </div>

        {/* Export Toolbar */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-whatsapp"
            onClick={handleShareWhatsApp}
            style={{ fontWeight: 700, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <WhatsAppIcon size={16} color="#ffffff" /> Share WhatsApp
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            style={{ fontWeight: 700, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <DownloadIcon size={16} /> Export Excel (CSV)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportTally}
            style={{ fontWeight: 700, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #0b5394', color: '#0b5394' }}
          >
            💼 Tally XML
          </button>
        </div>
      </div>

      {/* Date Range Selector Card */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: range === 'custom' ? '12px' : '0' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>Range:</span>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'custom', label: 'Custom Date' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`btn btn-sm ${range === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              style={range === tab.id ? { background: '#0b5394', color: '#ffffff' } : {}}
              onClick={() => setRange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <form onSubmit={handleApplyCustomDate} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>Start Date</label>
              <input
                type="date"
                className="form-input"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>End Date</label>
              <input
                type="date"
                className="form-input"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ background: '#0b5394', color: '#ffffff', fontWeight: 700, padding: '10px 16px' }}>
              Apply Custom Range
            </button>
          </form>
        )}
      </div>

      {loading ? (
        <div className="spinner" style={{ minHeight: '300px' }}></div>
      ) : report ? (
        <div>
          {/* KPI Summary Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #0b5394' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Gross Revenue</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0b5394', marginTop: '4px' }}>
                {formatCurrency(summary.totalRevenue)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{summary.totalBills} Invoices total</div>
            </div>

            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Collected (Paid)</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#16a34a', marginTop: '4px' }}>
                {formatCurrency(summary.paidAmount)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{summary.paidCount} bills cleared</div>
            </div>

            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #d97706' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Pending Receivables</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#d97706', marginTop: '4px' }}>
                {formatCurrency(summary.pendingAmount)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{summary.pendingCount} bills unpaid</div>
            </div>

            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Avg Ticket Size</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#8b5cf6', marginTop: '4px' }}>
                {formatCurrency(summary.avgTicketSize)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Per bill average</div>
            </div>
          </div>

          {/* Tax Breakdown Card */}
          {summary.totalTax > 0 && (
            <div className="card" style={{ padding: '18px', marginBottom: '24px' }}>
              <h3 className="card-title" style={{ marginBottom: '12px' }}>🏛️ GST Tax Collection Breakdown</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Taxable Value</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{formatCurrency(summary.totalTaxable)}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>CGST Collected</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0b5394' }}>{formatCurrency(summary.totalCGST)}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>SGST Collected</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0b5394' }}>{formatCurrency(summary.totalSGST)}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>IGST Collected</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0b5394' }}>{formatCurrency(summary.totalIGST)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Top Buyers & Item Breakdown Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Top Buyers Table */}
            <div className="card" style={{ padding: '18px' }}>
              <h3 className="card-title" style={{ marginBottom: '14px' }}>🏆 Top Buyers for Selected Period</h3>
              {report.topBuyers?.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No buyers recorded in this date range.</p>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th style={{ textAlign: 'center' }}>Bills</th>
                        <th className="text-right">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topBuyers.map((tb, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700, color: '#0b5394' }}>
                            {idx + 1}. {tb._id}
                          </td>
                          <td style={{ textAlign: 'center' }}>{tb.billCount}</td>
                          <td className="text-right" style={{ fontWeight: 800 }}>
                            {formatCurrency(tb.totalSales)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Items Breakdown Table */}
            <div className="card" style={{ padding: '18px' }}>
              <h3 className="card-title" style={{ marginBottom: '14px' }}>🦐 Seafood Items Breakdown</h3>
              {report.itemsBreakdown?.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No items recorded in this date range.</p>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Item Particulars</th>
                        <th style={{ textAlign: 'right' }}>Total Qty (KG)</th>
                        <th className="text-right">Total Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.itemsBreakdown.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{item._id}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {Number(item.totalQty || 0).toLocaleString('en-IN')} kg
                          </td>
                          <td className="text-right" style={{ fontWeight: 800, color: '#0b5394' }}>
                            {formatCurrency(item.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
