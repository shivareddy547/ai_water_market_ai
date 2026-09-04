'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
    class Category extends Model {
        static associate(models) {
            // define association here
        }
    }
    Category.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        icon: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '💧'
        },
        image: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: ''
        },
        position: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    }, {
        sequelize,
        modelName: 'Category',
        tableName: 'categories',
        timestamps: true,
        underscored: true
    });
    return Category;
};
