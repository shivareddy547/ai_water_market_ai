'use strict';
const notificationService = require('../services/notificationService');
class NotificationController {
    async getRecent(req, res, next) {
        try {
            const notifications = await notificationService.getRecentNotifications(req.user.id);
            res.json({ success: true, data: notifications });
        } catch (err) {
            next(err);
        }
    }
    async getAll(req, res, next) {
        try {
            const filter = req.query.filter || 'all';
            const notifications = await notificationService.getAllNotifications(req.user.id, filter);
            res.json({ success: true, data: notifications });
        } catch (err) {
            next(err);
        }
    }
    async markAsRead(req, res, next) {
        try {
            const notification = await notificationService.markAsRead(req.params.id, req.user.id);
            res.json({ success: true, data: notification, message: 'Notification marked as read' });
        } catch (err) {
            next(err);
        }
    }
    async markAllAsRead(req, res, next) {
        try {
            const result = await notificationService.markAllAsRead(req.user.id);
            res.json({ success: true, message: result.message });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new NotificationController();
