'use strict';
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            const err = new Error('Authorization token is required');
            err.status = 401;
            return next(err);
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.id);
        if (!user || !user.isActive) {
            const err = new Error('User not found or account is inactive');
            err.status = 401;
            return next(err);
        }
        req.user = user;
        req.token = token;
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            const error = new Error('Invalid or expired token');
            error.status = 401;
            return next(error);
        }
        next(err);
    }
};
module.exports = authMiddleware;
