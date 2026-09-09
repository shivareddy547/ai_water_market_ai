'use strict';
const { Chat, ChatMessage, User, Notification } = require('../models');
class ChatService {
    async startChat(userId, guestInfo) {
        if (userId) {
            let chat = await Chat.findOne({ where: { userId, status: 'active' } });
            if (chat) return chat;
            chat = await Chat.create({ userId, status: 'active' });
            return chat;
        } else {
            const chat = await Chat.create({
                guestName: guestInfo.guestName,
                guestEmail: guestInfo.guestEmail,
                status: 'active'
            });
            return chat;
        }
    }
    async addMessage(chatId, senderType, message) {
        const chat = await Chat.findByPk(chatId);
        if (!chat) {
            const err = new Error('Chat not found');
            err.status = 404;
            throw err;
        }
        const msg = await ChatMessage.create({ chatId, senderType, message });
        chat.lastMessageAt = new Date();
        await chat.save();
        if (senderType === 'user') {
            const admins = await User.findAll({ where: { role: 'admin' } });
            if (admins.length > 0) {
                const chatName = chat.guestName || (chat.userId ? 'Registered User' : 'Guest');
                const notifications = admins.map(admin => ({
                    userId: admin.id,
                    type: 'chat',
                    title: 'New Chat Message',
                    message: `New message from ${chatName}`,
                    link: '/admin/messages',
                    isRead: false
                }));
                await Notification.bulkCreate(notifications);
            }
        }
        return msg;
    }
    async getMessages(chatId) {
        return await ChatMessage.findAll({
            where: { chatId },
            order: [['created_at', 'ASC']]
        });
    }
    async getAllChats() {
        return await Chat.findAll({
            include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email'] }],
            order: [['last_message_at', 'DESC']]
        });
    }
    async markAsRead(chatId, senderType) {
        await ChatMessage.update(
            { isRead: true },
            { where: { chatId, senderType } }
        );
        return { message: 'Messages marked as read' };
    }
}
module.exports = new ChatService();
