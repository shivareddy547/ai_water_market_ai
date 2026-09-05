'use strict';
const { User } = require('../models');
class CartService {
    async getCart(userId) {
        const user = await User.findByPk(userId);
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        return user.cartData || {};
    }
    async updateCart(userId, items) {
        const user = await User.findByPk(userId);
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        const sanitized = {};
        if (items && typeof items === 'object') {
            Object.keys(items).forEach(key => {
                const qty = Number(items[key]);
                if (Number.isInteger(qty) && qty > 0) {
                    sanitized[key] = qty;
                }
            });
        }
        user.cartData = sanitized;
        await user.save();
        return user.cartData;
    }
    async clearCart(userId) {
        const user = await User.findByPk(userId);
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        user.cartData = {};
        await user.save();
        return {};
    }
}
module.exports = new CartService();
