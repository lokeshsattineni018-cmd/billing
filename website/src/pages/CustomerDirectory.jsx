import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersAPI } from '../services/api';
import { formatCurrency, formatDate, useToast, Toast } from '../utils/helpers';
import { SearchIcon, WhatsAppIcon, PlusIcon } from '../components/Icons';

export default function CustomerDirectory() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [savingCredit, setSavingCredit] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async (searchQuery = '') => {
    setLoading(true);
    try {
      const res = await customersAPI.list(searchQuery);
      setCustomers(res.data);
    } catch (err) {
      console.error('Failed to load customers:', err);
      showToast('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadCustomers(search);
  };

  const handleOpenCreditModal = (customer) => {
    setSelectedCustomer(customer);
    setNewCreditLimit(customer.creditLimit ? String(customer.creditLimit) : '');
    setCustomerPhone(customer.phone || '');
    setCustomerGstin(customer.gstin || '');
    setCreditModalOpen(true);
  };

  const handleSaveCreditLimit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    setSavingCredit(true);
    try {
      await customersAPI.updateCreditLimit(selectedCustomer.name, {
        creditLimit: parseFloat(newCreditLimit) || 0,
        phone: customerPhone.trim(),
        gstin: customerGstin.trim(),
      });
      showToast(`Credit limit updated for ${selectedCustomer.name}`, 'success');
      setCreditModalOpen(false);
      loadCustomers(search);
    } catch (err) {
      console.error('Failed to update credit limit:', err);
      showToast('Failed to update credit limit', 'error');
    } finally {
      setSavingCredit(false);
    }
  };

  const handleWhatsAppContact = (customer) => {
    const phone = (customer.phone || '').replace(/\D/g, '').slice(-10);
    if (!phone) {
      showToast('No phone number saved for this customer', 'error');
      return;
    }
    const msg = `Namaste ${customer.name}, regarding your business account with Vijaya Durga Agencies. Outstanding Balance: ${formatCurrency(customer.outstandingBalance)}.`;
    const url = `https://api.whatsapp.com/send?phone=91${phone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            👥 Customer Master Directory
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>
            Manage customer credit limits, lifetime volume, contact info & receivables (Admin Exclusive)
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/new-bill')}
          style={{ background: '#0b5394', color: '#ffffff', fontWeight: 700, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <PlusIcon size={16} color="#ffffff" /> Create Invoice
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search by customer name, phone, or GSTIN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" style={{ background: '#0b5394', color: '#ffffff', fontWeight: 700, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <SearchIcon size={16} color="#ffffff" /> Search
        </button>
        {search && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setSearch('');
              loadCustomers('');
            }}
          >
            Clear
          </button>
        )}
      </form>

      {/* Customers Table / Cards */}
      {loading ? (
        <div className="spinner" style={{ minHeight: '300px' }}></div>
      ) : customers.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          No customer records found matching your search.
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="table-container">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Phone / GSTIN</th>
                  <th className="text-right">Credit Limit</th>
                  <th className="text-right">Outstanding</th>
                  <th className="text-right">Lifetime Sales</th>
                  <th style={{ textAlign: 'center' }}>Total Bills</th>
                  <th style={{ textAlign: 'center' }}>Credit Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 800, color: '#0b5394', fontSize: '0.95rem' }}>{c.name}</div>
                      {c.lastBillDate && (
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Last bill: {formatDate(c.lastBillDate)}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.phone ? `+91 ${c.phone}` : '—'}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{c.gstin || 'No GSTIN'}</div>
                    </td>
                    <td className="text-right">
                      {c.creditLimit > 0 ? (
                        <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(c.creditLimit)}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No Limit</span>
                      )}
                    </td>
                    <td className="text-right">
                      <span style={{ fontWeight: 800, color: c.outstandingBalance > 0 ? '#d97706' : '#16a34a' }}>
                        {formatCurrency(c.outstandingBalance)}
                      </span>
                    </td>
                    <td className="text-right" style={{ fontWeight: 800 }}>
                      {formatCurrency(c.totalInvoiced)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      {c.totalBills}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {c.creditStatus === 'EXCEEDED' ? (
                        <span className="badge" style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 800, fontSize: '0.75rem' }}>
                          🔴 EXCEEDED ({c.creditUsedPercent}%)
                        </span>
                      ) : c.creditStatus === 'WARNING' ? (
                        <span className="badge" style={{ background: '#fef3c7', color: '#d97706', fontWeight: 800, fontSize: '0.75rem' }}>
                          🟡 NEAR LIMIT ({c.creditUsedPercent}%)
                        </span>
                      ) : c.creditLimit > 0 ? (
                        <span className="badge" style={{ background: '#dcfce7', color: '#16a34a', fontWeight: 700, fontSize: '0.75rem' }}>
                          🟢 SAFE ({c.creditUsedPercent}%)
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Uncapped</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenCreditModal(c)}
                          style={{ fontWeight: 700, fontSize: '0.75rem', padding: '5px 10px' }}
                          title="Set Credit Limit & Details"
                        >
                          ⚙️ Credit
                        </button>
                        {c.phone && (
                          <button
                            type="button"
                            className="btn btn-whatsapp btn-sm"
                            onClick={() => handleWhatsAppContact(c)}
                            style={{ padding: '5px 10px' }}
                            title="Chat on WhatsApp"
                          >
                            <WhatsAppIcon size={14} color="#ffffff" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Credit Limit & Master Edit Modal */}
      {creditModalOpen && selectedCustomer && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setCreditModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                ⚙️ Customer Credit Settings
              </h3>
              <button
                onClick={() => setCreditModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                ×
              </button>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: '#0b5394', fontWeight: 800 }}>
              {selectedCustomer.name}
            </p>

            <form onSubmit={handleSaveCreditLimit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Maximum Credit Limit (₹ INR):
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 200000 (0 for no limit)"
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(e.target.value)}
                  min="0"
                  step="1000"
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Set to 0 if this customer has no credit restrictions.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Customer Mobile Phone:
                </label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="10-digit mobile number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  maxLength={10}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Customer GSTIN:
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 37KATPS1500Q1ZR"
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                  maxLength={15}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingCredit}
                  style={{ flex: 1, fontWeight: 800, padding: '11px', background: '#0b5394', color: '#ffffff' }}
                >
                  {savingCredit ? 'Saving...' : '💾 Save Customer Settings'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setCreditModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
