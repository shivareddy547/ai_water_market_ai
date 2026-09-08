'use strict';
const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const authMiddleware = require('../middleware/authMiddleware');
// Public GET for any setting key (used by public Header component)
router.get('/:key', settingController.getSetting);
// Protected PUT (admin only)
router.put('/:key', authMiddleware, settingController.updateSetting);
module.exports = router;
