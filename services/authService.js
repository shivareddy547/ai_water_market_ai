'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const otpService = require('./otpService');
const emailService = require('./emailService');
const smsService = require('./smsService');
const { emailOk, phoneOk, normalizePhone } = require('../utils/validators');
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
class AuthService {
    async signup(payload) {
        const { firstName, lastName, email, phone, password, role } = payload;
        if (!firstName || !String(firstName).trim()) {
            const err = new Error('First name is required');
            err.status = 400;
            throw err;
        }
        if (!lastName || !String(lastName).trim()) {
            const err = new Error('Last name is required');
            err.status = 400;
            throw err;
        }
        if (!email || !emailOk(email)) {
            const err = new Error('Enter a valid email address');
            err.status = 400;
            throw err;
        }
        if (!phone || !phoneOk(phone)) {
            const err = new Error('Enter a valid 10-digit mobile number');
            err.status = 400;
            throw err;
        }
        if (!password || password.length < 6) {
            const err = new Error('Password must be at least 6 characters');
            err.status = 400;
            throw err;
        }
        const normalizedEmail = email.toLowerCase().trim();
        const normalizedPhone = normalizePhone(phone, '+91');
        const existingEmail = await User.findOne({ where: { email: normalizedEmail } });
        if (existingEmail) {
            const err = new Error('Email is already registered');
            err.status = 409;
            throw err;
        }
        const existingPhone = await User.findOne({ where: { phone: normalizedPhone } });
        if (existingPhone) {
            const err = new Error('Phone number is already registered');
            err.status = 409;
            throw err;
        }
        const allowedRoles = ['user', 'supplier', 'delivery', 'admin'];
        const finalRole = allowedRoles.includes(role) ? role : 'user';
        const user = await User.scope('withPassword').create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: normalizedEmail,
            phone: normalizedPhone,
            phoneCountryCode: '+91',
            password,
            role: finalRole,
            emailVerified: false,
            phoneVerified: false,
            isActive: true
        });
        const token = this.generateToken(user);
        return {
            user: this.sanitizeUser(user),
            token
        };
    }
    async loginWithEmail(email, password) {
        if (!email || !password) {
            const err = new Error('Email and password are required');
            err.status = 400;
            throw err;
        }
        const user = await User.scope('withPassword').findOne({
            where: { email: email.toLowerCase().trim() }
        });
        if (!user) {
            const err = new Error('Invalid email or password');
            err.status = 401;
            throw err;
        }
        if (!user.password) {
            const err = new Error('Please login using phone OTP for this account');
            err.status = 401;
            throw err;
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            const err = new Error('Invalid email or password');
            err.status = 401;
            throw err;
        }
        if (!user.isActive) {
            const err = new Error('Account is deactivated. Please contact support.');
            err.status = 403;
            throw err;
        }
        user.lastLogin = new Date();
        await user.save();
        const token = this.generateToken(user);
        return {
            user: this.sanitizeUser(user),
            token
        };
    }
    async sendOtp(phone, purpose) {
        if (!phone) {
            const err = new Error('Phone number is required');
            err.status = 400;
            throw err;
        }
        if (!phoneOk(phone)) {
            const err = new Error('Enter a valid 10-digit mobile number');
            err.status = 400;
            throw err;
        }
        const normalizedPhone = normalizePhone(phone, '+91');
        if (purpose === 'login') {
            const user = await User.findOne({ where: { phone: normalizedPhone } });
            if (!user) {
                const err = new Error('No account found with this phone number. Please sign up first.');
                err.status = 404;
                throw err;
            }
            if (!user.isActive) {
                const err = new Error('Account is deactivated. Please contact support.');
                err.status = 403;
                throw err;
            }
        }
        const otpRecord = await otpService.generateAndStoreOtp(
            normalizedPhone,
            'phone',
            purpose
        );
        try {
            await smsService.sendOtp(normalizedPhone, otpRecord.plainCode);
        } catch (err) {
            console.error('SMS send failed:', err.message);
        }
        return {
            contact: normalizedPhone,
            contactType: 'phone',
            purpose,
            expiresIn: 300,
            ...(process.env.NODE_ENV === 'development' && { devOtp: otpRecord.plainCode })
        };
    }
    async verifyOtpLogin(phone, otpCode) {
        if (!phone || !otpCode) {
            const err = new Error('Phone and OTP are required');
            err.status = 400;
            throw err;
        }
        if (otpCode.length !== 6) {
            const err = new Error('Enter the 6-digit OTP');
            err.status = 400;
            throw err;
        }
        const normalizedPhone = normalizePhone(phone, '+91');
        const valid = await otpService.verifyOtp(normalizedPhone, 'phone', otpCode, 'login');
        if (!valid) {
            const err = new Error('Invalid or expired OTP');
            err.status = 401;
            throw err;
        }
        const user = await User.findOne({ where: { phone: normalizedPhone } });
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        if (!user.isActive) {
            const err = new Error('Account is deactivated. Please contact support.');
            err.status = 403;
            throw err;
        }
        user.lastLogin = new Date();
        user.phoneVerified = true;
        await user.save();
        const token = this.generateToken(user);
        return {
            user: this.sanitizeUser(user),
            token
        };
    }
    async sendForgotOtpPhone(phone) {
        if (!phone) {
            const err = new Error('Phone number is required');
            err.status = 400;
            throw err;
        }
        if (!phoneOk(phone)) {
            const err = new Error('Enter a valid 10-digit mobile number');
            err.status = 400;
            throw err;
        }
        const normalizedPhone = normalizePhone(phone, '+91');
        const user = await User.findOne({ where: { phone: normalizedPhone } });
        if (!user) {
            const err = new Error('No account found with this phone number');
            err.status = 404;
            throw err;
        }
        const otpRecord = await otpService.generateAndStoreOtp(
            normalizedPhone,
            'phone',
            'reset_password',
            user.id
        );
        try {
            await smsService.sendOtp(normalizedPhone, otpRecord.plainCode);
        } catch (err) {
            console.error('SMS send failed:', err.message);
        }
        return {
            contact: normalizedPhone,
            contactType: 'phone',
            purpose: 'reset_password',
            expiresIn: 300,
            ...(process.env.NODE_ENV === 'development' && { devOtp: otpRecord.plainCode })
        };
    }
    async verifyResetOtp(phone, otpCode) {
        if (!phone || !otpCode) {
            const err = new Error('Phone and OTP are required');
            err.status = 400;
            throw err;
        }
        if (otpCode.length !== 6) {
            const err = new Error('Enter the 6-digit OTP');
            err.status = 400;
            throw err;
        }
        const normalizedPhone = normalizePhone(phone, '+91');
        const valid = await otpService.verifyOtp(
            normalizedPhone,
            'phone',
            otpCode,
            'reset_password'
        );
        if (!valid) {
            const err = new Error('Invalid or expired OTP');
            err.status = 401;
            throw err;
        }
        const user = await User.findOne({ where: { phone: normalizedPhone } });
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        const resetToken = jwt.sign(
            { id: user.id, phone: normalizedPhone, purpose: 'reset_password' },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
        return {
            resetToken,
            message: 'OTP verified successfully'
        };
    }
    async resetPassword(resetToken, newPassword) {
        if (!resetToken || !newPassword) {
            const err = new Error('Reset token and new password are required');
            err.status = 400;
            throw err;
        }
        if (newPassword.length < 6) {
            const err = new Error('New password must be at least 6 characters');
            err.status = 400;
            throw err;
        }
        let decoded;
        try {
            decoded = jwt.verify(resetToken, JWT_SECRET);
        } catch (e) {
            const error = new Error('Invalid or expired reset token');
            error.status = 401;
            throw error;
        }
        if (decoded.purpose !== 'reset_password') {
            const err = new Error('Invalid reset token');
            err.status = 401;
            throw err;
        }
        const user = await User.findByPk(decoded.id);
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        user.password = newPassword;
        await user.save();
        return { message: 'Password reset successfully' };
    }
    async sendForgotEmail(email) {
        if (!email) {
            const err = new Error('Email is required');
            err.status = 400;
            throw err;
        }
        if (!emailOk(email)) {
            const err = new Error('Enter a valid email address');
            err.status = 400;
            throw err;
        }
        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ where: { email: normalizedEmail } });
        if (!user) {
            const err = new Error('No account found with this email');
            err.status = 404;
            throw err;
        }
        const signedToken = jwt.sign(
            { id: user.id, email: normalizedEmail, purpose: 'email_reset' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetUrl = `${frontendUrl}/reset-password?token=${signedToken}`;
        try {
            await emailService.sendPasswordReset(normalizedEmail, resetUrl);
        } catch (err) {
            console.error('Email send failed:', err.message);
            const error = new Error('Failed to send reset email. Please try again.');
            error.status = 500;
            throw error;
        }
        return { message: 'Reset link sent to your email' };
    }
    async resetPasswordEmail(token, newPassword) {
        if (!token || !newPassword) {
            const err = new Error('Token and new password are required');
            err.status = 400;
            throw err;
        }
        if (newPassword.length < 6) {
            const err = new Error('Password must be at least 6 characters');
            err.status = 400;
            throw err;
        }
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (e) {
            const error = new Error('Invalid or expired reset link');
            error.status = 401;
            throw error;
        }
        if (decoded.purpose !== 'email_reset') {
            const err = new Error('Invalid reset token');
            err.status = 401;
            throw err;
        }
        const user = await User.findByPk(decoded.id);
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        user.password = newPassword;
        await user.save();
        return { message: 'Password reset successfully' };
    }
    async getUserById(userId) {
        const user = await User.findByPk(userId);
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        return this.sanitizeUser(user);
    }
    generateToken(user) {
        return jwt.sign(
            {
                id: user.id,
                email: user.email,
                phone: user.phone,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
    }
    sanitizeUser(user) {
        const u = user.toJSON ? user.toJSON() : user;
        delete u.password;
        return u;
    }
}
module.exports = new AuthService();
