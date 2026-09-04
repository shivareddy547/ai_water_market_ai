'use strict';
let twilio;
try {
    twilio = require('twilio');
} catch (e) {
    twilio = null;
}
class SmsService {
    constructor() {
        this.client = null;
        if (twilio && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            this.client = twilio(
                process.env.TWILIO_ACCOUNT_SID,
                process.env.TWILIO_AUTH_TOKEN
            );
        }
    }
    async sendOtp(phone, code) {
        if (!this.client) {
            console.log(`[Dev Mode] OTP for ${phone}: ${code}`);
            return;
        }
        await this.client.messages.create({
            body: `Your WaterMarket verification code is ${code}. It expires in 5 minutes.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone
        });
    }
}
module.exports = new SmsService();
