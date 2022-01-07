require('dotenv').config({path: './core/.env'});
const routing = require('./core/route');
const express = require('express');
const app = express();
const session = require('express-session');
const bodyParser = require('body-parser');
const logger = require('./app/services/logService');
const jsonParser = bodyParser.json();
const router = routing.routing(express);
const http = require('http');
const port = process.env.PORT || 80;
const databaseService = require('./app/services/deploymentService');
const algoService = require('./app/services/algoService');

app.use(session({ secret: process.env.EXPRESS_SECRET, resave: false, saveUninitialized: false, rolling: true }));

app.use(jsonParser);
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.use('/', router);
app.use('*', (req, res) => { res.status(404).send('PLANETWATCHER SERVER<br><br>Route not found!'); });

databaseService.databaseAutodeploy();
algoService.algoWatcher();

const httpServer = http.createServer(app);
httpServer.listen(port);

logger.http(logger.asciiLogo, {
    notes:`Served on port ${port}`,
    func:'server.js',
    isStartup: true
});
