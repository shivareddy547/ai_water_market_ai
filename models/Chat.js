'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
    class Chat extends Model {
        static associate(models) {
            Chat.hasMany(models.ChatMessage, {
                foreignKey: 'chat_id',
                as: 'messages'
            });
            Chat.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
        }
    }
    Chat.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'user_id'
        },
        guestName: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'guest_name'
        },
        guestEmail: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'guest_email'
        },
        status: {
            type: DataTypes.ENUM('active', 'closed'),
            allowNull: false,
            defaultValue: 'active'
        },
        lastMessageAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'last_message_at'
        }
    }, {
        sequelize,
        modelName: 'Chat',
        tableName: 'chats',
        timestamps: true,
        underscored: true
    });
    return Chat;
};
