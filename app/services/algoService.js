require('dotenv').config({path: '../core/.env'});
const algosdk = require('algosdk');
const Model = require('../../core/model');
const notificationManager = require('./notifyService');
const logger = require('./logService');
const indexer_token = { 'X-API-key': process.env.PURESTAKE_API_KEY };
const indexer_server = process.env.PURESTAKE_API_URL;
const indexer_port = '';
const indexerClient = new algosdk.Indexer(indexer_token, indexer_server, indexer_port);
const planetTokenId = 27165954;

const thirtySecondTimer = 30000;
const fiveMinuteTimer   = 300000;

const algoWatcher = () => {
    if (process.env.NOTIFICATIONS === 'false') {
        return;
    }
    checkForTransactions().then().catch();
    setInterval(async () => {
        await checkForTransactions();
    }, fiveMinuteTimer);
}

const checkForTransactions = async () => {
    try {
        const wallets = await Model.Wallet.findAll();
        let timer = 0;
        for (const wallet of wallets) {
            setTimeout(async () => { await txCheckLogic(wallet); }, timer);
            timer += thirtySecondTimer;
        }
    } catch (err) {
        logger.error(`Error checking for transactions! Error: ${err.name}`, { notes: err.message, func: 'services/algoService.checkForTransactions()'});
    }
}

const txCheckLogic = async (wallet) => {
    const latestTx = await getLatestWalletTx(wallet);
    if (latestTx) {
        if (latestTx.error) {
            const lastWalletConnect = wallet.lastConnected ? new Date(wallet.lastConnected) : null;
            let hoursSinceLastStream = 'An unknown amount of';
            if (lastWalletConnect) {
                const now = new Date();
                const difference = now.getHours() - lastWalletConnect.getHours();
                hoursSinceLastStream = difference > 0 ? difference : hoursSinceLastStream;
            }
            await notificationManager.sendNotificationToUsersDevices( 'Warning', wallet, hoursSinceLastStream);
            return;
        }
        const lastConnected = latestTx.timestamp;
        if (wallet.lastConnected == null || lastConnected >= wallet.lastConnected) {
            const update = { lastConnected, lastConnectedFormatted: latestTx.time };
            await Model.Wallet.update(update, { where: { id: wallet.id }});
        }

        const date = new Date(lastConnected * 1000);
        const now = new Date();
        if (date.getHours() < now.getHours()) {
            const difference = now.getHours() - date.getHours();
            if (difference > 1) {
                await notificationManager.sendNotificationToUsersDevices( 'Warning', wallet, difference);
            } else {
                logger.info(`Wallet check for ${wallet.displayName} was normal. No warning sent. Last Connected: ${wallet.lastConnectedFormatted}`, {
                    func: 'services/algoService.txCheckLogic()',
                    notes: `There was a ${difference} hour difference in time between wallet last connected and the time of this check.`,
                });
                await sendGoodNotification(wallet);
            }
        } else {
            logger.info(`Wallet check for ${wallet.displayName} was normal. No warning sent.`, {func: 'services/algoService.txCheckLogic()'});
            await sendGoodNotification(wallet);
        }
    } else {
        logger.info(`something went wrong for ${wallet.displayName} check`, {func: 'services/algoService.txCheckLogic()'});
    }
}

const sendGoodNotification = async (wallet) => {
    const updatedWallet = await Model.Wallet.findOne({ where: { id: wallet.id }});
    await notificationManager.sendNotificationToUsersDevices('Good', updatedWallet);
}

const getLatestWalletTx = async (wallet) => {
    const { startYear, startMonth, startDay } = formatStartTime(wallet);
    const startTime = createStartTime(startYear, startMonth, startDay);
    let response;
    try {
        response = await indexerClient.searchForTransactions()
            .address(wallet.address)
            .afterTime(startTime)
            .do();
    } catch (err) {
        console.log({message: 'Error loading response from indexer API', time: new Date()}, '\n', err);
        return null;
    }
    if (response) {
        const formatted = JSON.parse(JSON.stringify(response, undefined, 2));
        const transactions = [];
        const txs = formatted.transactions;
        for (const tx of txs) {
            const txData = tx['asset-transfer-transaction'];
            const timestamp = tx['round-time'];
            if (txData && txData['asset-id'] === planetTokenId && txData.amount === 0) {
                transactions.push({
                    time: formatDate(timestamp),
                    timestamp
                });
            }
        }
        if (transactions.length < 1 && txs.length > 0) {
            return { error: true };
        }
        return transactions[0];
    }
    return null;
}

const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const day = `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}`;
    const hours = date.getHours();
    const minutes = `0${date.getMinutes()}`;
    return `${day} ${hours}:${minutes.substr(-2)}`;
}

const formatStartTime = (wallet) => {
    const startYear = wallet.lastConnected ? (new Date(wallet.lastConnected * 1000)).getFullYear() : "2021";
    const startMonth = wallet.lastConnected ? (new Date(wallet.lastConnected * 1000).getMonth()) + 1 : "12";
    let startDay = wallet.lastConnected ? (new Date(wallet.lastConnected * 1000).getDate()) : "05";
    if (startDay.toString().length < 2) {
        startDay = "0" + startDay;
    }
    return { startYear, startMonth, startDay };
}

const createStartTime = (year, month, day) => {
    month = month < 10 ? `0${month}` : month;
    return `${year}-${month}-${day}`;
}

module.exports = {
    checkForTransactions,
    algoWatcher
}
