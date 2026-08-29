import { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const translations = {
  en: {
    // Nav
    dashboard: 'Dashboard',
    newInvoice: 'New Invoice',
    invoiceHistory: 'Invoice History',
    customerLedger: 'Customer Ledger',
    settings: 'Settings',
    signOut: 'Sign Out',
    installApp: 'Install App',
    
    // Dashboard
    businessOverview: 'Business Overview & Trading Summary',
    createManageInvoices: 'Create & manage invoices',
    dailySummary: 'Daily Summary',
    todaysSales: "Today's Sales",
    thisMonthSales: 'This Month Sales',
    outstandingReceivables: 'Outstanding Receivables',
    totalLifetimeInvoices: 'Total Lifetime Invoices',
    recentInvoices: 'Recent Invoices',
    viewAll: 'View All',
    invoiceNo: 'Invoice #',
    date: 'Date',
    companyName: 'Company Name',
    qtyKg: 'Qty (KG)',
    status: 'Status',
    totalAmount: 'Total Amount',
    paid: 'Paid',
    pending: 'Pending',
    bills: 'bills',

    // New Bill
    newInvoiceTitle: 'New Invoice',
    step1Customer: '1. Buyer / Customer Info',
    customerName: 'Customer / Company Name',
    customerNamePlaceholder: 'Enter customer name...',
    customerPhone: 'Phone / WhatsApp (Optional)',
    step2Goods: '2. Weighing & Goods Details',
    goodsDescription: 'Description of Goods',
    defaultGoods: 'Fresh Seafood / Prawns Supply',
    weightKg: 'Weight (KG)',
    ratePerKg: 'Rate (₹/KG)',
    addItem: '+ Add Item',
    itemAmount: 'Item Amount',
    item: 'Item',
    remove: 'Remove',
    taxDetails: 'Tax Details (CGST / SGST / IGST)',
    cgstRate: 'CGST Rate',
    cgstAmount: 'CGST Amount (₹)',
    sgstRate: 'SGST Rate',
    sgstAmount: 'SGST Amount (₹)',
    igstAmount: 'IGST Amount (₹)',
    step3Payment: '3. Payment & Total',
    paymentStatus: 'Payment Status',
    invoiceDate: 'Invoice Date',
    totalBillAmount: 'Total Bill Amount',
    totalBeforeTax: 'Total (Before Tax)',
    totalTaxAmount: 'Total Tax (CGST + SGST + IGST)',
    grandTotalAfterTax: 'Grand Total (After Tax)',
    itemsIncluded: 'item(s) included',
    saveAndPrint: 'Save & Print (Ctrl + Enter)',
    saveOnly: 'Save Only',
    saving: 'Saving...',
    cancel: 'Cancel',
    back: 'Back',

    // Invoice Detail & Print
    printInvoice: 'Print Invoice',
    downloadPdf: 'Download PDF',
    shareWhatsApp: 'WhatsApp',
    reBill: 'Re-Bill',
    taxInvoiceHeader: 'TAX INVOICE / CASH / CREDIT',
    jaiShreeRam: '॥ జై శ్రీరామ్ ॥',
    proprietor: 'Proprietor',
    bankDetails: 'BANK PAYMENT DETAILS:',
    goodsDisclaimer: 'Goods once sold will not be taken back. Subject to local Jurisdiction.',
    amountInWords: 'Amount in Words',
    subtotal: 'Items Subtotal',
    total: 'TOTAL',
    grandTotal: 'GRAND TOTAL',
    hsn: 'HSN',
    price: 'PRICE',
    taxRate: 'RATE OF TAX',
    amount: 'AMOUNT',
    sno: 'S.No',
    particulars: 'PARTICULARS',
  },
  te: {
    // Nav
    dashboard: 'డ్యాష్‌బోర్డ్',
    newInvoice: 'కొత్త ఇన్వాయిస్',
    invoiceHistory: 'ఇన్వాయిస్ చరిత్ర',
    customerLedger: 'ఖాతాదారుల లెడ్జర్',
    settings: 'సెట్టింగ్స్',
    signOut: 'లాగ్ అవుట్',
    installApp: 'యాప్ ఇన్‌స్టాల్',

    // Dashboard
    businessOverview: 'వ్యాపార సమాచారం మరియు అమ్మకాల వివరాలు',
    createManageInvoices: 'ఇన్వాయిస్ బిల్లులు తయారు చేయండి',
    dailySummary: 'రోజువారీ నివేదిక',
    todaysSales: 'ఈ రోజు అమ్మకాలు',
    thisMonthSales: 'ఈ నెల అమ్మకాలు',
    outstandingReceivables: 'రావలసిన బాకీలు',
    totalLifetimeInvoices: 'మొత్తం ఇన్వాయిస్‌లు',
    recentInvoices: 'ఇటీవలి ఇన్వాయిస్ బిల్లులు',
    viewAll: 'అన్నీ చూడండి',
    invoiceNo: 'బిల్లు నం.',
    date: 'తేదీ',
    companyName: 'కస్టమర్ పేరు',
    qtyKg: 'తూకం (కేజీలు)',
    status: 'స్థితి',
    totalAmount: 'మొత్తం సొమ్ము',
    paid: 'చెల్లించబడింది',
    pending: 'బాకీ ఉంది',
    bills: 'బిల్లులు',

    // New Bill
    newInvoiceTitle: 'కొత్త ఇన్వాయిస్ బిల్లు',
    step1Customer: '1. కొనుగోలుదారు / కస్టమర్ వివరాలు',
    customerName: 'కస్టమర్ / కంపెనీ పేరు',
    customerNamePlaceholder: 'కస్టమర్ పేరు నమోదు చేయండి...',
    customerPhone: 'ఫోన్ / వాట్సాప్ నంబర్ (ఐచ్ఛికం)',
    step2Goods: '2. సరుకు మరియు తూకం వివరాలు',
    goodsDescription: 'సరుకు వివరాలు (రొయ్యలు / చేపలు)',
    defaultGoods: 'రొయ్యలు / చేపల సప్లై (Fresh Seafood / Prawns)',
    weightKg: 'తూకం (కేజీలు)',
    ratePerKg: 'ధర (రూ./కేజీ)',
    addItem: '+ కొత్త ఐటమ్ కలపండి',
    itemAmount: 'ఐటమ్ మొత్తం',
    item: 'ఐటమ్',
    remove: 'తొలగించు',
    taxDetails: 'పన్ను వివరాలు (CGST / SGST / IGST)',
    cgstRate: 'CGST శాతం (%)',
    cgstAmount: 'CGST మొత్తం (₹)',
    sgstRate: 'SGST శాతం (%)',
    sgstAmount: 'SGST మొత్తం (₹)',
    igstAmount: 'IGST మొత్తం (₹)',
    step3Payment: '3. చెల్లింపు మరియు మొత్తం బిల్లు',
    paymentStatus: 'చెల్లింపు స్థితి',
    invoiceDate: 'ఇన్వాయిస్ తేదీ',
    totalBillAmount: 'మొత్తం బిల్లు మొత్తం',
    totalBeforeTax: 'సరుకు మొత్తం (పన్ను లేకుండా - Before Tax)',
    totalTaxAmount: 'మొత్తం పన్ను (CGST + SGST + IGST)',
    grandTotalAfterTax: 'మొత్తం బిల్లు (పన్నుతో కలిపి - After Tax)',
    itemsIncluded: 'ఐటమ్స్ ఉన్నాయి',
    saveAndPrint: 'సేవ్ & ప్రింట్ చేయండి (Ctrl + Enter)',
    saveOnly: 'సేవ్ చేయండి',
    saving: 'సేవ్ అవుతోంది...',
    cancel: 'రద్దు చేయండి',
    back: 'వెనక్కి',

    // Invoice Detail & Print
    printInvoice: 'బిల్లు ప్రింట్ చేయండి',
    downloadPdf: 'PDF డౌన్‌లోడ్',
    shareWhatsApp: 'వాట్సాప్‌లో పంపండి',
    reBill: 'మళ్లీ బిల్లు చేయండి',
    taxInvoiceHeader: 'TAX INVOICE / CASH / CREDIT',
    jaiShreeRam: '॥ జై శ్రీరామ్ ॥',
    proprietor: 'ప్రొప్రైటర్',
    bankDetails: 'బ్యాంకు చెల్లింపు వివరాలు:',
    goodsDisclaimer: 'అమ్మిన సరుకు తిరిగి తీసుకోబడదు. స్థానిక న్యాయపరిధికి లోబడి ఉంటుంది.',
    amountInWords: 'అక్షరాలా మొత్తం',
    subtotal: 'సరుకు మొత్తం',
    total: 'మొత్తం (TOTAL)',
    grandTotal: 'మొత్తం చెల్లించవలసినది (GRAND TOTAL)',
    hsn: 'HSN కోడ్',
    price: 'ధర (రూ.)',
    taxRate: 'పన్ను రేటు',
    amount: 'మొత్తం (రూ.)',
    sno: 'వ.సంఖ్య',
    particulars: 'సరుకు వివరాలు',
  },
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('srsf_lang') || 'en';
  });

  const toggleLang = () => {
    const nextLang = lang === 'en' ? 'te' : 'en';
    setLang(nextLang);
    localStorage.setItem('srsf_lang', nextLang);
  };

  const t = (key) => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
