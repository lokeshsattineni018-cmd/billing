import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { formatCurrency, formatDateTime, numberToWords } from '../utils/helpers';
import { PrintIcon, DownloadIcon } from '../components/Icons';

export default function PublicInvoice() {
  const { id } = useParams();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/bills/public/${id}`);
      setBill(res.data);
    } catch (err) {
      console.error('Failed to load invoice:', err);
      setError('Invoice not found or link has expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/bills/${id}/pdf`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${bill.billNo || 'Official'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('PDF download error:', e);
      window.open(`/api/bills/${id}/pdf`, '_blank');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '16px', color: '#64748b', fontWeight: 600, fontSize: '0.9rem' }}>Loading Official Invoice...</p>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', padding: '20px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '32px', maxWidth: '440px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', fontWeight: 800 }}>Invoice Not Found</h3>
          <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '0.88rem' }}>{error || 'Unable to display invoice.'}</p>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Please contact Vijaya Durga Agencies for assistance.</p>
        </div>
      </div>
    );
  }

  const itemsList = bill.items && bill.items.length > 0 ? bill.items : [{
    sno: 1,
    particulars: bill.particulars || 'Fresh Seafood / Prawns Supply',
    hsn: bill.hsn || '0306',
    quantity: bill.quantity,
    rate: bill.rate,
    amount: bill.total,
  }];

  const billDate = new Date(bill.date);
  const dd = String(billDate.getDate()).padStart(2, '0');
  const mm = String(billDate.getMonth() + 1).padStart(2, '0');
  const yyyy = billDate.getFullYear();
  const formattedDate = `${dd}-${mm}-${yyyy}`;
  const finalAmount = bill.grandTotal || bill.total || 0;
  const amountInWordsText = numberToWords(finalAmount);
  const emptyRowsCount = Math.max(1, 5 - itemsList.length);

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '20px 12px 60px 12px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Top Floating Action Bar for Customers */}
      <div
        style={{
          maxWidth: '860px',
          margin: '0 auto 16px auto',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Tax Invoice
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0b5394' }}>
            Invoice #{bill.billNo}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleDownloadPDF}
            className="btn btn-primary"
            style={{ background: '#0b5394', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <DownloadIcon size={16} color="#ffffff" /> Download Official PDF
          </button>
          <button
            onClick={() => window.print()}
            className="btn btn-secondary"
            style={{ fontWeight: 700, fontSize: '0.85rem', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <PrintIcon size={16} /> Print
          </button>
        </div>
      </div>

      {/* Official Authentic Invoice Frame */}
      <div className="official-invoice-frame" style={{ maxWidth: '860px', margin: '0 auto', background: '#ffffff' }}>
        {/* VOID Watermark if cancelled */}
        {bill.isVoided && (
          <div style={{
            position: 'absolute',
            top: '40%',
            left: '10%',
            right: '10%',
            textAlign: 'center',
            transform: 'rotate(-25deg)',
            fontSize: '4.5rem',
            fontWeight: 900,
            color: 'rgba(220, 38, 38, 0.22)',
            letterSpacing: '12px',
            border: '6px dashed rgba(220, 38, 38, 0.3)',
            padding: '16px 24px',
            zIndex: 10,
            pointerEvents: 'none',
          }}>
            CANCELLED
          </div>
        )}

        {/* 1. Header Bar */}
        <div className="invoice-head-bar">
          <span>TAX INVOICE / CASH / CREDIT</span>
          <span className="invoice-blessing">॥ జై శ్రీరామ్ ॥</span>
          <span>Cell: 9441429745</span>
        </div>

        {/* 2. Brand Crest & Business Title */}
        <div className="invoice-brand-row">
          <img src="/assets/ganesha.jpg" alt="Lord Ganesha" className="invoice-brand-avatar" />

          <div className="invoice-title-block">
            <h1 className="invoice-company-heading">VIJAYA DURGA AGENCIES</h1>
            <div className="invoice-proprietor-line">
              Prop: <strong>SATTINENI VENKATA DHANA LAXMI</strong> &nbsp;|&nbsp; GSTIN: <strong>37KATPS1500Q1ZR</strong>
            </div>
            <div className="invoice-address-line">
              D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA - 534 281, Mutyalapalli, West Godavari Dist., A.P.
            </div>
          </div>

          <img src="/assets/durga.jpg" alt="Durga Maa" className="invoice-brand-avatar" />
        </div>

        {/* 3. Invoice No & Date */}
        <div className="invoice-meta-row">
          <div className="invoice-meta-no">
            No. <span className="invoice-meta-no-val">{bill.billNo}</span>
          </div>
          <div className="invoice-meta-date">
            Date: <span className="invoice-meta-date-val">{formattedDate}</span>
          </div>
        </div>

        {/* 4. Customer Information */}
        <div className="invoice-customer-box">
          <div className="invoice-customer-row">
            <span className="invoice-customer-label">M/s.</span>
            <span className="invoice-customer-name-fill">{bill.companyName}</span>
          </div>
          <div className="invoice-customer-extra-row">
            <div className="invoice-customer-extra-col">
              <span className="invoice-customer-sublabel">Phone / Mobile:</span>
              <span className="invoice-customer-subval">{bill.customerPhone ? `+91 ${bill.customerPhone}` : '—'}</span>
            </div>
            <div className="invoice-customer-extra-col">
              <span className="invoice-customer-sublabel">Customer GSTIN:</span>
              <span className="invoice-customer-subval">{bill.companyGstin || '37KATPS1500Q1ZR'}</span>
            </div>
          </div>
        </div>

        {/* 5. Authentic Items Table */}
        <table className="invoice-items-table">
          <thead>
            <tr>
              <th className="col-sno">S.No</th>
              <th className="col-particulars">PARTICULARS</th>
              <th className="col-hsn">H.S.N.</th>
              <th className="col-qty">QUANTITY<br/><span style={{ fontSize: '0.66rem', fontWeight: 600 }}>Kgs.</span></th>
              <th className="col-rate">RATE<br/><span style={{ fontSize: '0.66rem', fontWeight: 600 }}>Rs. &nbsp; Ps.</span></th>
              <th className="col-amount">AMOUNT<br/><span style={{ fontSize: '0.66rem', fontWeight: 600 }}>Rs. &nbsp; Ps.</span></th>
            </tr>
          </thead>
          <tbody>
            {itemsList.map((item, idx) => (
              <tr key={idx} className="item-data-row">
                <td className="col-sno text-center">{item.sno || idx + 1}</td>
                <td className="col-particulars font-bold">{item.particulars}</td>
                <td className="col-hsn text-center">{item.hsn || '0306'}</td>
                <td className="col-qty text-right font-bold">{Number(item.quantity || 0).toFixed(2)}</td>
                <td className="col-rate text-right">{Number(item.rate || 0).toFixed(2)}</td>
                <td className="col-amount text-right font-bold">{Number(item.amount || (item.quantity * item.rate) || 0).toFixed(2)}</td>
              </tr>
            ))}

            {Array.from({ length: emptyRowsCount }).map((_, i) => (
              <tr key={`empty-${i}`} className="item-empty-row">
                <td className="col-sno">&nbsp;</td>
                <td className="col-particulars">&nbsp;</td>
                <td className="col-hsn">&nbsp;</td>
                <td className="col-qty">&nbsp;</td>
                <td className="col-rate">&nbsp;</td>
                <td className="col-amount">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 6. Tax Breakdown */}
        {((bill.cgstAmount > 0) || (bill.sgstAmount > 0) || (bill.igstAmount > 0)) && (
          <div className="invoice-tax-summary-table">
            <div className="tax-summary-row">
              <span className="tax-summary-label">Taxable Value:</span>
              <span className="tax-summary-val">{formatCurrency(bill.taxableValue || bill.total)}</span>
            </div>
            {bill.cgstAmount > 0 && (
              <div className="tax-summary-row">
                <span className="tax-summary-label">CGST ({bill.cgstRate || '2.5%'}):</span>
                <span className="tax-summary-val">{formatCurrency(bill.cgstAmount)}</span>
              </div>
            )}
            {bill.sgstAmount > 0 && (
              <div className="tax-summary-row">
                <span className="tax-summary-label">SGST ({bill.sgstRate || '2.5%'}):</span>
                <span className="tax-summary-val">{formatCurrency(bill.sgstAmount)}</span>
              </div>
            )}
            {bill.igstAmount > 0 && (
              <div className="tax-summary-row">
                <span className="tax-summary-label">IGST ({bill.igstRate || '5%'}):</span>
                <span className="tax-summary-val">{formatCurrency(bill.igstAmount)}</span>
              </div>
            )}
          </div>
        )}

        {/* 7. Footer: Words, Bank Details, Signature */}
        <div className="invoice-footer-grid">
          <div className="invoice-footer-left">
            <div className="invoice-words-row">
              <span className="invoice-words-label">Rs. (in words):</span>
              <span className="invoice-words-text">{amountInWordsText}</span>
            </div>

            <div className="invoice-bank-box">
              <div className="invoice-bank-title">BANK PAYMENT DETAILS:</div>
              <div className="invoice-bank-text">
                <div>Bank: <strong>KARUR VYSYA BANK (KVB)</strong></div>
                <div>A/C Name: <strong>VIJAYA DURGA AGENCIES</strong></div>
                <div>A/C No: <strong>4164135000008779</strong></div>
                <div>IFSC: <strong>KVBL0004164</strong> &nbsp;|&nbsp; Branch: <strong>BHIMAVARAM</strong></div>
              </div>
            </div>

            <div className="invoice-terms-line">
              Goods once sold will not be taken back. Subject to local Jurisdiction.
            </div>
          </div>

          <div className="invoice-footer-right">
            <div className="invoice-total-display-cell">
              <span className="invoice-total-tag">TOTAL:</span>
              <span className="invoice-total-num">
                {Number(finalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="invoice-signature-container">
              <div className="invoice-for-company">For VIJAYA DURGA AGENCIES</div>
              <div className="invoice-sign-space"></div>
              <div className="invoice-sign-title">Authorized Signatory / Proprietor</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
