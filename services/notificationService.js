'use strict';
const { Notification, User } = require('../models');
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
    async sendAdminNotification(senderId, payload) {
        const { targetType, targetRole, targetUserIds, title, message, link } = payload;
        if (!title || !message) {
            const err = new Error('Title and message are required');
            err.status = 400;
            throw err;
        }
        let userIds = [];
        if (targetType === 'role') {
            const users = await User.findAll({ 
                where: { role: targetRole },
                attributes: ['id']
            });
            userIds = users.map(u => u.id);
        } else if (targetType === 'specific') {
            if (!targetUserIds || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
                const err = new Error('Specific users must be selected');
                err.status = 400;
                throw err;
            }
            userIds = targetUserIds;
        } else {
            const err = new Error('Invalid target type');
            err.status = 400;
            throw err;
        }
        if (userIds.length === 0) {
            const err = new Error('No users found for the selected target');
            err.status = 400;
            throw err;
        }
        const notificationsData = userIds.map(userId => ({
            userId,
            type: 'admin_broadcast',
            title,
            message,
            link: link || null,
            isRead: false
        }));
        await Notification.bulkCreate(notificationsData);
        return { message: 'Notification sent successfully', count: userIds.length };
    }
}
module.exports = new NotificationService();
