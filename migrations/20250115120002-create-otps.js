'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('otps', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            contact: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            contact_type: {
                type: Sequelize.ENUM('phone', 'email'),
                allowNull: false
            },
            otp_code: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            purpose: {
                type: Sequelize.ENUM('login', 'signup', 'reset_password'),
                allowNull: false
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            is_used: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            attempts: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            user_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
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
        await queryInterface.addIndex('otps', ['contact', 'purpose', 'is_used'], {
            name: 'otps_contact_purpose_idx'
        });
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('otps');
    }
};
