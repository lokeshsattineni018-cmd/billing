const express = require('express');
const jwt = require('jsonwebtoken');
const Bill = require('../models/Bill');
const User = require('../models/User');
const { generateBillPDFBuffer } = require('../services/pdfService');
const { getJwtSecret, generalLimiter } = require('../middleware/security');
const { captureException } = require('../utils/errorTracker');

const router = express.Router();

const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const ConsumedNonce = require('../models/ConsumedNonce');

/**
 * POST /api/bills/:id/pdf-ticket
 * Issues a short-lived (60 seconds) single-use ticket for downloading PDF invoices
 * without exposing persistent user credentials in URLs.
 */
router.post('/:id/pdf-ticket', protect, async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill || bill.isDeleted) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const secret = getJwtSecret();
    const nonce = crypto.randomBytes(12).toString('hex');
    const ticket = jwt.sign(
      {
        purpose: 'pdf-download',
        billId: bill._id.toString(),
        userId: req.user._id.toString(),
        nonce,
      },
      secret,
      { expiresIn: '60s' } // 60 seconds lifespan
    );

    res.json({
      ticket,
      downloadUrl: `/api/bills/${bill._id}/pdf?ticket=${ticket}`,
      expiresIn: 60,
    });
  } catch (error) {
    console.error('PDF Ticket Error:', error);
    return res.status(500).json({ message: 'Failed to issue PDF download ticket' });
  }
});

/**
 * GET /api/bills/:id/pdf
 * Generate and stream verified PDF invoice.
 * Requires either:
 *  1. Valid Bearer token in Authorization header, OR
 *  2. Short-lived single-use ticket via ?ticket= parameter.
 * Strictly disallows ?token= query parameter to prevent token leakage in logs and referrers.
 */
router.get('/:id/pdf', generalLimiter, async (req, res) => {
  try {
    // Explicitly reject query parameter ?token=
    if (req.query && req.query.token) {
      return res.status(401).send('Security error: Query parameter authentication (?token=) is disabled. Provide Authorization header or use a short-lived download ticket.');
    }

    let authorized = false;
    const secret = getJwtSecret();

    // 1. Check Bearer Authorization Header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const token = req.headers.authorization.split(' ')[1];
      try {
        const decoded = jwt.verify(token, secret);
        const user = await User.findById(decoded.id);
        if (user && (decoded.tokenVersion === undefined || decoded.tokenVersion === user.tokenVersion)) {
          authorized = true;
        }
      } catch (err) {}
    }

    // 2. Check Single-Use Ticket Query Param (?ticket=)
    if (!authorized && req.query.ticket) {
      try {
        const decoded = jwt.verify(req.query.ticket, secret);
        if (decoded.purpose !== 'pdf-download' || decoded.billId !== req.params.id) {
          return res.status(401).send('Not authorized - invalid ticket scope or mismatched bill');
        }

        try {
          await ConsumedNonce.create({
            nonce: decoded.nonce,
            billId: decoded.billId,
            userId: decoded.userId,
          });
          authorized = true;
        } catch (nonceErr) {
          if (nonceErr.code === 11000) {
            return res.status(401).send('Not authorized - download ticket has already been used');
          }
          throw nonceErr;
        }
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).send('Not authorized - download ticket has expired');
        }
        if (err.name === 'JsonWebTokenError') {
          return res.status(401).send('Not authorized - invalid download ticket');
        }
        throw err;
      }
    }

    if (!authorized) {
      return res.status(401).send('Not authorized - valid Bearer token or single-use download ticket required');
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill || bill.isDeleted) {
      return res.status(404).send('Invoice not found');
    }

    const pdfBuffer = await generateBillPDFBuffer(bill);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${bill.billNo}${bill.isVoided ? '-VOIDED' : ''}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF Route Error:', error);
    captureException(error, { url: req.originalUrl, billId: req.params.id }, req);
    if (!res.headersSent) {
      const isDev = process.env.NODE_ENV === 'development';
      res.status(500).send(isDev ? `PDF generation failed: ${error.message}` : 'PDF generation failed. Please try again later.');
    }
  }
});

module.exports = router;
