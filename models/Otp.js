'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
    class Otp extends Model {
        static associate(models) {
            Otp.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
        }
    }
    Otp.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        contact: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'contact'
        },
        contactType: {
            type: DataTypes.ENUM('phone', 'email'),
            allowNull: false,
            field: 'contact_type'
        },
        otpCode: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'otp_code'
        },
        purpose: {
            type: DataTypes.ENUM('login', 'signup', 'reset_password'),
            allowNull: false,
            field: 'purpose'
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'expires_at'
        },
        isUsed: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'is_used'
        },
        attempts: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'attempts'
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'user_id'
        }
    }, {
        sequelize,
        modelName: 'Otp',
        tableName: 'otps',
        timestamps: true,
        underscored: true
    });
    return Otp;
};
