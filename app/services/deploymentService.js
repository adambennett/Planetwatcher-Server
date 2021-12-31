const model = require("../../core/model");
const sequelize = require("../../core/setupSequelize");
const logger = require('./logService');

const databaseAutodeploy = () => {
    if (process.env.DB_MODE !== 'create') {
        return;
    }
    const migratedWallets = [];
    const migratedTokens = [];
    const migratedWatches = [];
    model.Wallet.findAll().then(wallets => {
        for (const wallet of wallets) {
            migratedWallets.push({
                id: wallet.id,
                address: wallet.address,
                lastConnected: wallet.lastConnected,
                lastConnectedFormatted: wallet.lastConnectedFormatted,
                displayName: wallet.displayName
            });
        }
        return model.NotificationToken.findAll();
    }).then(tokens => {
        for (const token of tokens) {
            migratedTokens.push({
                id: token.id,
                token: token.token,
                platform: token.platform,
                isEnabled: token.isEnabled,
                sendStillConnected: token.sendStillConnected
            });
        }
        return model.WalletWatch.findAll();

    }).then(watches => {
        for (const watch of watches) {
            migratedWatches.push({
                id: watch.id,
                walletId: watch.walletId,
                notificationTokenId: watch.notificationTokenId
            });
        }
        return sequelize.sync({force:true})
    }).then(async () => {
        for (const wallet of migratedWallets) {
            await model.Wallet.create(wallet);
        }
        for (const token of migratedTokens) {
            await model.NotificationToken.create(token);
        }
        for (const watch of migratedWatches) {
            await model.WalletWatch.create(watch);
        }
        logger.info('database re-deployed successfully', { func: 'services/deploymentService.databaseAutodeploy()'});
    }).catch(err => {
        logger.error(`Error syncing database! Error: ${err.name}`, { notes: err.message, func: 'services/deploymentService.databaseAutodeploy()'});
    });
}

module.exports = {
    databaseAutodeploy
}
