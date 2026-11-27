import React from 'react';
import { numberToWords } from '../utils/helpers';
import ganeshaImg from '../assets/ganesha.jpg';
import durgaImg from '../assets/durga.jpg';
import ramDarbarImg from '../assets/ram_darbar.jpg';

const DEFAULT_BANK_DETAILS = {
  title: 'BANK : KARUR VYSYA BANK',
  accountNo: '4805135000002964',
  ifsc: 'KVBL0004815',
  branch: 'Narasapur',
};

/**
 * Shared Official Tax Invoice Sheet used by both BillDetail (authenticated)
 * and PublicInvoice (customer share link /view/:id).
 */
export default function OfficialInvoiceSheet({
  bill,
  businessSettings = {},
  bankDetails = DEFAULT_BANK_DETAILS,
  watermarkText = 'VOID / CANCELLED',
  fallbackParticulars = 'Fresh Seafood / Prawns Supply',
  emptyPhoneFallback = '9441429745',
  useSettingsPhone = true,
}) {
  if (!bill) return null;

  const itemsList =
    bill.items && bill.items.length > 0
      ? bill.items
      : [
          {
            sno: 1,
            count: bill.count || '',
            particulars: bill.particulars || fallbackParticulars,
            hsn: bill.hsn || '0306',
            quantity: bill.quantity,
            rate: bill.rate,
            taxRate: '',
            amount: bill.total,
          },
        ];

  const billDate = new Date(bill.date);
  const dd = String(billDate.getDate()).padStart(2, '0');
  const mm = String(billDate.getMonth() + 1).padStart(2, '0');
  const yyyy = billDate.getFullYear();
  const formattedDate = `${dd}-${mm}-${yyyy}`;
  const finalAmount = bill.grandTotal || bill.total || 0;
  const amountInWordsText = numberToWords(finalAmount);

  const prawnItems = itemsList.filter(
    (it) => it.count !== 'Ice' && it.particulars !== 'Ice'
  );
  const iceItem = itemsList.find(
    (it) => it.count === 'Ice' || it.particulars === 'Ice'
  );
  const prawnTotalQty = prawnItems.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0),
    0
  );
  const prawnSubtotal = prawnItems.reduce(
    (sum, it) => sum + (Number(it.amount || it.quantity * it.rate) || 0),
    0
  );
  const gapRowsCount =
    prawnItems.length >= 4
      ? 0
      : iceItem
      ? Math.max(0, 3 - prawnItems.length)
      : Math.max(1, 4 - prawnItems.length);

  const resolvedPhone = useSettingsPhone
    ? businessSettings?.phone || '9441429745'
    : '9441429745';
  const resolvedBusinessName =
    businessSettings?.businessName || 'VIJAYA DURGA SEA FOODS';
  const resolvedGstin = bill.companyGstin || '37KATPS1500Q1ZR';
  const resolvedCustomerPhone = bill.customerPhone || emptyPhoneFallback;

  return (
    <div className="official-invoice-frame" style={{ position: 'relative' }}>
      {bill.isVoided && (
        <div className="official-invoice-watermark" aria-hidden="true">
          {watermarkText}
        </div>
      )}

      <div
        className="official-invoice-sheet"
        style={{ opacity: bill.isVoided ? 0.75 : 1 }}
      >
        {/* 1. TOP BAR */}
        <div className="official-invoice-topbar">
          <div style={{ letterSpacing: '0.5px' }}>
            TAX INVOICE / CASH / CREDIT
          </div>
          <div className="official-invoice-blessing">॥ జై శ్రీరామ్ ॥</div>
          <div>Cell: {resolvedPhone}</div>
        </div>

        {/* 2. COMPANY HEADER WITH 3 DIVINE EMBLEMS */}
        <div className="official-invoice-brandrow">
          <div className="official-invoice-emblem official-invoice-emblem-left">
            <img src={ganeshaImg} alt="Lord Ganesha" width={84} height={84} />
          </div>

          <div className="official-invoice-titleblock">
            <img
              src={durgaImg}
              alt="Durga Maa"
              width={54}
              height={54}
              className="official-invoice-center-emblem"
            />
            <div className="official-invoice-company-heading">
              {resolvedBusinessName}
            </div>
            <div className="official-invoice-proprietor">
              Prop: <strong>SATTINENI VENKATA DHANA LAXMI</strong> &nbsp;|&nbsp;
              GSTIN: <strong>{resolvedGstin}</strong>
            </div>
            <div className="official-invoice-address">
              D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA
              - 534 281, Mutyalapalli, West Godavari Dist., A.P.
            </div>
          </div>

          <div className="official-invoice-emblem official-invoice-emblem-right">
            <img src={ramDarbarImg} alt="Ram Darbar" width={84} height={84} />
          </div>
        </div>

        {/* 3. BILL NO & DATE ROW */}
        <div className="official-invoice-metarow">
          <div className="official-invoice-metacell official-invoice-metacell-left">
            <span className="official-invoice-label">No.</span>
            <span className="official-invoice-billno">{bill.billNo}</span>
          </div>
          <div className="official-invoice-metacell">
            <span className="official-invoice-label">Date:</span>
            <span className="official-invoice-metadate">{formattedDate}</span>
          </div>
        </div>

        {/* 4. M/S CUSTOMER NAME ROW */}
        <div className="official-invoice-customerrow">
          <span className="official-invoice-label">M/s</span>
          <span className="official-invoice-customername">
            {bill.companyName}
          </span>
        </div>

        {/* 5. GSTIN & CELL ROW */}
        <div className="official-invoice-extrabox">
          <div>
            <span className="official-invoice-label">GSTIN : &nbsp;</span>
            <strong style={{ color: '#000000' }}>
              {bill.companyGstin || ''}
            </strong>
          </div>
          <div>
            <span className="official-invoice-label">Cell : &nbsp;</span>
            <strong style={{ color: '#000000' }}>
              {resolvedCustomerPhone}
            </strong>
          </div>
        </div>

        {/* 6. MAIN ITEMS TABLE */}
        <div className="official-invoice-tablewrap">
        <table className="official-invoice-table">
          <thead>
            <tr className="official-invoice-thead-top">
              <th rowSpan={2} style={{ width: '38px' }}>
                S.
                <br />
                No.
              </th>
              <th
                colSpan={3}
                style={{
                  borderBottom: '1px solid #0b5394',
                  background: '#e8f1f8',
                }}
              >
                HEAD-ON / HEAD-LESS
              </th>
              <th rowSpan={2} style={{ width: '60px' }}>
                RATE
                <br />
                OF TAX
              </th>
              <th
                rowSpan={2}
                className="official-invoice-th-amount"
                style={{ width: '105px' }}
              >
                AMOUNT
              </th>
            </tr>
            <tr className="official-invoice-thead-sub">
              <th style={{ width: '65px' }}>COUNT</th>
              <th style={{ width: '75px' }}>QTY (kg)</th>
              <th style={{ width: '70px' }}>RATE</th>
            </tr>
          </thead>
          <tbody>
            {prawnItems.map((it, idx) => (
              <tr key={idx} className="official-invoice-row">
                <td className="text-center font-bold">{it.sno || idx + 1}</td>
                <td className="text-center font-bold">{it.count || ''}</td>
                <td className="text-center tabular-num">{it.quantity} kg</td>
                <td className="text-right tabular-num" style={{ paddingRight: '6px' }}>
                  {Number(it.rate || 0).toFixed(2)}
                </td>
                <td className="text-center font-bold">{it.taxRate || ''}</td>
                <td
                  className="text-right font-bold tabular-num official-invoice-td-amount"
                  style={{ paddingRight: '8px' }}
                >
                  {Number(it.amount || it.quantity * it.rate || 0).toFixed(2)}
                </td>
              </tr>
            ))}

            {Array.from({ length: gapRowsCount }).map((_, i) => (
              <tr key={`empty-${i}`} className="official-invoice-emptyrow">
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td className="official-invoice-td-amount">&nbsp;</td>
              </tr>
            ))}

            {iceItem && (
              <>
                <tr className="official-invoice-prawn-subtotal">
                  <td></td>
                  <td className="text-center font-bold" style={{ color: '#0b5394' }}>
                    TOTAL
                  </td>
                  <td
                    className="text-center tabular-num"
                    style={{ fontWeight: 800, color: '#000000' }}
                  >
                    {Number(prawnTotalQty.toFixed(2))} kg
                  </td>
                  <td></td>
                  <td></td>
                  <td
                    className="text-right tabular-num official-invoice-td-amount"
                    style={{ paddingRight: '8px', fontWeight: 800, color: '#000000' }}
                  >
                    {prawnSubtotal.toFixed(2)}
                  </td>
                </tr>
                <tr className="official-invoice-row">
                  <td className="text-center font-bold"></td>
                  <td className="text-center font-bold">Ice</td>
                  <td className="text-center tabular-num">{iceItem.quantity}</td>
                  <td className="text-right tabular-num" style={{ paddingRight: '6px' }}>
                    {Number(iceItem.rate || 0).toFixed(2)}
                  </td>
                  <td className="text-center font-bold">
                    {iceItem.taxRate || '0'}
                  </td>
                  <td
                    className="text-right font-bold tabular-num official-invoice-td-amount"
                    style={{ paddingRight: '8px' }}
                  >
                    {Number(
                      iceItem.amount || iceItem.quantity * iceItem.rate || 0
                    ).toFixed(2)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
          <tfoot>
            <tr className="official-invoice-tfoot">
              <td></td>
              <td></td>
              <td className="text-center tabular-num" style={{ fontWeight: 800, color: '#000000' }}>
                {iceItem ? '' : `${Number(prawnTotalQty.toFixed(2))} kg`}
              </td>
              <td
                colSpan={2}
                className="text-right"
                style={{ paddingRight: '8px', fontWeight: 'bold', color: '#0b5394' }}
              >
                TOTAL
              </td>
              <td
                className="text-right tabular-num official-invoice-td-amount"
                style={{ paddingRight: '8px', fontWeight: 900, color: '#000000' }}
              >
                {Number(bill.total || finalAmount).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
        </div>

        {/* 7. TAX BREAKDOWN TABLE */}
        <div className="print-keep-together official-invoice-taxwrap">
          <div className="official-invoice-taxscroll">
            <div className="official-invoice-taxgrid-head">
              <div>Vehicle No.</div>
              <div>CGST Tax</div>
              <div>SGST Tax</div>
              <div>IGST Tax</div>
            </div>
            <div className="official-invoice-taxgrid-sub">
              <div></div>
              <div>Rate</div>
              <div>Amount</div>
              <div>Rate</div>
              <div>Amount</div>
              <div>Amount</div>
            </div>
            <div className="official-invoice-taxgrid-val tabular-num">
              <div style={{ fontWeight: 'bold', color: '#000000' }}>
                {bill.vehicleNo || ''}
              </div>
              <div>{bill.cgstRate || ''}</div>
              <div>
                {bill.cgstAmount ? Number(bill.cgstAmount).toFixed(2) : ''}
              </div>
              <div>{bill.sgstRate || ''}</div>
              <div>
                {bill.sgstAmount ? Number(bill.sgstAmount).toFixed(2) : ''}
              </div>
              <div>
                {bill.igstAmount ? Number(bill.igstAmount).toFixed(2) : ''}
              </div>
            </div>
          </div>
        </div>

        {/* 8. GRAND TOTAL HIGHLIGHT ROW */}
        <div className="print-keep-together official-invoice-grandtotal">
          <div className="official-invoice-grandtotal-label">GRAND TOTAL</div>
          <div className="official-invoice-grandtotal-val tabular-num">
            {Number(finalAmount).toFixed(2)}
          </div>
        </div>

        {/* 9. BANK DETAILS & SIGNATURE */}
        <div className="print-keep-together official-invoice-footergrid">
          <div className="official-invoice-bankbox">
            {bankDetails.accountName ? (
              <>
                <div style={{ fontWeight: 'bold', color: '#0b5394' }}>
                  {bankDetails.title}
                </div>
                <div>
                  Bank: <strong>{bankDetails.bankName}</strong>
                </div>
                <div>
                  A/C Name: <strong>{bankDetails.accountName}</strong>
                </div>
                <div>
                  A/C No: <strong>{bankDetails.accountNo}</strong>
                </div>
                <div>
                  IFSC: <strong>{bankDetails.ifsc}</strong> &nbsp;|&nbsp;
                  Branch: <strong>{bankDetails.branch}</strong>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 'bold', color: '#0b5394' }}>
                  {bankDetails.title}
                </div>
                <div>
                  A/c. NO : <strong>{bankDetails.accountNo}</strong>
                </div>
                <div>
                  IFSC : <strong>{bankDetails.ifsc}</strong>
                </div>
                <div>Branch : {bankDetails.branch}</div>
              </>
            )}
          </div>

          <div className="official-invoice-signbox">
            <div className="official-invoice-forcompany">
              For {resolvedBusinessName}
            </div>
            <div className="official-invoice-signline">Proprietor</div>
          </div>
        </div>
      </div>

      {/* Amount in Words */}
      <div className="official-invoice-words">
        <span style={{ fontWeight: 'bold', color: '#0b5394' }}>
          Amount in Words: &nbsp;
        </span>
        <span style={{ fontWeight: 'bold' }}>{amountInWordsText}</span>
      </div>
    </div>
  );
}
