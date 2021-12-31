const Sequelize = require('sequelize');

module.exports = {
    id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
    },
    walletId: {
        type: Sequelize.UUID
    },
    notificationTokenId: {
        type: Sequelize.UUID
    }
}
