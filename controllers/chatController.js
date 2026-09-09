'use strict';
const chatService = require('../services/chatService');
class ChatController {
    async startChat(req, res, next) {
        try {
            const userId = req.user ? req.user.id : null;
            const chat = await chatService.startChat(userId, req.body);
            res.status(201).json({ success: true, data: chat });
        } catch (err) {
            next(err);
        }
    }
    async addMessage(req, res, next) {
        try {
            const { chatId } = req.params;
            const { message } = req.body;
            const senderType = req.user && req.user.role === 'admin' ? 'admin' : 'user';
            const msg = await chatService.addMessage(chatId, senderType, message);
            res.status(201).json({ success: true, data: msg });
        } catch (err) {
            next(err);
        }
    }
    async getMessages(req, res, next) {
        try {
            const messages = await chatService.getMessages(req.params.chatId);
            res.json({ success: true, data: messages });
        } catch (err) {
            next(err);
        }
    }
    async getAllChats(req, res, next) {
        try {
            if (req.user.role !== 'admin') {
                const err = new Error('Not authorized');
                err.status = 403;
                throw err;
            }
            const chats = await chatService.getAllChats();
            res.json({ success: true, data: chats });
        } catch (err) {
            next(err);
        }
    }
    async markAsRead(req, res, next) {
        try {
            const { chatId } = req.params;
            const { senderType } = req.body;
            const result = await chatService.markAsRead(chatId, senderType);
            res.json({ success: true, message: result.message });
        } catch (err) {
            next(err);
        }
    }
}
module.exports = new ChatController();
