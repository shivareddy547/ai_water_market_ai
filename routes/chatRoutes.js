'use strict';
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await User.findByPk(decoded.id);
            if (user && user.isActive) {
                req.user = user;
            }
        }
    } catch (err) {
        // Ignore error, proceed as guest
    }
    next();
};
router.post('/start', optionalAuth, chatController.startChat);
router.post('/:chatId/message', optionalAuth, chatController.addMessage);
router.get('/:chatId/messages', chatController.getMessages);
router.get('/', authMiddleware, chatController.getAllChats);
router.put('/:chatId/read', authMiddleware, chatController.markAsRead);
module.exports = router;
