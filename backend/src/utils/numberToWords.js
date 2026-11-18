/**
 * Converts numeric currency amount to traditional Indian numbering words (Rupees Only).
 * Handles Indian numbering system tiers: Crore, Lakh, Thousand, Hundred.
 * e.g. 1248950 -> "Twelve Lakh Forty Eight Thousand Nine Hundred Fifty Rupees Only"
 */
function numberToWords(num) {
  if (!num || num === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertBelow1000(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelow1000(n % 100) : '');
  }

  const intPart = Math.floor(Math.abs(num));
  const parts = [];

  const crore = Math.floor(intPart / 10000000);
  const lakh = Math.floor((intPart % 10000000) / 100000);
  const thousand = Math.floor((intPart % 100000) / 1000);
  const remainder = intPart % 1000;

  if (crore > 0) parts.push(convertBelow1000(crore) + ' Crore');
  if (lakh > 0) parts.push(convertBelow1000(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertBelow1000(thousand) + ' Thousand');
  if (remainder > 0) parts.push(convertBelow1000(remainder));

  return (parts.join(' ') || 'Zero') + ' Rupees Only';
}

module.exports = { numberToWords };
