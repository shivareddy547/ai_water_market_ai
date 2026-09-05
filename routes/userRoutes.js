'use strict';
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
// Public route to get all suppliers
router.get('/public-suppliers', userController.getSuppliers);
router.get('/', authMiddleware, userController.getUsers);
router.get('/suppliers', authMiddleware, userController.getSuppliers);
router.put('/:id/status', authMiddleware, userController.updateStatus);
router.put('/:id/active', authMiddleware, userController.updateUserActive);
router.put('/:id', authMiddleware, userController.updateUser);
router.delete('/:id', authMiddleware, userController.deleteUser);
module.exports = router;
