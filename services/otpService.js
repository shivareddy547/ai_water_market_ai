'use strict';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Otp } = require('../models');
const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;
class OtpService {
    async generateAndStoreOtp(contact, contactType, purpose, userId = null) {
        await Otp.update(
            { isUsed: true },
            {
                where: {
                    contact,
                    purpose,
                    isUsed: false
                }
            }
        );
        const plainCode = crypto.randomInt(100000, 999999).toString();
        const hashedCode = await bcrypt.hash(plainCode, 10);
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
        const otp = await Otp.create({
            contact,
            contactType,
            otpCode: hashedCode,
            purpose,
            expiresAt,
            isUsed: false,
            attempts: 0,
            userId
        });
        return { ...otp.toJSON(), plainCode };
    }
    async verifyOtp(contact, contactType, code, purpose) {
        const otp = await Otp.findOne({
            where: {
                contact,
                contactType,
                purpose,
                isUsed: false,
                expiresAt: { [Op.gt]: new Date() }
            },
            order: [['created_at', 'DESC']]
        });
        if (!otp) {
            return false;
        }
        otp.attempts += 1;
        if (otp.attempts > MAX_ATTEMPTS) {
            otp.isUsed = true;
            await otp.save();
            return false;
        }
        const isMatch = await bcrypt.compare(code, otp.otpCode);
        if (!isMatch) {
            await otp.save();
            return false;
        }
        otp.isUsed = true;
        await otp.save();
        return true;
    }
}
module.exports = new OtpService();
