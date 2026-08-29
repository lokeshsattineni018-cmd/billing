const express = require('express');
const jwt = require('jsonwebtoken');
const Bill = require('../models/Bill');
const User = require('../models/User');
const { generateBillPDFBuffer } = require('../services/pdfService');
const { getJwtSecret, generalLimiter } = require('../middleware/security');

const router = express.Router();

/**
 * GET /api/bills/:id/pdf
 * Generate and stream verified PDF invoice
 * Requires valid JWT via Authorization header or token query parameter
 */
router.get('/:id/pdf', generalLimiter, async (req, res) => {
  try {
    let token = req.query.token;
    if (!token && req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).send('Not authorized - missing authentication token');
    }

    let decoded;
    try {
      const secret = getJwtSecret();
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).send('Invalid or expired token. Please log in again.');
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).send('User not found. Please log in again.');
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).send('Invoice not found');
    }

    const pdfBuffer = await generateBillPDFBuffer(bill);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${bill.billNo}${bill.isVoided ? '-VOIDED' : ''}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF Route Error:', error);
    if (!res.headersSent) {
      res.status(500).send('PDF generation failed: ' + error.message);
    }
  }
});

module.exports = router;
