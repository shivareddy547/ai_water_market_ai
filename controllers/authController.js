'use strict';
const authService = require('../services/authService');
class AuthController {
    async signup(req, res, next) {
        try {
            const result = await authService.signup(req.body);
            res.status(201).json({
                success: true,
                message: 'Account created successfully',
                data: result
            });
        } catch (err) {
            next(err);
        }
    }
    async createDeliveryPerson(req, res, next) {
        try {
            if (req.user.role !== 'supplier') {
                const err = new Error('Only suppliers can create delivery person accounts');
                err.status = 403;
                throw err;
            }
            const result = await authService.createDeliveryPerson(req.user.id, req.body);
            res.status(201).json({
                success: true,
                message: 'Delivery person account created successfully',
                data: result
            });
        } catch (err) {
            next(err);
        }
    }
    async updateDeliveryPerson(req, res, next) {
        try {
            const result = await authService.updateDeliveryPerson(req.params.id, req.body);
            res.json({
                success: true,
                message: 'Delivery person account updated successfully',
                data: result
            });
        } catch (err) {
            next(err);
        }
    }
    async loginWithEmail(req, res, next) {
        try {
            const { email, password } = req.body;
            const result = await authService.loginWithEmail(email, password);
            res.json({
                success: true,
                message: 'Login successful',
                data: result
            });
        } catch (err) {
            next(err);
        }
    }
    async sendOtp(req, res, next) {
        try {
            const { phone, purpose } = req.body;
            const result = await authService.sendOtp(phone, purpose || 'login');
            res.json({
                success: true,
                message: 'OTP sent successfully',
                data: result
            });
        } catch (err) {
            next(err);
        }
    }
    async verifyOtpLogin(req, res, next) {
        try {
            const { phone, otp } = req.body;
            const result = await authService.verifyOtpLogin(phone, otp);
            res.json({
                success: true,
                message: 'Login successful',
                data: result
            });
        } catch (err) {
            next(err);
        }
    }
    async sendForgotOtpPhone(req, res, next) {
        try {
            const { phone } = req.body;
            const result = await authService.sendForgotOtpPhone(phone);
            res.json({
                success: true,
                message: 'OTP sent successfully',
                data: result
            });
        } catch (err) {
            next(err);
        }
    }
    async verifyResetOtp(req, res, next) {
        try {
            const { phone, otp } = req.body;
            const result = await authService.verifyResetOtp(phone, otp);
            res.json({
                success: true,
                message: result.message,
                data: { resetToken: result.resetToken }
            });
        } catch (err) {
            next(err);
        }
    }
    async resetPassword(req, res, next) {
        try {
            const { resetToken, newPassword } = req.body;
            const result = await authService.resetPassword(resetToken, newPassword);
            res.json({
                success: true,
                message: result.message
            });
        } catch (err) {
            next(err);
        }
    }
    async sendForgotEmail(req, res, next) {
        try {
            const { email } = req.body;
            const result = await authService.sendForgotEmail(email);
            res.json({
                success: true,
                message: result.message
            });
        } catch (err) {
            next(err);
        }
    }
    async resetPasswordEmail(req, res, next) {
        try {
            const { token, newPassword } = req.body;
            const result = await authService.resetPasswordEmail(token, newPassword);
            res.json({
                success: true,
                message: result.message
            });
        } catch (err) {
            next(err);
        }
    }
    async getMe(req, res, next) {
        try {
            const user = await authService.getUserById(req.user.id);
            res.json({
                success: true,
                data: user
            });
        } catch (err) {
            next(err);
        }
    }
    async updateWishlist(req, res, next) {
        try {
            const { wishlistData } = req.body;
            if (!Array.isArray(wishlistData)) {
                const err = new Error('wishlistData must be an array of strings');
                err.status = 400;
                throw err;
            }
            const user = await authService.updateWishlist(req.user.id, wishlistData);
            res.json({
                success: true,
                message: 'Wishlist updated successfully',
                data: user.wishlistData || []
            });
        } catch (err) {
            next(err);
        }
    }
    async logout(req, res, next) {
        try {
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new AuthController();
