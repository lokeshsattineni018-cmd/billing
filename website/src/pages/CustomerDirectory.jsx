import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersAPI } from '../services/api';
import { formatCurrency, formatDate, useToast, Toast } from '../utils/helpers';
import { SearchIcon, PlusIcon, WhatsAppIcon } from '../components/Icons';
import PaymentModal from '../components/PaymentModal';

export default function CustomerDirectory() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { toast, showToast } = useToast();

  // Credit Limit & Details Modal State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [savingCredit, setSavingCredit] = useState(false);

  // Customer Ledger & Invoices Drawer State
  const [ledgerCustomer, setLedgerCustomer] = useState(null);
  const [customerBills, setCustomerBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [lumpSumAmount, setLumpSumAmount] = useState('');
  const [lumpSumMode, setLumpSumMode] = useState('Cash');
  const [lumpSumRef, setLumpSumRef] = useState('');
  const [lumpSumDate, setLumpSumDate] = useState(new Date().toISOString().split('T')[0]);
  const [recordingLumpSum, setRecordingLumpSum] = useState(false);

  // Single Bill Payment Modal State
  const [paymentBillId, setPaymentBillId] = useState(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async (searchQuery = '') => {
    setLoading(true);
    try {
      const res = await customersAPI.list(searchQuery);
      setCustomers(res.data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
      showToast('Failed to load customer records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadCustomers(search);
  };

  const handleOpenCreditModal = (c) => {
    setSelectedCustomer(c);
    setNewCreditLimit(c.creditLimit > 0 ? String(c.creditLimit) : '');
    setCustomerPhone(c.phone || '');
    setCustomerGstin(c.gstin || '');
    setCustomerAddress(c.address || '');
    setCustomerNotes(c.notes || '');
    setCreditModalOpen(true);
  };

  const handleSaveCreditLimit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    setSavingCredit(true);
    try {
      await customersAPI.updateCreditLimit(selectedCustomer.name, {
        creditLimit: parseFloat(newCreditLimit) || 0,
        phone: customerPhone,
        gstin: customerGstin,
        address: customerAddress,
        notes: customerNotes,
      });
      showToast(`Customer settings updated for ${selectedCustomer.name}`);
      setCreditModalOpen(false);
      loadCustomers(search);
    } catch (err) {
      console.error('Failed to update credit limit:', err);
      showToast('Failed to update customer settings', 'error');
    } finally {
      setSavingCredit(false);
    }
  };

  const handleOpenLedger = async (c) => {
    setLedgerCustomer(c);
    setLumpSumAmount(c.outstandingBalance > 0 ? String(c.outstandingBalance) : '');
    setLumpSumRef('');
    setLoadingBills(true);
    try {
      const res = await customersAPI.getBills(c.name);
      setCustomerBills(res.data || []);
    } catch (err) {
      console.error('Failed to load customer bills:', err);
      showToast('Failed to load customer invoices', 'error');
    } finally {
      setLoadingBills(false);
    }
  };

  const handleRecordLumpSum = async (e) => {
    e.preventDefault();
    if (!ledgerCustomer) return;

    const numAmt = parseFloat(lumpSumAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    setRecordingLumpSum(true);
    try {
      const res = await customersAPI.recordPayment(ledgerCustomer.name, {
        amount: numAmt,
        mode: lumpSumMode,
        reference: lumpSumRef,
        date: lumpSumDate,
      });
      showToast(res.data.message);
      setLumpSumAmount('');
      setLumpSumRef('');
      // Reload customer bills & master list
      handleOpenLedger(ledgerCustomer);
      loadCustomers(search);
    } catch (err) {
      console.error('Failed to record lump sum payment:', err);
      showToast(err.response?.data?.message || 'Failed to record payment', 'error');
    } finally {
      setRecordingLumpSum(false);
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
    <div className="page-container fade-in" style={{ maxWidth: '1440px', margin: '0 auto' }}>
      <Toast toast={toast} />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            Customer Master & Payment Center
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>
            Manage customer credit limits, record invoice payments & track receivables (Admin Exclusive)
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
      <form onSubmit={handleSearch} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
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
        <div className="card" style={{ padding: '0', overflow: 'hidden', borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.9)' }}>
          <div className="table-container">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
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
                      <div
                        style={{ fontWeight: 800, color: '#0b5394', fontSize: '0.95rem', cursor: 'pointer' }}
                        onClick={() => handleOpenLedger(c)}
                        title="Click to view all invoices and record payments"
                      >
                        {c.name}
                      </div>
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
                      <span style={{ fontWeight: 900, fontSize: '0.95rem', color: c.outstandingBalance > 0 ? '#d97706' : '#16a34a' }}>
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
                          EXCEEDED ({c.creditUsedPercent}%)
                        </span>
                      ) : c.creditStatus === 'WARNING' ? (
                        <span className="badge" style={{ background: '#fef3c7', color: '#d97706', fontWeight: 800, fontSize: '0.75rem' }}>
                          NEAR LIMIT ({c.creditUsedPercent}%)
                        </span>
                      ) : c.creditLimit > 0 ? (
                        <span className="badge" style={{ background: '#dcfce7', color: '#16a34a', fontWeight: 700, fontSize: '0.75rem' }}>
                          SAFE ({c.creditUsedPercent}%)
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Uncapped</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenLedger(c)}
                          style={{
                            background: c.outstandingBalance > 0 ? '#0b5394' : '#f1f5f9',
                            color: c.outstandingBalance > 0 ? '#ffffff' : '#475569',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            padding: '6px 12px',
                            border: 'none',
                          }}
                          title="Record partial/full payments & view invoice breakdown"
                        >
                          {c.outstandingBalance > 0 ? 'Receive Payment' : 'View Invoices'}
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenCreditModal(c)}
                          style={{ fontWeight: 700, fontSize: '0.75rem', padding: '6px 10px' }}
                          title="Set Credit Limit & Details"
                        >
                          Settings
                        </button>

                        {c.phone && (
                          <button
                            type="button"
                            className="btn btn-whatsapp btn-sm"
                            onClick={() => handleWhatsAppContact(c)}
                            style={{ padding: '6px 10px' }}
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

      {/* ========================================================================= */}
      {/* CUSTOMER INVOICES & PAYMENT SETTLEMENT MODAL                              */}
      {/* ========================================================================= */}
      {ledgerCustomer && (
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
            zIndex: 9990,
            padding: '16px',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setLedgerCustomer(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '840px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
                  {ledgerCustomer.name}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  {ledgerCustomer.phone ? `+91 ${ledgerCustomer.phone}` : 'No phone'} • {ledgerCustomer.gstin || 'No GSTIN'}
                </p>
              </div>
              <button
                onClick={() => setLedgerCustomer(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                ×
              </button>
            </div>

            {/* Financial Status Banner */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Total Invoiced
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                  {formatCurrency(ledgerCustomer.totalInvoiced)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Total Collected
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#16a34a', marginTop: '2px' }}>
                  {formatCurrency(ledgerCustomer.totalPaid)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>
                  Current Outstanding Due
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#d97706', marginTop: '2px' }}>
                  {formatCurrency(ledgerCustomer.outstandingBalance)}
                </div>
              </div>
            </div>

            {/* Lump-Sum Quick Payment Form (If balance > 0) */}
            {ledgerCustomer.outstandingBalance > 0 && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  marginBottom: '22px',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#166534', marginBottom: '10px' }}>
                  Lump-Sum Payment (Auto-settles oldest invoices)
                </div>
                <form onSubmit={handleRecordLumpSum} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#166534', marginBottom: '3px' }}>
                      Amount (INR):
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 50000"
                      value={lumpSumAmount}
                      onChange={(e) => setLumpSumAmount(e.target.value)}
                      step="any"
                      min="1"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#166534', marginBottom: '3px' }}>
                      Mode:
                    </label>
                    <select
                      className="form-input"
                      value={lumpSumMode}
                      onChange={(e) => setLumpSumMode(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                      <option value="UPI">UPI (PhonePe / GPay)</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#166534', marginBottom: '3px' }}>
                      Ref / UTR No.:
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Optional"
                      value={lumpSumRef}
                      onChange={(e) => setLumpSumRef(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#166534', marginBottom: '3px' }}>
                      Date:
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={lumpSumDate}
                      onChange={(e) => setLumpSumDate(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={recordingLumpSum}
                    style={{ background: '#15803d', color: '#ffffff', fontWeight: 800, padding: '11px', border: 'none', height: '42px' }}
                  >
                    {recordingLumpSum ? 'Applying...' : 'Record Payment'}
                  </button>
                </form>
              </div>
            )}

            {/* Invoices List */}
            <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
              Invoice Breakdown ({customerBills.length})
            </h4>

            {loadingBills ? (
              <div className="spinner" style={{ minHeight: '120px' }}></div>
            ) : customerBills.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No bills found for this customer.</p>
            ) : (
              <div className="table-container">
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th className="text-right">Total Amount</th>
                      <th className="text-right">Paid</th>
                      <th className="text-right">Balance Due</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerBills.map((b) => (
                      <tr key={b._id}>
                        <td>
                          <span
                            style={{ fontWeight: 800, color: '#0b5394', cursor: 'pointer' }}
                            onClick={() => navigate(`/bills/${b._id}`)}
                          >
                            #{b.billNo}
                          </span>
                        </td>
                        <td style={{ color: '#64748b', fontSize: '0.82rem' }}>{formatDate(b.date)}</td>
                        <td className="text-right" style={{ fontWeight: 800 }}>
                          {formatCurrency(b.total)}
                        </td>
                        <td className="text-right" style={{ fontWeight: 800, color: '#16a34a' }}>
                          {formatCurrency(b.paidAmount)}
                        </td>
                        <td className="text-right" style={{ fontWeight: 900, color: b.balanceDue > 0 ? '#d97706' : '#16a34a' }}>
                          {formatCurrency(b.balanceDue)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${
                              b.paymentStatus === 'Paid'
                                ? 'badge-green'
                                : b.paymentStatus === 'Partial'
                                ? 'badge-blue'
                                : 'badge-amber'
                            }`}
                            style={{ fontSize: '0.72rem', fontWeight: 800 }}
                          >
                            {b.paymentStatus || 'Pending'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {b.balanceDue > 0 ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{
                                background: '#eff6ff',
                                color: '#0b5394',
                                border: '1px solid #bfdbfe',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                padding: '4px 10px',
                              }}
                              onClick={() => setPaymentBillId(b._id)}
                            >
                              + Pay
                            </button>
                          ) : (
                            <span style={{ color: '#16a34a', fontSize: '0.78rem', fontWeight: 700 }}>Settled</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                Customer Credit Settings
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
                  Maximum Credit Limit (INR):
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
                  {savingCredit ? 'Saving...' : 'Save Customer Settings'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setCreditModalOpen(false)}
                  style={{ padding: '11px 16px', color: '#64748b' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Invoice Payment Modal */}
      {paymentBillId && (
        <PaymentModal
          billId={paymentBillId}
          onClose={() => setPaymentBillId(null)}
          onSuccess={(msg) => {
            showToast(msg);
            if (ledgerCustomer) handleOpenLedger(ledgerCustomer);
            loadCustomers(search);
          }}
        />
      )}
    </div>
  );
}
