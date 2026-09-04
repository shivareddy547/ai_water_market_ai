'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
    class DeliveryTeam extends Model {
        static associate(models) {
            DeliveryTeam.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
        }
    }
    DeliveryTeam.init({
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
        data: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'DeliveryTeam',
        tableName: 'delivery_teams',
        timestamps: true,
        underscored: true
    });
    return DeliveryTeam;
};
