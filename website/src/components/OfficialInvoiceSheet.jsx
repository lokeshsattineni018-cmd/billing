import React from 'react';
import { numberToWords } from '../utils/helpers';
import { CANONICAL_BANK_DETAILS } from '../constants/bankDetails';
import ganeshaImg from '../assets/ganesha.jpg';
import durgaImg from '../assets/durga.jpg';
import ramDarbarImg from '../assets/ram_darbar.jpg';

/**
 * Shared Official Tax Invoice Sheet used by both BillDetail (authenticated)
 * and PublicInvoice (customer share link /view/:id).
 * Matches the original pre-redesign (d5ebe7d) official tax invoice markup & styling,
 * while reading canonical bank details from CANONICAL_BANK_DETAILS.
 */
export default function OfficialInvoiceSheet({
  bill,
  businessSettings = {},
  bankDetails = CANONICAL_BANK_DETAILS,
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
      {/* Screen/Print VOID Watermark */}
      {bill.isVoided && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '40%',
            left: '10%',
            right: '10%',
            textAlign: 'center',
            transform: 'rotate(-30deg)',
            fontSize: '4.5rem',
            fontWeight: 900,
            color: 'rgba(220, 38, 38, 0.22)',
            border: '6px dashed rgba(220, 38, 38, 0.3)',
            padding: '16px 20px',
            pointerEvents: 'none',
            zIndex: 10,
            letterSpacing: '4px',
          }}
        >
          {watermarkText}
        </div>
      )}

      <div
        style={{
          border: '1.5px solid #0b5394',
          background: '#ffffff',
          color: '#000000',
          fontFamily: 'Arial, Helvetica, sans-serif',
          margin: '0 auto',
          maxWidth: '800px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          opacity: bill.isVoided ? 0.75 : 1,
        }}
      >
        {/* 1. TOP BAR */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1.5px solid #0b5394',
            padding: '4px 12px',
            fontSize: '0.82rem',
            fontWeight: 'bold',
            color: '#0b5394',
          }}
        >
          <div style={{ letterSpacing: '0.5px' }}>
            TAX INVOICE / CASH / CREDIT
          </div>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              fontSize: '0.95rem',
              fontWeight: 900,
              color: '#0b5394',
              letterSpacing: '1px',
              fontFamily: "'Noto Sans Telugu', 'Segoe UI', Arial, sans-serif",
            }}
          >
            ॥ జై శ్రీరామ్ ॥
          </div>
          <div>Cell: {resolvedPhone}</div>
        </div>

        {/* 2. COMPANY HEADER WITH 3 DIVINE EMBLEMS (Exact Reference Style) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1.5px solid #0b5394',
            padding: '8px 16px',
          }}
        >
          {/* Lord Ganesha on Left */}
          <div
            style={{
              width: '92px',
              textAlign: 'left',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
            }}
          >
            <img
              src={ganeshaImg}
              alt="Lord Ganesha"
              width={84}
              height={84}
              style={{ width: '84px', height: '84px', objectFit: 'contain' }}
            />
          </div>

          {/* Center Company Details with Centered Durga Maa Emblem */}
          <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
            <img
              src={durgaImg}
              alt="Durga Maa"
              width={54}
              height={54}
              style={{
                width: '54px',
                height: '54px',
                objectFit: 'contain',
                margin: '0 auto 2px auto',
                display: 'block',
              }}
            />
            <div
              style={{
                color: '#0b5394',
                fontSize: '1.65rem',
                fontWeight: 900,
                letterSpacing: '0.8px',
                margin: '0 0 2px 0',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              {resolvedBusinessName}
            </div>
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 'bold',
                color: '#000000',
                margin: '2px 0',
              }}
            >
              Prop: SATTINENI VENKATA DHANA LAXMI &nbsp;|&nbsp; GSTIN:{' '}
              {resolvedGstin}
            </div>
            <div
              style={{
                fontSize: '0.68rem',
                color: '#000000',
                lineHeight: '1.25',
              }}
            >
              D.No. 2-41A, SATTINENI SRINIVASA TATAJI, Near Ramalayam, KOTHOTA
              - 534 281, Mutyalapalli, West Godavari Dist., A.P.
            </div>
          </div>

          {/* Ram Darbar on Right */}
          <div
            style={{
              width: '92px',
              textAlign: 'right',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <img
              src={ramDarbarImg}
              alt="Ram Darbar"
              width={84}
              height={84}
              style={{ width: '84px', height: '84px', objectFit: 'contain' }}
            />
          </div>
        </div>

        {/* 3. BILL NO & DATE ROW */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderBottom: '1.5px solid #0b5394',
            fontSize: '0.85rem',
          }}
        >
          <div
            style={{
              padding: '5px 10px',
              borderRight: '1.5px solid #0b5394',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontWeight: 'bold', color: '#0b5394' }}>No.</span>
            <span
              style={{ fontWeight: 900, color: '#b12704', fontSize: '1rem' }}
            >
              {bill.billNo}
            </span>
          </div>
          <div
            style={{
              padding: '5px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontWeight: 'bold', color: '#0b5394' }}>Date:</span>
            <span style={{ fontWeight: 'bold', color: '#000000' }}>
              {formattedDate}
            </span>
          </div>
        </div>

        {/* 4. M/S CUSTOMER NAME ROW */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1.5px solid #0b5394',
            padding: '5px 10px',
            gap: '10px',
            fontSize: '0.9rem',
          }}
        >
          <span style={{ fontWeight: 'bold', color: '#0b5394' }}>M/s</span>
          <span
            style={{ fontWeight: 800, color: '#000000', fontSize: '1rem' }}
          >
            {bill.companyName}
          </span>
        </div>

        {/* 5. GSTIN & CELL ROW */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1.5px solid #0b5394',
            padding: '5px 10px',
            fontSize: '0.82rem',
          }}
        >
          <div>
            <span style={{ fontWeight: 'bold', color: '#0b5394' }}>
              GSTIN : &nbsp;
            </span>
            <span style={{ fontWeight: 'bold', color: '#000000' }}>
              {bill.companyGstin || ''}
            </span>
          </div>
          <div>
            <span style={{ fontWeight: 'bold', color: '#0b5394' }}>
              Cell : &nbsp;
            </span>
            <span style={{ fontWeight: 'bold', color: '#000000' }}>
              {resolvedCustomerPhone}
            </span>
          </div>
        </div>

        {/* 6. MAIN ITEMS TABLE (HEAD-ON / HEAD-LESS) */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.82rem',
          }}
        >
          <thead>
            <tr
              style={{
                background: '#f0f5fa',
                color: '#0b5394',
                fontWeight: 'bold',
                textAlign: 'center',
              }}
            >
              <th
                rowSpan={2}
                style={{
                  borderRight: '1.5px solid #0b5394',
                  borderBottom: '1.5px solid #0b5394',
                  padding: '5px 4px',
                  width: '38px',
                }}
              >
                S.
                <br />
                No.
              </th>
              <th
                colSpan={3}
                style={{
                  borderRight: '1.5px solid #0b5394',
                  borderBottom: '1px solid #0b5394',
                  padding: '4px 4px',
                  background: '#e8f1f8',
                }}
              >
                HEAD-ON / HEAD-LESS
              </th>
              <th
                rowSpan={2}
                style={{
                  borderRight: '1.5px solid #0b5394',
                  borderBottom: '1.5px solid #0b5394',
                  padding: '5px 4px',
                  width: '60px',
                }}
              >
                RATE
                <br />
                OF TAX
              </th>
              <th
                rowSpan={2}
                style={{
                  padding: '5px 8px',
                  width: '105px',
                  textAlign: 'center',
                  borderBottom: '1.5px solid #0b5394',
                  verticalAlign: 'middle',
                }}
              >
                AMOUNT
              </th>
            </tr>
            <tr
              style={{
                background: '#f8fafc',
                color: '#0b5394',
                fontWeight: 'bold',
                textAlign: 'center',
                fontSize: '0.72rem',
                borderBottom: '1.5px solid #0b5394',
              }}
            >
              <th
                style={{
                  borderRight: '1.5px solid #0b5394',
                  padding: '3px 4px',
                  width: '65px',
                }}
              >
                COUNT
              </th>
              <th
                style={{
                  borderRight: '1.5px solid #0b5394',
                  padding: '3px 4px',
                  width: '75px',
                }}
              >
                QTY (kg)
              </th>
              <th
                style={{
                  borderRight: '1.5px solid #0b5394',
                  padding: '3px 4px',
                  width: '70px',
                }}
              >
                RATE
              </th>
            </tr>
          </thead>
          <tbody>
            {prawnItems.map((it, idx) => (
              <tr
                key={idx}
                style={{ height: '24px', borderBottom: '1px solid #c8d9e8' }}
              >
                <td
                  style={{
                    borderRight: '1.5px solid #0b5394',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}
                >
                  {it.sno || idx + 1}
                </td>
                <td
                  style={{
                    borderRight: '1.5px solid #0b5394',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}
                >
                  {it.count || ''}
                </td>
                <td
                  style={{
                    borderRight: '1.5px solid #0b5394',
                    textAlign: 'center',
                  }}
                >
                  {it.quantity} kg
                </td>
                <td
                  style={{
                    borderRight: '1.5px solid #0b5394',
                    textAlign: 'right',
                    paddingRight: '6px',
                  }}
                >
                  {Number(it.rate || 0).toFixed(2)}
                </td>
                <td
                  style={{
                    borderRight: '1.5px solid #0b5394',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}
                >
                  {it.taxRate || ''}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    paddingRight: '8px',
                    fontWeight: 'bold',
                  }}
                >
                  {Number(it.amount || it.quantity * it.rate || 0).toFixed(2)}
                </td>
              </tr>
            ))}

            {/* Blank rows */}
            {Array.from({ length: gapRowsCount }).map((_, i) => (
              <tr
                key={`empty-${i}`}
                style={{ height: '20px', borderBottom: '1px solid #c8d9e8' }}
              >
                <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                <td></td>
              </tr>
            ))}

            {/* If Ice exists: Show Total Prawn Quantity row, then Ice row below it */}
            {iceItem && (
              <>
                <tr
                  style={{
                    height: '24px',
                    background: '#f0f5fa',
                    borderTop: '1.5px solid #0b5394',
                    borderBottom: '1px solid #0b5394',
                  }}
                >
                  <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                  <td
                    style={{
                      borderRight: '1.5px solid #0b5394',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: '#0b5394',
                    }}
                  >
                    TOTAL
                  </td>
                  <td
                    style={{
                      borderRight: '1.5px solid #0b5394',
                      textAlign: 'center',
                      fontWeight: 800,
                      color: '#000000',
                    }}
                  >
                    {Number(prawnTotalQty.toFixed(2))} kg
                  </td>
                  <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                  <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
                  <td
                    style={{
                      textAlign: 'right',
                      paddingRight: '8px',
                      fontWeight: 800,
                      color: '#000000',
                    }}
                  >
                    {prawnSubtotal.toFixed(2)}
                  </td>
                </tr>
                <tr
                  style={{ height: '24px', borderBottom: '1px solid #c8d9e8' }}
                >
                  <td
                    style={{
                      borderRight: '1.5px solid #0b5394',
                      textAlign: 'center',
                      fontWeight: 'bold',
                    }}
                  ></td>
                  <td
                    style={{
                      borderRight: '1.5px solid #0b5394',
                      textAlign: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    Ice
                  </td>
                  <td
                    style={{
                      borderRight: '1.5px solid #0b5394',
                      textAlign: 'center',
                    }}
                  >
                    {iceItem.quantity}
                  </td>
                  <td
                    style={{
                      borderRight: '1.5px solid #0b5394',
                      textAlign: 'right',
                      paddingRight: '6px',
                    }}
                  >
                    {Number(iceItem.rate || 0).toFixed(2)}
                  </td>
                  <td
                    style={{
                      borderRight: '1.5px solid #0b5394',
                      textAlign: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    {iceItem.taxRate || '0'}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      paddingRight: '8px',
                      fontWeight: 'bold',
                    }}
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
            <tr
              style={{
                background: '#f0f5fa',
                borderTop: '1.5px solid #0b5394',
                borderBottom: '1.5px solid #0b5394',
                height: '26px',
                fontSize: '0.82rem',
              }}
            >
              <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
              <td style={{ borderRight: '1.5px solid #0b5394' }}></td>
              <td
                style={{
                  borderRight: '1.5px solid #0b5394',
                  textAlign: 'center',
                  fontWeight: 800,
                  color: '#000000',
                  fontSize: '0.82rem',
                }}
              >
                {iceItem ? '' : `${Number(prawnTotalQty.toFixed(2))} kg`}
              </td>
              <td
                colSpan={2}
                style={{
                  borderRight: '1.5px solid #0b5394',
                  textAlign: 'right',
                  paddingRight: '8px',
                  fontWeight: 'bold',
                  color: '#0b5394',
                }}
              >
                TOTAL
              </td>
              <td
                style={{
                  textAlign: 'right',
                  paddingRight: '8px',
                  fontWeight: 900,
                  color: '#000000',
                }}
              >
                {Number(bill.total || finalAmount).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* 8. TAX BREAKDOWN TABLE (Vehicle No. replacing Taxable Value) */}
        <div
          className="print-keep-together"
          style={{ borderBottom: '1.5px solid #0b5394' }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
              background: '#e8f1f8',
              borderBottom: '1px solid #0b5394',
              fontSize: '0.72rem',
              fontWeight: 'bold',
              color: '#0b5394',
              textAlign: 'center',
            }}
          >
            <div style={{ borderRight: '1px solid #0b5394', padding: '3px 2px' }}>
              Vehicle No.
            </div>
            <div style={{ borderRight: '1px solid #0b5394', padding: '3px 2px' }}>
              CGST Tax
            </div>
            <div style={{ borderRight: '1px solid #0b5394', padding: '3px 2px' }}>
              SGST Tax
            </div>
            <div style={{ padding: '3px 2px' }}>IGST Tax</div>
          </div>

          {/* Sub-header for Rate/Amount */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.5fr 0.5fr 0.5fr 0.5fr 1fr',
              borderBottom: '1px solid #0b5394',
              fontSize: '0.68rem',
              textAlign: 'center',
              background: '#f8fafc',
            }}
          >
            <div style={{ borderRight: '1px solid #0b5394' }}></div>
            <div
              style={{
                borderRight: '1px solid #0b5394',
                color: '#0b5394',
                fontWeight: 'bold',
              }}
            >
              Rate
            </div>
            <div
              style={{
                borderRight: '1px solid #0b5394',
                color: '#0b5394',
                fontWeight: 'bold',
              }}
            >
              Amount
            </div>
            <div
              style={{
                borderRight: '1px solid #0b5394',
                color: '#0b5394',
                fontWeight: 'bold',
              }}
            >
              Rate
            </div>
            <div
              style={{
                borderRight: '1px solid #0b5394',
                color: '#0b5394',
                fontWeight: 'bold',
              }}
            >
              Amount
            </div>
            <div style={{ color: '#0b5394', fontWeight: 'bold' }}>Amount</div>
          </div>

          {/* Tax Values with Vehicle Number in Black */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.5fr 0.5fr 0.5fr 0.5fr 1fr',
              fontSize: '0.75rem',
              textAlign: 'center',
              height: '20px',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                borderRight: '1px solid #0b5394',
                fontWeight: 'bold',
                color: '#000000',
              }}
            >
              {bill.vehicleNo || ''}
            </div>
            <div
              style={{ borderRight: '1px solid #0b5394', color: '#000000' }}
            >
              {bill.cgstRate || ''}
            </div>
            <div
              style={{ borderRight: '1px solid #0b5394', color: '#000000' }}
            >
              {bill.cgstAmount ? Number(bill.cgstAmount).toFixed(2) : ''}
            </div>
            <div
              style={{ borderRight: '1px solid #0b5394', color: '#000000' }}
            >
              {bill.sgstRate || ''}
            </div>
            <div
              style={{ borderRight: '1px solid #0b5394', color: '#000000' }}
            >
              {bill.sgstAmount ? Number(bill.sgstAmount).toFixed(2) : ''}
            </div>
            <div style={{ color: '#000000' }}>
              {bill.igstAmount ? Number(bill.igstAmount).toFixed(2) : ''}
            </div>
          </div>
        </div>

        {/* 9. GRAND TOTAL HIGHLIGHT ROW */}
        <div
          className="print-keep-together"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 125px',
            borderBottom: '1.5px solid #0b5394',
            background: '#e8f1f8',
            fontSize: '0.9rem',
          }}
        >
          <div
            style={{
              borderRight: '1.5px solid #0b5394',
              padding: '5px 10px',
              textAlign: 'right',
              fontWeight: 900,
              color: '#0b5394',
            }}
          >
            GRAND TOTAL
          </div>
          <div
            style={{
              padding: '5px 8px',
              textAlign: 'right',
              fontWeight: 900,
              color: '#000000',
              fontSize: '0.95rem',
            }}
          >
            {Number(finalAmount).toFixed(2)}
          </div>
        </div>

        {/* 10. BANK PAYMENT DETAILS & SIGNATURE */}
        <div
          className="print-keep-together"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            fontSize: '0.74rem',
            lineHeight: '1.4',
          }}
        >
          <div
            style={{
              borderRight: '1.5px solid #0b5394',
              padding: '6px 10px',
            }}
          >
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
              A/c. NO : <strong>{bankDetails.accountNo}</strong>
            </div>
            <div>
              IFSC : <strong>{bankDetails.ifsc}</strong> &nbsp;|&nbsp; Branch :{' '}
              <strong>{bankDetails.branch}</strong>
            </div>
          </div>

          <div
            style={{
              padding: '6px 10px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                color: '#0b5394',
                fontSize: '0.78rem',
              }}
            >
              For {resolvedBusinessName}
            </div>
            <div
              style={{
                marginTop: '24px',
                borderTop: '1px solid #000000',
                paddingTop: '2px',
                fontWeight: 'bold',
                color: '#0b5394',
              }}
            >
              Proprietor
            </div>
          </div>
        </div>
      </div>

      {/* Amount in Words */}
      <div
        style={{
          maxWidth: '800px',
          margin: '6px auto 0 auto',
          fontSize: '0.78rem',
          color: '#000000',
        }}
      >
        <span style={{ fontWeight: 'bold', color: '#0b5394' }}>
          Amount in Words: &nbsp;
        </span>
        <span style={{ fontWeight: 'bold' }}>{amountInWordsText}</span>
      </div>
    </div>
  );
}
