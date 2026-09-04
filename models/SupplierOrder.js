'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
    class SupplierOrder extends Model {
        static associate(models) {
            SupplierOrder.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
        }
    }
    SupplierOrder.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'user_id',
            unique: true
        },
        orders: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        }
    }, {
        sequelize,
        modelName: 'SupplierOrder',
        tableName: 'supplier_orders',
        timestamps: true,
        underscored: true
    });
    return SupplierOrder;
};
