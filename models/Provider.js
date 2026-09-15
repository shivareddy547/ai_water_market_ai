'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
    class Provider extends Model {
        static associate(models) {
            Provider.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
        }
    }
    Provider.init({
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
        targetType: {
            type: DataTypes.ENUM('user', 'role'),
            allowNull: false,
            defaultValue: 'user',
            field: 'target_type'
        },
        targetRole: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'target_role'
        },
        providerType: {
            type: DataTypes.ENUM('smtp', 'sms', 'social', 'payment', 'shipment'),
            allowNull: false,
            field: 'provider_type'
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        providerKey: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'provider_key'
        },
        isEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'is_enabled'
        },
        credentials: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'Provider',
        tableName: 'providers',
        timestamps: true,
        underscored: true
    });
    return Provider;
};
