const express = require('express');
const { body, validationResult } = require('express-validator');
const Item = require('../models/Item');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/items
 * List all active items (prawn types)
 */
router.get('/', protect, async (req, res) => {
  try {
    const items = await Item.find({ isActive: true }).sort({ name: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/items
 * Create a new item
 */
router.post('/', protect, [
  body('name').trim().notEmpty().withMessage('Item name is required'),
  body('defaultRate').isFloat({ min: 0 }).withMessage('Default rate must be a positive number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const item = await Item.create({
      name: req.body.name,
      defaultRate: req.body.defaultRate,
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PUT /api/items/:id
 * Update an item (name, rate)
 */
router.put('/:id', protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item || !item.isActive) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (req.body.name !== undefined) item.name = req.body.name;
    if (req.body.defaultRate !== undefined) item.defaultRate = req.body.defaultRate;

    await item.save();
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * DELETE /api/items/:id
 * Soft-delete an item
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    item.isActive = false;
    await item.save();
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
