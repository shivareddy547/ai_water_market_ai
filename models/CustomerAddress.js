'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
    class CustomerAddress extends Model {
        static associate(models) {
            CustomerAddress.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
        }
    }
    CustomerAddress.init({
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
        label: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'Home'
        },
        fullName: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'full_name',
            validate: {
                notEmpty: true
            }
        },
        phone: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        line: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        landmark: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        city: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        state: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        pincode: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        isDefault: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'is_default'
        }
    }, {
        sequelize,
        modelName: 'CustomerAddress',
        tableName: 'customer_addresses',
        timestamps: true,
        underscored: true
    });
    return CustomerAddress;
};
