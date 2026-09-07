'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class Subscription extends Model {
    static associate(models) {
      Subscription.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
      Subscription.belongsTo(models.CustomerAddress, {
        foreignKey: 'address_id',
        as: 'address'
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
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active'
    },
    frequency: {
      type: DataTypes.STRING,
      allowNull: false
    },
    customDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'custom_days'
    },
    qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    timeSlot: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'time_slot'
    },
    addressId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'address_id'
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'payment_method'
    },
    variantName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'variant_name'
    },
    supplier: {
      type: DataTypes.STRING,
      allowNull: false
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true
    },
    categoryIcon: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'category_icon'
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    depositPerDelivery: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'deposit_per_delivery'
    },
    nextDeliveryOn: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'next_delivery_on'
    },
    startedOn: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'started_on'
    },
    deliveriesDone: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'deliveries_done'
    },
    history: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: []
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
