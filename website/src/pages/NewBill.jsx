import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { billsAPI, settingsAPI } from '../services/api';
import { formatCurrency, useToast, Toast } from '../utils/helpers';
import { PrintIcon, PlusIcon, WhatsAppIcon, ArrowLeftIcon } from '../components/Icons';

export default function NewBill() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, showToast } = useToast();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [companyName, setCompanyName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [companyGstin, setCompanyGstin] = useState('37KATPS1500Q1ZR');
  const [paymentStatus, setPaymentStatus] = useState('Pending');

  const [items, setItems] = useState([
    {
      sno: 1,
      particulars: 'Fresh Seafood / Prawns Supply',
      hsn: '0306',
      quantity: '',
      rate: '',
      taxRate: '',
      amount: 0,
    },
  ]);

  const [cgstRate, setCgstRate] = useState('');
  const [cgstAmount, setCgstAmount] = useState('');
  const [sgstRate, setSgstRate] = useState('');
  const [sgstAmount, setSgstAmount] = useState('');
  const [igstAmount, setIgstAmount] = useState('');

  const [customersList, setCustomersList] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadSettings();
    loadCustomers();

    if (location.state?.cloneBill) {
      const clone = location.state.cloneBill;
      setCompanyName(clone.companyName || '');
      setCustomerPhone(clone.customerPhone || '');
      if (clone.companyGstin) setCompanyGstin(clone.companyGstin);
      if (clone.items && clone.items.length > 0) {
        setItems(clone.items.map((it, idx) => ({ ...it, sno: idx + 1 })));
      } else {
        setItems([
          {
            sno: 1,
            particulars: clone.particulars || 'Fresh Seafood / Prawns Supply',
            hsn: clone.hsn || '0306',
            quantity: clone.quantity || '',
            rate: clone.rate || '',
            taxRate: clone.taxRate || '',
            amount: clone.total || 0,
          },
        ]);
      }
      showToast('Loaded details from invoice #' + clone.billNo);
    }
  }, [location.state]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadSettings = async () => {
    try {
      const response = await settingsAPI.get();
      if (response.data && response.data.gstin) {
        setCompanyGstin(response.data.gstin);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await billsAPI.getLedger();
      if (response.data && response.data.customers) {
        setCustomersList(response.data.customers);
      }
    } catch (error) {
      console.error('Failed to load customer list:', error);
    }
  };

  const handleSelectCustomer = (customer) => {
    setCompanyName(customer.companyName);
    if (customer.customerPhone) {
      setCustomerPhone(customer.customerPhone);
    }
    setShowSuggestions(false);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    if (field === 'quantity' || field === 'rate') {
      const q = parseFloat(field === 'quantity' ? value : updated[index].quantity) || 0;
      const r = parseFloat(field === 'rate' ? value : updated[index].rate) || 0;
      updated[index].amount = Math.round(q * r * 100) / 100;
    }

    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        sno: items.length + 1,
        particulars: 'Fresh Seafood / Prawns Supply',
        hsn: '0306',
        quantity: '',
        rate: '',
        taxRate: '',
        amount: 0,
      },
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    const filtered = items.filter((_, i) => i !== index).map((it, idx) => ({ ...it, sno: idx + 1 }));
    setItems(filtered);
  };

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const totalTax = (parseFloat(cgstAmount) || 0) + (parseFloat(sgstAmount) || 0) + (parseFloat(igstAmount) || 0);
  const grandTotal = Math.round((subtotal + totalTax) * 100) / 100;

  const handleSave = async (actionType = 'save') => {
    if (!companyName.trim()) {
      showToast('Customer / Company name is required', 'error');
      return;
    }

    const hasInvalidItem = items.some((it) => !it.quantity || !it.rate);
    if (hasInvalidItem) {
      showToast('Please enter Quantity (KG) and Price (₹) for all items', 'error');
      return;
    }

    setSaving(true);

    try {
      const invoiceData = {
        date,
        companyName: companyName.trim(),
        customerPhone: customerPhone.trim(),
        companyGstin: companyGstin.trim(),
        items: items.map((it, idx) => ({
          sno: idx + 1,
          particulars: it.particulars || 'Fresh Seafood / Prawns Supply',
          hsn: it.hsn || '0306',
          quantity: parseFloat(it.quantity) || 0,
          rate: parseFloat(it.rate) || 0,
          taxRate: it.taxRate || '',
          amount: parseFloat(it.amount) || 0,
        })),
        particulars: items[0]?.particulars || 'Fresh Seafood / Prawns Supply',
        hsn: items[0]?.hsn || '0306',
        quantity: parseFloat(items[0]?.quantity) || 0,
        rate: parseFloat(items[0]?.rate) || 0,
        taxableValue: subtotal,
        cgstRate,
        cgstAmount: parseFloat(cgstAmount) || 0,
        sgstRate,
        sgstAmount: parseFloat(sgstAmount) || 0,
        igstRate: '',
        igstAmount: parseFloat(igstAmount) || 0,
        total: subtotal,
        grandTotal,
        paymentStatus,
      };

      const response = await billsAPI.create(invoiceData);
      const invoice = response.data;

      showToast(`Invoice #${invoice.billNo} created successfully`);

      if (actionType === 'print') {
        navigate(`/bills/${invoice._id}?autoprint=true`);
      } else {
        navigate(`/bills/${invoice._id}`);
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+Enter / Cmd+Enter to Save & Print
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave('print');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [companyName, customerPhone, items, date, paymentStatus]);

  const matchingCustomers = customersList.filter((c) =>
    companyName.trim() &&
    c.companyName?.toLowerCase().includes(companyName.toLowerCase()) &&
    c.companyName?.toLowerCase() !== companyName.toLowerCase()
  );

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      {/* Page Title & Back */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0 }}>New Invoice</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '2px 0 0 0' }}>
            GSTIN: <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{companyGstin}</span>
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          <ArrowLeftIcon size={16} /> Back
        </button>
      </div>

      {/* Structured Billing Form */}
      <div className="card new-bill-card" style={{ padding: '20px 16px' }}>

        {/* ── STEP 1: CUSTOMER DETAILS ── */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: '#0b5394', color: '#ffffff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
              1
            </div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Buyer / Customer Info
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {/* Customer Name input with dropdown */}
            <div className="form-group" style={{ marginBottom: 0, position: 'relative' }} ref={dropdownRef}>
              <label className="form-label">Customer / Company Name *</label>
              <input
                type="text"
                className="form-input form-input-lg"
                placeholder="Enter customer name..."
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                autoFocus
              />

              {showSuggestions && matchingCustomers.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0 0 8px 8px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                    zIndex: 50,
                    maxHeight: '180px',
                    overflowY: 'auto',
                  }}
                >
                  {matchingCustomers.slice(0, 5).map((c) => (
                    <div
                      key={c._id}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseDown={() => handleSelectCustomer(c)}
                    >
                      <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{c.companyName}</strong>
                        {c.customerPhone && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                            Cell: {c.customerPhone}
                          </span>
                        )}
                      </div>
                      <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>Select</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Phone */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Phone / WhatsApp (Optional)</label>
              <input
                type="tel"
                className="form-input"
                placeholder="e.g. 9876543210"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '18px 0' }} />

        {/* ── STEP 2: ITEMS & WEIGHT / RATE ── */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: '#0b5394', color: '#ffffff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
                2
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Weighing & Goods Details
              </h3>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={handleAddItem}
            >
              <PlusIcon size={14} /> Add Item
            </button>
          </div>

          {/* Mobile Item Cards */}
          <div className="mobile-items-list">
            {items.map((item, index) => (
              <div
                key={index}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0b5394' }}>Item #{index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#ef4444', padding: '2px 6px', fontSize: '0.8rem' }}
                      onClick={() => handleRemoveItem(index)}
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '0.76rem' }}>Description of Goods</label>
                  <input
                    type="text"
                    className="form-input"
                    value={item.particulars}
                    onChange={(e) => handleItemChange(index, 'particulars', e.target.value)}
                    placeholder="Fresh Seafood / Prawns Supply"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.76rem' }}>Weight (KG) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input form-input-lg"
                      style={{ fontWeight: 800, fontSize: '1.1rem', textAlign: 'right', color: '#0f172a' }}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.76rem' }}>Rate (₹/KG) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input form-input-lg"
                      style={{ fontWeight: 800, fontSize: '1.1rem', textAlign: 'right', color: '#0f172a' }}
                      value={item.rate}
                      onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '6px', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Amount:</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0b5394' }}>
                    {formatCurrency(item.amount || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="table-container desktop-only-table" style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ width: '45px', textAlign: 'center' }}>S.No</th>
                  <th>PARTICULARS</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>HSN</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>QTY (KG) *</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>PRICE (₹) *</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>AMOUNT (₹)</th>
                  <th style={{ width: '45px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {index + 1}
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        style={{ padding: '6px 10px', fontSize: '0.9rem' }}
                        value={item.particulars}
                        onChange={(e) => handleItemChange(index, 'particulars', e.target.value)}
                        placeholder="Description of goods"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        style={{ padding: '6px 8px', textAlign: 'center', fontSize: '0.9rem' }}
                        value={item.hsn}
                        onChange={(e) => handleItemChange(index, 'hsn', e.target.value)}
                        placeholder="0306"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, fontSize: '0.92rem' }}
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, fontSize: '0.92rem' }}
                        value={item.rate}
                        onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {formatCurrency(item.amount || 0)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {items.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#ef4444', padding: '4px 8px' }}
                          onClick={() => handleRemoveItem(index)}
                          title="Remove Row"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '18px 0' }} />

        {/* ── STEP 3: PAYMENT STATUS & GRAND TOTAL ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: '#0b5394', color: '#ffffff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
              3
            </div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Payment & Total
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Payment Status</label>
              <select
                className="form-input"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                style={{ fontWeight: 700 }}
              >
                <option value="Pending">⏳ Pending</option>
                <option value="Paid">✅ Paid</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Invoice Date</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Grand Total Highlight Card */}
          <div style={{ background: 'linear-gradient(135deg, #0b5394 0%, #1e40af 100%)', borderRadius: '12px', padding: '16px 20px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', boxShadow: '0 4px 14px rgba(11, 83, 148, 0.25)' }}>
            <div>
              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85, fontWeight: 600 }}>
                Total Bill Amount
              </div>
              <div style={{ fontSize: '0.78rem', opacity: 0.75, marginTop: '2px' }}>
                {items.length} item(s) included
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
              {formatCurrency(grandTotal)}
            </div>
          </div>

          {/* Action Buttons — Full Width on Mobile */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', background: '#0b5394' }}
              onClick={() => handleSave('print')}
              disabled={saving}
              title="Press Ctrl + Enter to Save and Print immediately"
            >
              <PrintIcon size={20} /> {saving ? 'Saving...' : 'Save & Print (Ctrl + Enter)'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem', fontWeight: 600, borderRadius: '8px' }}
              onClick={() => handleSave('save')}
              disabled={saving}
            >
              Save Only
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', padding: '10px', fontSize: '0.9rem', color: '#64748b' }}
              onClick={() => navigate('/')}
            >
              Cancel
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
