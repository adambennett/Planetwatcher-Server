require('dotenv').config({path: '../core/.env'});
const logger = require('./logService');
const Model = require('../../core/model');
const { Client, Intents } = require('discord.js');
const { token } = process.env.DISCORD_TOKEN;
const client = new Client({ intents: [ Intents.FLAGS.GUILDS, Intents.FLAGS.DIRECT_MESSAGES], partials: [ 'CHANNEL']});
const admin = require("firebase-admin");
const notifyType = process.env.NOTIFY_TYPE || 'Both';
client.once('ready', () => { logger.info('Discord client is ready'); });
client.on('messageCreate', async (msg) => { await onDiscordBotRecievedMessage(msg); });
client.login(token);
admin.initializeApp({ credential: admin.credential.applicationDefault() });

const prepareAndSendNotification = async (tokens, title, text) => {
    // Discord notifications
    if (notifyType === 'Both' || notifyType === 'Discord') {
        const discordTokens = tokens.filter(token => token.platform.toLowerCase() === 'discord');
        if (discordTokens.length > 0) {
            for (const token of discordTokens) {
                const user = await client.users.fetch(token.token);
                await user.send(`${title}:${text}`);
                await Model.NotificationToken.update({ lastSent: new Date()}, { where: { id: token.id }});
            }
        }
    }

    // Firebase notifications
    if (notifyType === 'Both' || notifyType === 'Firebase') {
        try {
            const data = {title,body: text};
            const notifi = {title,body: text};
            const message = {
                apns: {
                    payload: {
                        aps: {badge: 1}
                    }
                }
            };

            let sendAndroid = false;
            let sendIOS = false;

            const androidTokens = tokens.filter(token => token.platform === 'android');
            const androidTokenValues = [];
            const iosTokens = tokens.filter(token => token.platform === 'ios');
            const iosTokenValues = [];

            for (const token of tokens) {
                if (token.platform === 'android') {
                    androidTokenValues.push(token.token);
                } else {
                    iosTokenValues.push(token.token);
                }
            }

            if (androidTokens.length > 0) {
                sendAndroid = true;
                message.data = data;

                // comment this line out to make the banner show up on push delivery (breaks simultaneous notifications)
                message.notification = notifi;
            }
            if (sendAndroid) {
                message.tokens = androidTokenValues;
                await admin.messaging().sendMulticast(message);
                for (const token of androidTokens) {
                    await Model.NotificationToken.update({ lastSent: new Date()}, { where: { id: token.id }});
                }
            }
            if (iosTokens.length > 0) {
                sendIOS = true;
                message.notification = notifi;
            }
            if (sendIOS) {
                message.tokens = iosTokenValues;
                await admin.messaging().sendMulticast(message);
                for (const token of iosTokens) {
                    await Model.NotificationToken.update({ lastSent: new Date()}, { where: { id: token.id }});
                }
            }
            return true;
        }
        catch (err) {
            logger.error(`Error preparing or sending the notification. Error: ${err.name}`, { notes: err.message, func: 'app/notificationManager.prepareAndSendNotification()' });
            return false;
        }
    }
};

const sendNotificationToUsersDevices = async (type, wallet, hoursSinceLastStream) => {
    const errorPrefix = 'Error sending mobile notification to users device. Error: ';
    const { title, text } = getTitleAndText(type, wallet, hoursSinceLastStream);
    try {
        const tokens = await Model.NotificationToken.findAll();
        if (tokens) {
            const validTokens = [];
            const watches = await Model.WalletWatch.findAll({ where: { walletId: wallet.id }});
            for (const token of tokens) {
                if (!token.isEnabled) {
                    continue;
                }
                if (type === 'Good' && (!token.sendStillConnected || token.sendStillConnected === 'false')) {
                    continue;
                }

                const lastSent = token.lastSent;
                if (lastSent) {
                    const minutesSince = (new Date(new Date() - lastSent)).getMinutes();
                    const interval = token.notificationInterval ? token.notificationInterval : null;
                    if (interval && minutesSince <= interval) {
                        logger.info(`Skipping a notification for ${wallet.displayName} to ${token.displayName} because it has only been ${minutesSince} minutes since the last notification was sent.`);
                        continue;
                    }
                }
                const matches = watches.filter(watch => watch.notificationTokenId === token.id);
                if (matches.length > 0) {
                    validTokens.push(token);
                }
            }
            if (validTokens.length > 0) {
                await prepareAndSendNotification(validTokens, title, text);
            }
        }
    }
    catch (err) {
        logger.error(`${errorPrefix}${err.name}`, { notes: err.message, func: 'app/notificationManager.sendNotificationToUsersDevices()' });
    }
};

const getTitleAndText = (type, wallet, hoursSinceLastStream) => {
    const warningEnding = hoursSinceLastStream && hoursSinceLastStream !== 1 ? `${hoursSinceLastStream} hours.` : hoursSinceLastStream ? `${hoursSinceLastStream} hour.` : 'an unknown amount of time.';
    const phoneName = wallet.phoneName ? wallet.phoneName : "This device";
    switch (type) {
        case 'Good':
            return {
                title: `${wallet.displayName} Connected`,
                text: `Still connected properly as of ${wallet.lastConnectedFormatted}`
            };
        case 'Warning':
            return {
                title: `${wallet.displayName} Warning`,
                text: `${phoneName} may be disconnected and has not sent data streams for ${warningEnding}`
            };
    }
}

