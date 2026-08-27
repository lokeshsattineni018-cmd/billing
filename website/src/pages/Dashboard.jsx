import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/helpers';
import { TrendingUpIcon, CalendarIcon, FileCheckIcon, PlusIcon } from '../components/Icons';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const canSeeSales = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await dashboardAPI.summary();
      setData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="spinner"></div>;

  return (
    <div className="page-container fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2>Dashboard</h2>
          <p>{canSeeSales ? "Business Overview & Trading Summary" : "Employee Portal — Create & manage invoices"}</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-primary btn-large"
            onClick={() => navigate('/new-bill')}
          >
            <PlusIcon size={18} /> New Invoice
          </button>
          {canSeeSales && (
            <button
              className="btn btn-secondary btn-large"
              onClick={() => navigate('/ledger')}
            >
              Customer Ledger
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards — Visible only to Owner and Admin */}
      {canSeeSales && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '28px' }}>
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-value">{formatCurrency(data?.today?.totalSales || 0)}</div>
              <div className="stat-label">Today's Sales</div>
            </div>
            <div className="stat-icon-wrapper indigo">
              <TrendingUpIcon size={22} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-value">{formatCurrency(data?.month?.totalSales || 0)}</div>
              <div className="stat-label">This Month Sales</div>
            </div>
            <div className="stat-icon-wrapper emerald">
              <CalendarIcon size={22} />
            </div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#d97706' }}>
                {formatCurrency(data?.receivables?.totalPending || 0)}
              </div>
              <div className="stat-label">Outstanding Receivables</div>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
              <TrendingUpIcon size={22} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-value">{data?.totalBills || 0}</div>
              <div className="stat-label">Total Invoices</div>
            </div>
            <div className="stat-icon-wrapper slate">
              <FileCheckIcon size={22} />
            </div>
          </div>
        </div>
      )}

      {/* Recent Invoices */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Invoices</h3>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/bills')}
          >
            View All →
          </button>
        </div>

        {data?.recentBills?.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Company Name</th>
                  <th className="text-right">Qty (KG)</th>
                  <th>Status</th>
                  {canSeeSales && <th className="text-right">Total Amount</th>}
                </tr>
              </thead>
              <tbody>
                {data.recentBills.map((bill) => (
                  <tr
                    key={bill._id}
                    className="clickable-row"
                    onClick={() => navigate(`/bills/${bill._id}`)}
                  >
                    <td>
                      <span className="badge badge-blue">#{bill.billNo}</span>
                    </td>
                    <td>{formatDate(bill.date)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {bill.companyName}
                    </td>
                    <td className="text-right">{bill.quantity} kg</td>
                    <td>
                      <span className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-green' : 'badge-amber'}`}>
                        {bill.paymentStatus || 'Pending'}
                      </span>
                    </td>
                    {canSeeSales && (
                      <td className="text-right" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(bill.grandTotal || bill.total)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No invoices created yet</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/new-bill')}
            >
              Create Your First Invoice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
