const Connection = require('./setupSequelize');

const NotificationToken = Connection.define('notification_tokens', require('../app/model/notificationToken'));
const Wallet = Connection.define('wallets', require('../app/model/wallet'));
const WalletWatch = Connection.define('watches', require('../app/model/walletWatch'));

WalletWatch.belongsTo(Wallet);
WalletWatch.belongsTo(NotificationToken);

module.exports = {
    NotificationToken,
    Wallet,
    WalletWatch
}
