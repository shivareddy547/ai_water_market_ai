'use strict';
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/config');
const env = process.env.NODE_ENV || 'development';
const configEnv = config[env];
let sequelize;
if (configEnv.use_env_variable) {
    sequelize = new Sequelize(process.env[configEnv.use_env_variable], {
        dialect: configEnv.dialect,
        logging: configEnv.logging,
        define: configEnv.define
    });
} else {
    sequelize = new Sequelize(
        configEnv.database,
        configEnv.username,
        configEnv.password,
        configEnv
    );
}
const basename = path.basename(__filename);
const db = {};
db.sequelize = sequelize;
db.Sequelize = Sequelize;
fs.readdirSync(__dirname)
    .filter(file => {
        return (
            file.indexOf('.') !== 0 &&
            file !== basename &&
            file.slice(-3) === '.js' &&
            !file.includes('.test.js')
        );
    })
    .forEach(file => {
        const model = require(path.join(__dirname, file))(sequelize);
        db[model.name] = model;
    });
Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});
module.exports = db;
