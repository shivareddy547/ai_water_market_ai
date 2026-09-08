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
      order_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'customer_orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      supplier_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      product_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      frequency: {
        type: Sequelize.STRING,
        allowNull: false
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Active'
      },
      next_delivery_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      variant_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      supplier: {
        type: Sequelize.STRING,
        allowNull: true
      },
      category_icon: {
        type: Sequelize.STRING,
        allowNull: true
      },
      image: {
        type: Sequelize.STRING,
        allowNull: true
      },
      time_slot: {
        type: Sequelize.STRING,
        allowNull: true
      },
      address_id: {
        type: Sequelize.UUID,
        allowNull: true
      },
      payment_method: {
        type: Sequelize.STRING,
        allowNull: true
      },
      deposit_per_delivery: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0
      },
      started_on: {
        type: Sequelize.DATEONLY,
        allowNull: true
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
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('subscriptions');
  }
};
