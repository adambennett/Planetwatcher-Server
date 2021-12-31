const Sequelize = require('sequelize');

module.exports = {
    id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
    },
    token: {
        type: Sequelize.STRING,
        unique: true
    },
    platform: {
        type: Sequelize.ENUM('android', 'ios')
    },
    isEnabled: {
        type: Sequelize.BOOLEAN
    },
    sendStillConnected: {
        type: Sequelize.BOOLEAN
    },
    notificationInterval: {
        type: Sequelize.INTEGER
    },
    lastSent: {
        type: Sequelize.DATE
    }
}
