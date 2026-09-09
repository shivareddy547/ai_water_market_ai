'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
    class ChatMessage extends Model {
        static associate(models) {
            ChatMessage.belongsTo(models.Chat, {
                foreignKey: 'chat_id',
                as: 'chat'
            });
        }
    }
    ChatMessage.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        chatId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'chat_id'
        },
        senderType: {
            type: DataTypes.ENUM('user', 'admin'),
            allowNull: false,
            field: 'sender_type'
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        isRead: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'is_read'
        }
    }, {
        sequelize,
        modelName: 'ChatMessage',
        tableName: 'chat_messages',
        timestamps: true,
        underscored: true
    });
    return ChatMessage;
};
