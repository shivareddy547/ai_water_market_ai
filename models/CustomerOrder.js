'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
    class CustomerOrder extends Model {
        static associate(models) {
            CustomerOrder.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
        }
    }
    CustomerOrder.init({
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
        orderNumber: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            field: 'order_number'
        },
        subOrders: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
            field: 'sub_orders'
        },
        totalAmount: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0,
            field: 'total_amount'
        },
        paymentMethod: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'COD',
            field: 'payment_method'
        },
        status: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'Placed'
        }
    }, {
        sequelize,
        modelName: 'CustomerOrder',
        tableName: 'customer_orders',
        timestamps: true,
        underscored: true
    });
    return CustomerOrder;
};
