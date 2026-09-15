'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('providers', 'user_id', {
      type: Sequelize.UUID,
      allowNull: true
    });
    await queryInterface.addColumn('providers', 'target_type', {
      type: Sequelize.ENUM('user', 'role'),
      allowNull: false,
      defaultValue: 'user'
    });
    await queryInterface.addColumn('providers', 'target_role', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('providers', 'target_type');
    await queryInterface.removeColumn('providers', 'target_role');
    await queryInterface.changeColumn('providers', 'user_id', {
      type: Sequelize.UUID,
      allowNull: false
    });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_providers_target_type";');
  }
};
