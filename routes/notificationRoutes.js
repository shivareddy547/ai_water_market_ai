'use strict';
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/recent', authMiddleware, notificationController.getRecent);
router.get('/', authMiddleware, notificationController.getAll);
router.put('/read-all', authMiddleware, notificationController.markAllAsRead);
router.put('/:id/read', authMiddleware, notificationController.markAsRead);

module.exports = router;
