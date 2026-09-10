'use strict';
const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
    class CronJobLog extends Model {
        static associate(models) {
        }
    }
    CronJobLog.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        jobName: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'job_name'
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'running'
        },
        processed: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        succeeded: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        failed: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        details: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {}
        },
        startedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'started_at'
        },
        completedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'completed_at'
        }
    }, {
        sequelize,
        modelName: 'CronJobLog',
        tableName: 'cron_job_logs',
        timestamps: true,
        underscored: true
    });
    return CronJobLog;
};
