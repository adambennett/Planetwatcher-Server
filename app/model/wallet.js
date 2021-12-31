const Sequelize = require('sequelize');

module.exports = {
    id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
    },
    address: {
        type: Sequelize.STRING,
        unique: true
    },
    lastConnected: {
        type: Sequelize.STRING
    },
    lastConnectedFormatted: {
        type: Sequelize.STRING
    },
    displayName: {
        type: Sequelize.STRING
    },
    phoneName: {
        type: Sequelize.STRING
    }
}
