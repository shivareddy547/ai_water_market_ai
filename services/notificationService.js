'use strict';
const { Notification } = require('../models');
class NotificationService {
    async getRecentNotifications(userId, limit = 5) {
        return await Notification.findAll({
            where: { userId },
            order: [['created_at', 'DESC']],
            limit
        });
    }
    async getAllNotifications(userId, filter = 'all') {
        const where = { userId };
        if (filter === 'unread') {
            where.isRead = false;
        } else if (filter === 'read') {
            where.isRead = true;
        }
        return await Notification.findAll({
            where,
            order: [['created_at', 'DESC']]
        });
    }
    async markAsRead(id, userId) {
        const notification = await Notification.findOne({ where: { id, userId } });
        if (!notification) {
            const err = new Error('Notification not found');
            err.status = 404;
            throw err;
        }
        notification.isRead = true;
        await notification.save();
        return notification;
    }
    async markAllAsRead(userId) {
        await Notification.update(
            { isRead: true },
            { where: { userId, isRead: false } }
        );
        return { message: 'All notifications marked as read' };
    }
    async createNotification(data) {
        return await Notification.create(data);
    }
}
module.exports = new NotificationService();
