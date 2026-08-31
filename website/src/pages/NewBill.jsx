import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { billsAPI, settingsAPI } from '../services/api';
import { formatCurrency, useToast, Toast } from '../utils/helpers';
import { useLanguage } from '../context/LanguageContext';
import { PrintIcon, PlusIcon, ArrowLeftIcon } from '../components/Icons';

const DRAFT_KEY = 'srsf_bill_draft';

export default function NewBill() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { toast, showToast } = useToast();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [companyName, setCompanyName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [companyGstin, setCompanyGstin] = useState('');
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

  // Tax Details
  const [cgstRate, setCgstRate] = useState('2.5');
  const [cgstAmount, setCgstAmount] = useState('100.00');
  const [sgstRate, setSgstRate] = useState('2.5');
  const [sgstAmount, setSgstAmount] = useState('100.00');
  const [igstAmount, setIgstAmount] = useState('100.00');

  const [customersList, setCustomersList] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasDraftNotice, setHasDraftNotice] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadSettings();
    loadCustomers();

    // Check if cloning an existing bill
    if (location.state?.cloneBill) {
      const clone = location.state.cloneBill;
      setCompanyName(clone.companyName || '');
      setCustomerPhone(clone.customerPhone ? clone.customerPhone.replace(/\D/g, '').slice(0, 10) : '');
      if (clone.companyGstin) setCompanyGstin(clone.companyGstin);
      if (clone.cgstRate) setCgstRate(clone.cgstRate);
      if (clone.cgstAmount) setCgstAmount(String(clone.cgstAmount));
      if (clone.sgstRate) setSgstRate(clone.sgstRate);
      if (clone.sgstAmount) setSgstAmount(String(clone.sgstAmount));
      if (clone.igstAmount) setIgstAmount(String(clone.igstAmount));
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
      return;
    }

    // Task 3: Check for saved offline draft on initial load
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (draft && (draft.companyName || (draft.items && draft.items.some((i) => i.quantity || i.rate)))) {
          if (draft.companyName) setCompanyName(draft.companyName);
          if (draft.customerPhone) setCustomerPhone(draft.customerPhone);
          if (draft.date) setDate(draft.date);
          if (draft.paymentStatus) setPaymentStatus(draft.paymentStatus);
          if (draft.cgstRate) setCgstRate(draft.cgstRate);
          if (draft.cgstAmount) setCgstAmount(draft.cgstAmount);
          if (draft.sgstRate) setSgstRate(draft.sgstRate);
          if (draft.sgstAmount) setSgstAmount(draft.sgstAmount);
          if (draft.igstAmount) setIgstAmount(draft.igstAmount);
          if (draft.items && draft.items.length > 0) setItems(draft.items);
          setHasDraftNotice(true);
        }
      }
    } catch (e) {
      console.warn('Could not read draft from localStorage', e);
    }
  }, [location.state]);

  // Debounced auto-save draft to localStorage (avoids input lag while typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (companyName || items.some((it) => it.quantity || it.rate)) {
        const draftData = {
          date,
          companyName,
          customerPhone,
          paymentStatus,
          items,
          cgstRate,
          cgstAmount,
          sgstRate,
          sgstAmount,
          igstAmount,
          savedAt: new Date().toISOString(),
        };
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
        } catch (e) {
          console.warn('Failed to auto-save draft to localStorage', e);
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [date, companyName, customerPhone, paymentStatus, items, cgstRate, cgstAmount, sgstRate, sgstAmount, igstAmount]);

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
      } else {
        showToast('Business GSTIN not set. Please update in Settings.', 'error');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await billsAPI.getCustomers();
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
      setCustomerPhone(customer.customerPhone.replace(/\D/g, '').slice(0, 10));
    }
    setShowSuggestions(false);
  };

  // Task 7: Restricted numeric-only 10-digit phone formatter
  const handlePhoneChange = (e) => {
    const numeric = e.target.value.replace(/\D/g, '').slice(0, 10);
    setCustomerPhone(numeric);
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

  const handleClearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setCompanyName('');
    setCustomerPhone('');
    setItems([
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
    setHasDraftNotice(false);
    showToast('Draft cleared');
  };

  const { subtotal, totalTax, grandTotal } = useMemo(() => {
    const sub = Math.round(items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) * 100) / 100;
    const numCgst = parseFloat(cgstAmount) || 0;
    const numSgst = parseFloat(sgstAmount) || 0;
    const numIgst = parseFloat(igstAmount) || 0;
    const tax = Math.round((numCgst + numSgst + numIgst) * 100) / 100;
    const grand = Math.round((sub + tax) * 100) / 100;
    return { subtotal: sub, totalTax: tax, grandTotal: grand };
  }, [items, cgstAmount, sgstAmount, igstAmount]);

  const handleSave = async (actionType = 'save') => {
    if (!companyName.trim()) {
      showToast('Customer / Company name is required', 'error');
      return;
    }

    const hasInvalidItem = items.some((it) => !it.quantity || parseFloat(it.quantity) <= 0 || !it.rate || parseFloat(it.rate) <= 0);
    if (hasInvalidItem) {
      showToast('Please enter a valid Quantity (> 0) and Price (> 0) for all items', 'error');
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
        cgstRate: cgstRate.trim(),
        cgstAmount: parseFloat(cgstAmount) || 0,
        sgstRate: sgstRate.trim(),
        sgstAmount: parseFloat(sgstAmount) || 0,
        igstRate: '',
        igstAmount: parseFloat(igstAmount) || 0,
        total: subtotal,
        grandTotal,
        paymentStatus,
      };

      const response = await billsAPI.create(invoiceData);
      const invoice = response.data;

      // Clear draft upon successful creation
      localStorage.removeItem(DRAFT_KEY);

      showToast(`Invoice #${invoice.billNo} created successfully`);

      if (actionType === 'print') {
        navigate(`/bills/${invoice._id}?autoprint=true`);
      } else {
        navigate(`/bills/${invoice._id}`);
      }
    } catch (error) {
      // Task 3: Offline / Network failure draft retention
      const isNetworkError = !error.response || error.code === 'ERR_NETWORK';
      if (isNetworkError) {
        showToast('Offline: Saved draft locally. You can resubmit once connection is restored.', 'error');
      } else {
        showToast(error.response?.data?.message || 'Failed to create invoice', 'error');
      }
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
  }, [companyName, customerPhone, items, date, paymentStatus, cgstRate, cgstAmount, sgstRate, sgstAmount, igstAmount, companyGstin]);

  const matchingCustomers = useMemo(() => {
    if (!companyName || !companyName.trim() || customersList.length === 0) return [];
    const q = companyName.toLowerCase();
    return customersList.filter((c) =>
      c.companyName?.toLowerCase().includes(q) &&
      c.companyName?.toLowerCase() !== q
    );
  }, [companyName, customersList]);

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      {/* Page Title & Back */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>{t('newInvoiceTitle')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '2px 0 0 0' }}>
            GSTIN: <span style={{ fontWeight: 700, color: '#0b5394' }}>{companyGstin || 'Loading settings...'}</span>
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          <ArrowLeftIcon size={16} /> {t('back')}
        </button>
      </div>

      {/* Task 3: Draft Restored Notification Banner */}
      {hasDraftNotice && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.84rem',
          color: '#1e3a8a',
        }}>
          <div>
            📝 <strong>Restored offline draft</strong> from your previous unsaved session.
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: '2px 8px', color: '#ef4444', fontWeight: 700 }}
            onClick={handleClearDraft}
          >
            Clear Draft
          </button>
        </div>
      )}

      {/* Structured Billing Form Card */}
      <div className="card new-bill-card" style={{ padding: '20px 16px', background: '#ffffff', border: '1px solid #e2e8f0' }}>

        {/* ── STEP 1: CUSTOMER DETAILS ── */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: '#eff6ff', color: '#0b5394', border: '1.5px solid #bfdbfe', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 800 }}>
              1
            </div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
              {t('step1Customer')}
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {/* Customer Name input with dropdown */}
            <div className="form-group" style={{ marginBottom: 0, position: 'relative' }} ref={dropdownRef}>
              <label className="form-label" style={{ fontWeight: 700 }}>{t('customerName')} *</label>
              <input
                type="text"
                className="form-input form-input-lg"
                placeholder={t('customerNamePlaceholder')}
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
                        <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{c.companyName}</strong>
                        {c.customerPhone && (
                          <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '8px' }}>
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

            {/* Task 7: Formatted Numeric-Only Phone Number */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>
                {t('customerPhone')} {customerPhone && <span style={{ fontSize: '0.72rem', color: customerPhone.length === 10 ? '#059669' : '#d97706' }}>({customerPhone.length}/10 digits)</span>}
              </label>
              <input
                type="tel"
                className="form-input"
                placeholder="10-digit mobile number"
                value={customerPhone}
                onChange={handlePhoneChange}
                maxLength={10}
              />
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '18px 0' }} />

        {/* ── STEP 2: ITEMS & WEIGHT / RATE ── */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: '#eff6ff', color: '#0b5394', border: '1.5px solid #bfdbfe', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 800 }}>
                2
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                {t('step2Goods')}
              </h3>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700 }}
              onClick={handleAddItem}
            >
              <PlusIcon size={14} /> {t('addItem')}
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
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0b5394' }}>{t('item')} #{index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#ef4444', padding: '2px 6px', fontSize: '0.8rem' }}
                      onClick={() => handleRemoveItem(index)}
                    >
                      ✕ {t('remove')}
                    </button>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '0.76rem' }}>{t('goodsDescription')}</label>
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
                    <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 700 }}>{t('weightKg')} *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input form-input-lg"
                      style={{ fontWeight: 800, fontSize: '1.1rem', textAlign: 'right', color: '#0f172a' }}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 700 }}>{t('ratePerKg')} *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input form-input-lg"
                      style={{ fontWeight: 800, fontSize: '1.1rem', textAlign: 'right', color: '#0f172a' }}
                      value={item.rate}
                      onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '6px', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>{t('itemAmount')}:</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0b5394' }}>
                    {formatCurrency(item.amount || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="table-container desktop-only-table" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ width: '45px', textAlign: 'center', verticalAlign: 'middle' }}>{t('sno')}</th>
                  <th style={{ verticalAlign: 'middle' }}>{t('particulars')}</th>
                  <th style={{ width: '90px', textAlign: 'center', verticalAlign: 'middle' }}>{t('hsn')}</th>
                  <th style={{ width: '130px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{t('weightKg')} *</th>
                  <th style={{ width: '130px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{t('price')} (₹) *</th>
                  <th style={{ width: '140px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{t('amount')} (₹)</th>
                  <th style={{ width: '45px', textAlign: 'center', verticalAlign: 'middle' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
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
                        min="0.01"
                        className="form-input"
                        style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, fontSize: '0.92rem' }}
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td>
                      {/* Task 8: Tab-to-new-row on the last rate field */}
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="form-input"
                        style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, fontSize: '0.92rem' }}
                        value={item.rate}
                        onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                        onKeyDown={(e) => {
                          if (index === items.length - 1 && e.key === 'Tab' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddItem();
                          }
                        }}
                        placeholder="0.00"
                        title={index === items.length - 1 ? 'Press Tab to automatically add a new row' : ''}
                      />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
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

          {/* ── Tax Details Breakdown Box ── */}
          <div style={{ marginTop: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0b5394' }}>
                {t('taxDetails')}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>{t('cgstRate')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={cgstRate}
                  onChange={(e) => setCgstRate(e.target.value)}
                  placeholder="2.5"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>{t('cgstAmount')}</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={cgstAmount}
                  onChange={(e) => setCgstAmount(e.target.value)}
                  placeholder="100.00"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>{t('sgstRate')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={sgstRate}
                  onChange={(e) => setSgstRate(e.target.value)}
                  placeholder="2.5"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>{t('sgstAmount')}</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={sgstAmount}
                  onChange={(e) => setSgstAmount(e.target.value)}
                  placeholder="100.00"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>{t('igstAmount')}</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={igstAmount}
                  onChange={(e) => setIgstAmount(e.target.value)}
                  placeholder="100.00"
                />
              </div>
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '18px 0' }} />

        {/* ── STEP 3: PAYMENT STATUS & GRAND TOTAL ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: '#eff6ff', color: '#0b5394', border: '1.5px solid #bfdbfe', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 800 }}>
              3
            </div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
              {t('step3Payment')}
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>{t('paymentStatus')}</label>
              <select
                className="form-input"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                style={{ fontWeight: 700 }}
              >
                <option value="Pending">⏳ {t('pending')}</option>
                <option value="Paid">✅ {t('paid')}</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>{t('invoiceDate')}</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Dual Total Summary Card (Before Tax & After Tax) */}
          <div style={{
            background: '#ffffff',
            border: '2px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            color: '#0f172a',
            marginBottom: '18px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
          }}>
            {/* 1. Before Tax Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '0.86rem', color: '#475569', fontWeight: 700 }}>
                  {t('totalBeforeTax')}
                </span>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8', marginLeft: '6px' }}>
                  ({items.length} {t('itemsIncluded')})
                </span>
              </div>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>
                {formatCurrency(subtotal)}
              </span>
            </div>

            {/* 2. Tax Additions Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '0.82rem', color: '#64748b' }}>
              <span style={{ fontWeight: 600 }}>
                {t('totalTaxAmount')}
              </span>
              <span style={{ fontWeight: 700, color: totalTax > 0 ? '#0b5394' : '#64748b' }}>
                + {formatCurrency(totalTax)}
              </span>
            </div>

            <div style={{ borderTop: '1.5px dashed #cbd5e1', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.86rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0b5394', fontWeight: 900 }}>
                  {t('grandTotalAfterTax')}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                  Final invoice payable amount
                </div>
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#0b5394', letterSpacing: '-0.5px' }}>
                {formatCurrency(grandTotal)}
              </div>
            </div>
          </div>

          {/* Action Buttons — Full Width & Clean White / Light Styling */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '2px solid #0b5394',
                color: '#0b5394',
                boxShadow: '0 2px 8px rgba(11, 83, 148, 0.08)'
              }}
              onClick={() => handleSave('print')}
              disabled={saving}
              title="Press Ctrl + Enter to Save and Print immediately"
            >
              <PrintIcon size={20} color="#0b5394" /> {saving ? t('saving') : t('saveAndPrint')}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem', fontWeight: 600, borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155' }}
              onClick={() => handleSave('save')}
              disabled={saving}
            >
              {t('saveOnly')}
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', padding: '10px', fontSize: '0.9rem', color: '#64748b' }}
              onClick={() => navigate('/')}
            >
              {t('cancel')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
