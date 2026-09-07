'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('subscriptions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'active'
      },
      frequency: {
        type: Sequelize.STRING,
        allowNull: false
      },
      custom_days: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      qty: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      time_slot: {
        type: Sequelize.STRING,
        allowNull: true
      },
      address_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'customer_addresses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      payment_method: {
        type: Sequelize.STRING,
        allowNull: false
      },
      variant_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      supplier: {
        type: Sequelize.STRING,
        allowNull: false
      },
      image: {
        type: Sequelize.STRING,
        allowNull: true
      },
      category_icon: {
        type: Sequelize.STRING,
        allowNull: true
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      deposit_per_delivery: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      next_delivery_on: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      started_on: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      deliveries_done: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      history: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('subscriptions');
  }
};