const onDiscordBotRecievedMessage = async (msg) => {
    if (msg.author.username === 'Planetwatcher' && msg.author.discriminator === '9966') {
        logger.info("Sending the following discord message to a user: " + msg.content);
        return;
    }
    const fallbackResponse = "Please send me a command! You can tell me to: register, unregister, interval, good, or help to explain these options.";
    const content = msg.content ? msg.content.split(" ") : null;
    const command = content ? content[0] : null;
    let options = content && content.length > 1 ? [] : null;
    if (options) {
        for (let i = 1; i < content.length; i++) {
            options.push(content[i]);
        }
        if (options.length === 0) options = null;
    }
    const userId = msg.author?.id;
    if (command) {
        switch (command) {
            case 'register':
                let counter = 0;
                const registerTokens = await Model.NotificationToken.findAll({ where: { token: userId, platform: 'discord'}});
                if (!registerTokens || registerTokens.length < 1) {
                    const notifyToken = await Model.NotificationToken.create({
                        token: userId,
                        platform: 'discord',
                        isEnabled: true,
                        sendStillConnected: false,
                        notificationInterval: 30,
                        displayName: msg.author.username
                    });
                    counter += await createSubRegistrationObjectsDiscord(options, notifyToken);
                    await msg.author.send(`Registered successfully! Added ${counter} new wallets to the watch list.`);
                } else {
                    counter += await createSubRegistrationObjectsDiscord(options, registerTokens[0]);
                    await Model.NotificationToken.update({ isEnabled: true }, { where: { token: userId }});
                    await msg.author.send(counter > 0 ? `You are already registered. Added ${counter} new wallets to the watch list.` : 'You are already registered.');
                }
                break;
            case 'unregister':
                const tokens = await Model.NotificationToken.findAll({where: {token: userId, platform: 'discord'}});
                if (!tokens || tokens.length < 1) {
                    await Model.NotificationToken.update({ isEnabled: false }, { where: { token: userId }});
                }
                break;
            case 'interval':
                const intervalTokens = await Model.NotificationToken.findAll({where: {token: userId, platform: 'discord'}});
                if (options && options.length > 0 && intervalTokens.length > 0) {
                    const newInterval = options[0];
                    try {
                        await Model.NotificationToken.update({ notificationInterval: newInterval }, { where: { token: userId }});
                    } catch (err) {}
                    await msg.author.send(`Interval set to ${newInterval} minutes.`);
                } else {
                    await msg.author.send("Interval was not modified. In order to use this command, please send a valid number of minutes to set your notification interval to.");
                }
                break;
            case 'good':
                const goodTokens = await Model.NotificationToken.findAll({where: {token: userId, platform: 'discord'}});
                if (goodTokens.length > 0) {
                    const sendStillConnected = !goodTokens[0].sendStillConnected;
                    await Model.NotificationToken.update({ sendStillConnected }, { where: { token: userId }});
                    await msg.author.send(`Toggled option to send still-connected notifications. Current setting: ${sendStillConnected}`);
                }
                break;
            case 'help':
                await msg.author.send(
                    "Register and unregister will tell the server to watch your wallets and send notifications to you or not.\n" +
                    "When you register, you can pass a list of wallets to watch, even if you are already registered.\n\n " +
                    "The syntax for wallets should be wallet address comma wallet name. " +
                    "For example to register wallet with address ABC under the name TestWallet, you can send a message like \"register ABC,TestWallet\".\n\n " +
                    "Unregister will simply toggle notifications off for your account.\n\n If you want to change the interval that notifications can be sent to you at, send interval followed by the number of minutes " +
                    "to wait between sending each notification. The default interval is 30 minutes.\n\nFinally, send the command \"good\" to the bot and you can toggle the option to send notifications whenever your device" +
                    "is successfully connected. This defaults to off, because by default you will get a notification roughly every 30 minutes for every wallet if you enable this.");
                break;
            default:
                await msg.author.send(fallbackResponse);
                break;
        }
    } else {
        await msg.author.send(fallbackResponse);
    }
}

const createSubRegistrationObjectsDiscord = async (options, notifyToken) => {
    let counter = 0;
    if (options) {
        for (const option of options) {
            try {
                const address = option.split(",")[0];
                const displayName = option.split(",")[1];
                const existingWallet = await Model.Wallet.findAll({ where: { address }});
                let walletId;
                if (!existingWallet || existingWallet.length < 1) {
                    const wallet = await Model.Wallet.create({ address, displayName });
                    walletId = wallet.id;
                } else {
                    walletId = existingWallet[0].id;
                }
                await Model.WalletWatch.create({ walletId, notificationTokenId: notifyToken.id });
                counter++;
            } catch (err) {
                logger.error(`Error registering wallets and wallet watches during discord registration! Error: ${err.name}`, { notes: err.message });
            }
        }
    }
    return counter;
}

module.exports = {
    sendNotificationToUsersDevices
}
