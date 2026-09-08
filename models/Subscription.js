'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
    class Subscription extends Model {
        static associate(models) {
            Subscription.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
            Subscription.belongsTo(models.Product, {
                foreignKey: 'product_id',
                as: 'product'
            });
            Subscription.belongsTo(models.CustomerOrder, {
                foreignKey: 'order_id',
                as: 'order'
            });
        }
    }
    Subscription.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'user_id'
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'order_id'
        },
        supplierId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'supplier_id'
        },
        productId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'product_id'
        },
        productName: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'product_name'
        },
        frequency: {
            type: DataTypes.STRING,
            allowNull: false
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        price: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'active'
        },
        nextDeliveryDate: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'next_delivery_date'
        },
        details: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'Subscription',
        tableName: 'subscriptions',
        timestamps: true,
        underscored: true
    });
    return Subscription;
};
