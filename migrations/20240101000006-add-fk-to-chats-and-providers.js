'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add foreign key for chats.user_id
    try {
      await queryInterface.addConstraint('chats', {
        fields: ['user_id'],
        type: 'foreign key',
        name: 'chats_user_id_fkey',
        references: {
          table: 'users',
          field: 'id'
        }
      });
    } catch (e) {
      console.log('chats_user_id_fkey might already exist:', e.message);
    }

    // Add foreign key for providers.user_id
    try {
      await queryInterface.addConstraint('providers', {
        fields: ['user_id'],
        type: 'foreign key',
        name: 'providers_user_id_fkey',
        references: {
          table: 'users',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
    } catch (e) {
      console.log('providers_user_id_fkey might already exist:', e.message);
    }
  },
  down: async (queryInterface, Sequelize) => {
    try { await queryInterface.removeConstraint('chats', 'chats_user_id_fkey'); } catch (e) {}
    try { await queryInterface.removeConstraint('providers', 'providers_user_id_fkey'); } catch (e) {}
  }
};
