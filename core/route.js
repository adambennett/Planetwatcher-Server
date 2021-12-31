require('dotenv').config({path: './.env'});
require('express-session');
const logger = require('../app/services/logService');
const endpoints = require('../app/endpoints');

const routing = (express) => {

    const router = express.Router();

    router.get('/manual-refresh', logRoute, endpoints.manualRefresh);
    router.get('/get-wallets', logRoute, endpoints.getWallets);

    router.post('/check-registration', logRoute, endpoints.checkRegistration);
    router.post('/register-device', logRoute, endpoints.registerDevice);
    router.post('/get-wallet-watches', logRoute, endpoints.getWalletWatches);
    router.post('/update-wallet-watches', logRoute, endpoints.updateWalletWatches);

    return router;
};

const logRoute = (req, res, next, notes) => {
    try { logger.http('[' + req.method + ']: ' + req.url, { notes, func: 'core/route.func()'}); } catch (err) {}
    return next();
};

module.exports = { routing };
