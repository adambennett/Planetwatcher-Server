require('dotenv').config({path: './.env'});
const Sequelize = require('sequelize');
const { queryLogger } = require('../app/services/logService');

const printQueriesToConsole = (process.env.LOG_SQL_TO_CONSOLE) ? (process.env.LOG_SQL_TO_CONSOLE === 'true') : true;
const queryLogDestination = (queryLogger) ? queryLogger : (printQueriesToConsole) ? console.log : false;

const args = process.argv.length > 2 ? process.argv[2] : null;
const dbName = args && args === 'testing' ? process.env.TEST_DB_NAME : process.env.DB_NAME;

const sequelize = new Sequelize(dbName, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
    dialect: process.env.DB_DIALECT,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    logging: queryLogDestination,
    define: {
        charset: 'utf8',
        collate: 'utf8_general_ci',
        timestamps: false,                   // default true: true includes timestamp attributes.
        paranoid: false,                    // default false: true does not delete db entries and sets deletedAt. Only works with timestamps.
        underscored: true,                  // default false: true sets field option for all attributes to snake case name.
        freezeTableName: true,              // default false: true prevents model names from changing into plural.
        version: false,                     // default false: true or a string name enables optimistic locking and a version count attribute that throws an OptimisticLockingError on saving stale instances
    }
});

module.exports = sequelize;
