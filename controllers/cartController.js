'use strict';
const cartService = require('../services/cartService');
class CartController {
    async getCart(req, res, next) {
        try {
            const cart = await cartService.getCart(req.user.id);
            res.json({ success: true, data: cart });
        } catch (err) {
            next(err);
        }
    }
    async updateCart(req, res, next) {
        try {
            const items = req.body.items || req.body || {};
            const cart = await cartService.updateCart(req.user.id, items);
            res.json({ success: true, data: cart, message: 'Cart updated successfully' });
        } catch (err) {
            next(err);
        }
    }
    async clearCart(req, res, next) {
        try {
            await cartService.clearCart(req.user.id);
            res.json({ success: true, message: 'Cart cleared successfully' });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new CartController();
