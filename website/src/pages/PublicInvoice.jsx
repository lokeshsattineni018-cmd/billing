import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { PrintIcon, DownloadIcon } from '../components/Icons';
import OfficialInvoiceSheet from '../components/OfficialInvoiceSheet';

export default function PublicInvoice() {
  const { id } = useParams();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPublicBill();
  }, [id]);

  const loadPublicBill = async () => {
    try {
      const response = await fetch(`/api/bills/public/${id}`);
      if (!response.ok) {
        throw new Error('Invoice not found or link has expired');
      }
      const data = await response.json();
      setBill(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const response = await fetch(`/api/bills/public/${id}/pdf`);
      if (!response.ok) throw new Error('PDF download failed');
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
      if (import.meta.env.DEV) { console.error('PDF download error:', e); }
      window.open(`/api/bills/public/${id}/pdf`, '_blank');
    } finally {
      setDownloadingPdf(false);
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
          <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Please contact Vijaya Durga Sea Foods for assistance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-invoice-page" style={{ minHeight: '100vh', background: '#f1f5f9', padding: '20px 12px 60px 12px' }}>
      {/* Top Floating Action Bar for Customers */}
      <div
        className="no-print"
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
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#52606d', textTransform: 'uppercase' }}>
            Tax Invoice
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0b5394' }}>
            Invoice #{bill.billNo}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="btn btn-primary"
            style={{ background: '#0b5394', color: '#ffffff', fontWeight: 700, fontSize: '0.85rem', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '180px', justifyContent: 'center' }}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? (
              <>
                <span className="btn-spinner" style={{ width: '14px', height: '14px' }}></span> Downloading PDF...
              </>
            ) : (
              <>
                <DownloadIcon size={16} color="#ffffff" /> Download Official PDF
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-secondary"
            style={{ fontWeight: 700, fontSize: '0.85rem', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <PrintIcon size={16} /> Print
          </button>
        </div>
      </div>

      {/* Official Authentic Invoice Frame (Shared with BillDetail) */}
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <OfficialInvoiceSheet
          bill={bill}
          watermarkText="CANCELLED"
          fallbackParticulars="HEAD-ON"
          emptyPhoneFallback="—"
          useSettingsPhone={false}
          bankDetails={{
            title: 'BANK PAYMENT DETAILS:',
            bankName: 'KARUR VYSYA BANK (KVB)',
            accountName: 'VIJAYA DURGA SEA FOODS',
            accountNo: '4164135000008779',
            ifsc: 'KVBL0004164',
            branch: 'BHIMAVARAM',
          }}
        />
      </div>
    </div>
  );
}
