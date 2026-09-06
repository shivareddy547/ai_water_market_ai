'use strict';
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
// Public routes
router.get('/public-suppliers', userController.getSuppliers);
router.get('/featured-suppliers', userController.getFeaturedSuppliers);
// Authenticated routes
router.get('/', authMiddleware, userController.getUsers);
router.get('/suppliers', authMiddleware, userController.getSuppliers);
router.get('/:id', authMiddleware, userController.getUser);
router.put('/:id/status', authMiddleware, userController.updateStatus);
router.put('/:id/featured', authMiddleware, userController.updateFeatured);
router.put('/:id/active', authMiddleware, userController.updateUserActive);
router.put('/:id', authMiddleware, userController.updateUser);
router.delete('/:id', authMiddleware, userController.deleteUser);
module.exports = router;
