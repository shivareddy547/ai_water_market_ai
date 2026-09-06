'use strict';
const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const authMiddleware = require('../middleware/authMiddleware');
router.get('/:key', settingController.getSetting);
router.put('/:key', authMiddleware, settingController.updateSetting);
module.exports = router;
