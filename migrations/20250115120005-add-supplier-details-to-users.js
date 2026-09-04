'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('users', 'verification_status', {
        type: Sequelize.ENUM('pending', 'verified', 'rejected'),
        allowNull: false,
        defaultValue: 'pending'
      });
    } catch (e) {}
    try {
      await queryInterface.addColumn('users', 'reject_reason', {
        type: Sequelize.STRING,
        allowNull: true
      });
    } catch (e) {}
    try {
      await queryInterface.addColumn('users', 'commission', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 10
      });
    } catch (e) {}
    try {
      await queryInterface.addColumn('users', 'categories', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: []
      });
    } catch (e) {}
  },
  down: async (queryInterface, Sequelize) => {
    try { await queryInterface.removeColumn('users', 'verification_status'); } catch (e) {}
    try { await queryInterface.removeColumn('users', 'reject_reason'); } catch (e) {}
    try { await queryInterface.removeColumn('users', 'commission'); } catch (e) {}
    try { await queryInterface.removeColumn('users', 'categories'); } catch (e) {}
  }
};
