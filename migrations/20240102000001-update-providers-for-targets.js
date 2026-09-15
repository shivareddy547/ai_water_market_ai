'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.changeColumn('providers', 'user_id', {
        type: Sequelize.UUID,
        allowNull: true
      });
    } catch (e) {
      console.log('Column user_id already allows null or cannot be changed:', e.message);
    }
    try {
      await queryInterface.addColumn('providers', 'target_type', {
        type: Sequelize.ENUM('user', 'role'),
        allowNull: false,
        defaultValue: 'user'
      });
    } catch (e) {
      console.log('Column target_type might already exist:', e.message);
    }
    try {
      await queryInterface.addColumn('providers', 'target_role', {
        type: Sequelize.STRING,
        allowNull: true
      });
    } catch (e) {
      console.log('Column target_role might already exist:', e.message);
    }
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
