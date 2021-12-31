const logger = require('./logService');
const Model = require('../../core/model');
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.applicationDefault() });

const prepareAndSendNotification = async (tokens, title, text) => {
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

module.exports = {
    sendNotificationToUsersDevices
}
