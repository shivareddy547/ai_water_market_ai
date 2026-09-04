'use strict';
let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    nodemailer = null;
}
class EmailService {
    constructor() {
        this.transporter = null;
        this.init();
    }
    init() {
        if (!nodemailer) {
            return;
        }
        if (process.env.SMTP_HOST && process.env.SMTP_USER) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587', 10),
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
        }
    }
    async sendPasswordReset(email, resetUrl) {
        if (!this.transporter) {
            console.log(`[Dev Mode] Password reset link for ${email}: ${resetUrl}`);
            return;
        }
        const from = process.env.SMTP_FROM || 'noreply@yourapp.com';
        await this.transporter.sendMail({
            from,
            to: email,
            subject: 'WaterMarket - Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">WaterMarket Password Reset</h2>
                    <p>Hello,</p>
                    <p>You requested a password reset for your WaterMarket account.</p>
                    <p>Click the link below to set a new password:</p>
                    <p>
                        <a href="${resetUrl}" style="background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 8px; display: inline-block;">
                            Reset Password
                        </a>
                    </p>
                    <p style="margin-top: 16px;">
                        Or copy this link into your browser:
                        <br/>
                        <span style="color: #64748b; word-break: break-all;">${resetUrl}</span>
                    </p>
                    <p style="margin-top: 16px; color: #64748b; font-size: 12px;">
                        This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
                    </p>
                </div>
            `
        });
    }
}
module.exports = new EmailService();
