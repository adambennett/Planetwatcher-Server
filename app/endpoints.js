const logger = require('./services/logService');
const Model = require('../core/model');
const algoService = require("../app/services/algoService");

const manualRefresh = async (req, res) => {
    await algoService.checkForTransactions();
    res.status(200).send();
}

const getWallets = async (req, res) => {
    try {
        const found = await Model.Wallet.findAll();
        if (found && found.length > 0) {
            res.status(200).send(found);
            return;
        }
        res.status(404).send();
    } catch (err) {
        res.status(500).send(err);
    }
}

const getWalletWatches = async (req, res) => {
    try {
        const found = await Model.WalletWatch.findAll({ where: { notificationTokenId: req.body.Token }});
        if (found && found.length > 0) {
            res.status(200).send(found);
            return;
        }
        res.status(404).send();
    } catch (err) {
        res.status(500).send(err);
    }
}

const updateWalletWatches = async (req, res) => {
    try {
        const update = req.body.WalletWatches;
        await Model.WalletWatch.destroy({ where: { notificationTokenId: req.body.Token}});
        for (const walletWatch of update) {
            await Model.WalletWatch.create(walletWatch);
        }
        res.status(200).send();
    } catch (err) {
        res.status(500).send(err);
    }
}

const checkRegistration = async (req, res) => {
    try {
        const found = await Model.NotificationToken.findAll({ where: { token: req.body.Token }});
        if (found && found.length > 0) {
            res.status(200).send();
            return;
        }
        res.status(404).send();
    } catch (err) {
        res.status(500).send(err);
    }
}

const registerDevice = async (req, res) => {
    try {
        const token = req.body.Token;
        const platform = req.body.PlatformDetails.IsAndroid ? 'android' : 'ios';
        await Model.NotificationToken.destroy({ where: { token }});
        const createdToken = await Model.NotificationToken.create({ token, platform, isEnabled: true });
        const wallets = await Model.Wallet.findAll({ attributes: ['id']});
        for (const wallet of wallets) {
            await Model.WalletWatch.create({
                walletId: wallet.id,
                notificationTokenId: createdToken.id
            });
        }
        res.status(200).send();
    } catch (err) {
        logger.error(`Unknown error registering device token! Error: ${err.message}`, { func: 'app/endpoints.registerDeviceToken()' });
        res.status(500).send();
    }
};

module.exports = {
    manualRefresh,
    registerDevice,
    checkRegistration,
    getWallets,
    getWalletWatches,
    updateWalletWatches
}
