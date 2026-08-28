import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { billsAPI } from '../services/api';
import { formatCurrency, useToast, Toast } from '../utils/helpers';
import { PrintIcon, PlusIcon } from '../components/Icons';

export default function NewBill() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, showToast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];

  const [companyName, setCompanyName] = useState('');
  const [date, setDate] = useState(todayStr);
  const [companyGstin, setCompanyGstin] = useState('37KATPS1500Q1ZR');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [saving, setSaving] = useState(false);

  // Customer suggestions
  const [customersList, setCustomersList] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef(null);

  // Table items
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

  // Tax inputs (optional)
  const [cgstRate, setCgstRate] = useState('');
  const [cgstAmount, setCgstAmount] = useState('');
  const [sgstRate, setSgstRate] = useState('');
  const [sgstAmount, setSgstAmount] = useState('');
  const [igstAmount, setIgstAmount] = useState('');

  // Load existing customers for auto-complete
  useEffect(() => {
    loadCustomers();

    // Check if cloning an existing bill
    if (location.state?.cloneBill) {
      const b = location.state.cloneBill;
      setCompanyName(b.companyName || '');
      setCompanyGstin(b.companyGstin || '37KATPS1500Q1ZR');
      setCustomerPhone(b.customerPhone || '');
      if (b.items && b.items.length > 0) {
        setItems(b.items.map((it, idx) => ({ ...it, sno: idx + 1 })));
      } else if (b.quantity) {
        setItems([{
          sno: 1,
          particulars: b.particulars || 'Fresh Seafood / Prawns Supply',
          hsn: b.hsn || '0306',
          quantity: b.quantity,
          rate: b.rate,
          taxRate: '',
          amount: b.total,
        }]);
      }
    }
  }, [location.state]);

  const loadCustomers = async () => {
    try {
      const res = await billsAPI.getLedger();
      if (res.data?.customers) {
        setCustomersList(res.data.customers);
      }
    } catch (err) {
      console.error('Failed to load customers for auto-complete:', err);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCustomer = (c) => {
    setCompanyName(c.companyName);
    if (c.companyGstin) setCompanyGstin(c.companyGstin);
    if (c.customerPhone) setCustomerPhone(c.customerPhone);
    setShowSuggestions(false);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    if (field === 'quantity' || field === 'rate') {
      const q = parseFloat(newItems[index].quantity) || 0;
      const r = parseFloat(newItems[index].rate) || 0;
      newItems[index].amount = Math.round(q * r * 100) / 100;
    }

    setItems(newItems);
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
    const newItems = items.filter((_, i) => i !== index).map((item, i) => ({ ...item, sno: i + 1 }));
    setItems(newItems);
  };

  const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
  const taxSum =
    (parseFloat(cgstAmount) || 0) +
    (parseFloat(sgstAmount) || 0) +
    (parseFloat(igstAmount) || 0);
  const grandTotal = Math.round((subtotal + taxSum) * 100) / 100;

  const handleSave = async (openPDF = false) => {
    if (!companyName.trim()) {
      showToast('Please enter Company / Customer Name (M/s)', 'error');
      return;
    }

    const validItems = items.filter((it) => parseFloat(it.quantity) > 0 && parseFloat(it.rate) >= 0);
    if (validItems.length === 0) {
      showToast('Please enter Quantity and Rate for at least one item row', 'error');
      return;
    }

    setSaving(true);
    try {
      const invoiceData = {
        companyName: companyName.trim(),
        date,
        companyGstin: companyGstin.trim() || '37KATPS1500Q1ZR',
        customerPhone: customerPhone.trim(),
        items: items.map((it, idx) => ({
          sno: idx + 1,
          particulars: it.particulars || 'Fresh Seafood / Prawns Supply',
          hsn: it.hsn || '0306',
          quantity: parseFloat(it.quantity) || 0,
          rate: parseFloat(it.rate) || 0,
          taxRate: it.taxRate || '',
          amount: it.amount || 0,
        })),
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

      if (openPDF) {
        const pdfUrl = billsAPI.getPDF(invoice._id);
        window.open(pdfUrl, '_blank');
      }

      setTimeout(() => navigate(`/bills/${invoice._id}`), 400);
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  const matchingCustomers = customersList.filter((c) =>
    companyName.trim() &&
    c.companyName?.toLowerCase().includes(companyName.toLowerCase()) &&
    c.companyName?.toLowerCase() !== companyName.toLowerCase()
  );

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      <div className="page-header">
        <h2>New Invoice</h2>
        <p>Enter bill details in table format — GSTIN fixed to 37KATPS1500Q1ZR</p>
      </div>

      {/* Main Invoice Pad Card */}
      <div className="card new-bill-card">
        {/* Top Details Row */}
        <div className="new-bill-header-grid">
          <div className="form-group" style={{ marginBottom: 0, position: 'relative' }} ref={dropdownRef}>
            <label className="form-label">M/s Customer / Company Name *</label>
            <input
              type="text"
              className="form-input form-input-lg"
              placeholder="Type buyer / customer name..."
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              autoFocus
            />

            {/* Customer Auto-complete suggestions */}
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
                    className="customer-suggestion-item"
                  >
                    <div>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{c.companyName}</strong>
                      {c.customerPhone && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                          Cell: {c.customerPhone}
                        </span>
                      )}
                    </div>
                    <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>Auto-Fill</span>
                  </div>
                ))}
              </div>
            )}
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

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">GSTIN (Fixed)</label>
            <input
              type="text"
              className="form-input"
              value={companyGstin}
              onChange={(e) => setCompanyGstin(e.target.value)}
              style={{ fontWeight: 600, color: 'var(--accent-primary)', backgroundColor: 'var(--bg-secondary)' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Customer Cell (Optional)</label>
            <input
              type="tel"
              className="form-input"
              placeholder="e.g. 9876543210"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
        </div>

        {/* Bill Items Section */}
        <div style={{ marginTop: '20px', marginBottom: '16px' }}>
          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent-primary)', marginBottom: '8px', display: 'block' }}>
            Bill Items
          </label>

          {/* Mobile Item Cards (Visible on Mobile & Tablets) */}
          <div className="mobile-items-list">
            {items.map((item, index) => (
              <div key={index} className="mobile-item-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Item #{index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#ef4444', padding: '2px 8px', fontSize: '0.85rem' }}
                      onClick={() => handleRemoveItem(index)}
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Description / Goods *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={item.particulars}
                    onChange={(e) => handleItemChange(index, 'particulars', e.target.value)}
                    placeholder="e.g. Fresh Seafood / Prawns Supply"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Qty (KG) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      style={{ fontWeight: 700, fontSize: '1rem', textAlign: 'right' }}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Price (₹/KG) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      style={{ fontWeight: 700, fontSize: '1rem', textAlign: 'right' }}
                      value={item.rate}
                      onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', marginTop: '4px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Item Amount:</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                    {formatCurrency(item.amount || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table Format Entry */}
          <div className="table-container desktop-only-table" style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ width: '45px', textAlign: 'center' }}>S.No</th>
                  <th style={{ minWidth: '220px' }}>PARTICULARS</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>HSN</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>QTY (KG) *</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>PRICE (₹) *</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>RATE OF TAX</th>
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
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        style={{ padding: '6px 8px', textAlign: 'center', fontSize: '0.9rem' }}
                        value={item.taxRate}
                        onChange={(e) => handleItemChange(index, 'taxRate', e.target.value)}
                        placeholder="e.g. 5%"
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

          <div className="new-bill-table-footer" style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddItem}
            >
              <PlusIcon size={14} /> Add Row
            </button>

            <div style={{ fontSize: '1rem', fontWeight: 700 }}>
              Items Subtotal: <span style={{ color: 'var(--accent-primary)', marginLeft: '8px' }}>{formatCurrency(subtotal)}</span>
            </div>
          </div>
        </div>

        {/* Tax Section (Optional inputs) */}
        <details style={{ marginTop: '16px', marginBottom: '18px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 16px' }}>
          <summary style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>
            Tax Breakdown Fields (CGST / SGST / IGST) — Optional
          </summary>
          <div className="tax-grid" style={{ marginTop: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>CGST Rate</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 2.5%"
                value={cgstRate}
                onChange={(e) => setCgstRate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>CGST Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                placeholder="0.00"
                value={cgstAmount}
                onChange={(e) => setCgstAmount(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>SGST Rate</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 2.5%"
                value={sgstRate}
                onChange={(e) => setSgstRate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>SGST Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                placeholder="0.00"
                value={sgstAmount}
                onChange={(e) => setSgstAmount(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>IGST Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                placeholder="0.00"
                value={igstAmount}
                onChange={(e) => setIgstAmount(e.target.value)}
              />
            </div>
          </div>
        </details>

        {/* Grand Total Box */}
        <div className="invoice-total-section" style={{ marginTop: '12px' }}>
          <div className="invoice-total-box" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div className="invoice-total-label" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              GRAND TOTAL (Items Total + Tax)
            </div>
            <div className="invoice-total-value" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
              {formatCurrency(grandTotal)}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="invoice-actions" style={{ marginTop: '24px' }}>
          <button
            type="button"
            className="btn btn-primary btn-large"
            onClick={() => handleSave(true)}
            disabled={saving}
          >
            <PrintIcon size={18} /> {saving ? 'Saving...' : 'Save & Print PDF'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-large"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            Save Only
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-large"
            onClick={() => navigate('/')}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
