'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('subscriptions', 'variant_name', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('subscriptions', 'supplier', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('subscriptions', 'category_icon', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('subscriptions', 'image', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('subscriptions', 'time_slot', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('subscriptions', 'address_id', {
      type: Sequelize.UUID,
      allowNull: true
    });
    await queryInterface.addColumn('subscriptions', 'payment_method', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('subscriptions', 'deposit_per_delivery', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0
    });
    await queryInterface.addColumn('subscriptions', 'started_on', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
    await queryInterface.addColumn('subscriptions', 'deliveries_done', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn('subscriptions', 'history', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: []
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('subscriptions', 'variant_name');
    await queryInterface.removeColumn('subscriptions', 'supplier');
    await queryInterface.removeColumn('subscriptions', 'category_icon');
    await queryInterface.removeColumn('subscriptions', 'image');
    await queryInterface.removeColumn('subscriptions', 'time_slot');
    await queryInterface.removeColumn('subscriptions', 'address_id');
    await queryInterface.removeColumn('subscriptions', 'payment_method');
    await queryInterface.removeColumn('subscriptions', 'deposit_per_delivery');
    await queryInterface.removeColumn('subscriptions', 'started_on');
    await queryInterface.removeColumn('subscriptions', 'deliveries_done');
    await queryInterface.removeColumn('subscriptions', 'history');
  }
};
