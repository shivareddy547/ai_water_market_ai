'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cron_job_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      job_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'running'
      },
      processed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      succeeded: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      failed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      details: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      completed_at: {
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
      }
    });
    await queryInterface.addIndex('cron_job_logs', ['job_name']);
    await queryInterface.addIndex('cron_job_logs', ['status']);
    await queryInterface.addIndex('cron_job_logs', ['created_at']);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('cron_job_logs');
  }
};
