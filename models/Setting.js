'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
    class Setting extends Model {
        static associate(models) {}
    }
    Setting.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        value: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'Setting',
        tableName: 'settings',
        timestamps: true,
        underscored: true
    });
    return Setting;
};
