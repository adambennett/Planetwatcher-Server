require('dotenv').config({path: '../core/.env'});
const winston = require('winston');
const moment = require('moment');
const path = require('path');
require('winston-daily-rotate-file');

// Setup output formatting of log files
const logFormat = winston.format.printf(({ level, message, timestamp, notes, user, func, array, object, performance, isStartup}) => {
    const format = {
        level: level,
        message: isStartup ? 'SampleVision started' : getStringFromUnknownObjectType(message),
        notes: getStringFromUnknownObjectType(notes),
        stack: func,
        object: object != null ? object : null,
        array: Array.isArray(array) ? array : null,
        type: (message != null) ? 'M' : (array != null) ? 'A' : (object != null) ? 'O' : 'U',
        server: user == null,
        time: moment(timestamp).format('H:mm:ss'),
        timestamp: timestamp,
        SQL: false,
        username: (user != null && user.username) ? user.username : 'SERVER',
        userID: (user != null && user.id) ? user.id : 'N/A',
        performance: performance
    };
    if (process.env.LOG_TO_CONSOLE_CONDENSED === 'true') {
        if (isStartup) {
            console.log(`\n${message}`);
            console.log(`${notes.split(', ').join('\n')}\n`);
        } else {
            let log = `${level}:: ${message}`;
            const dateToUse = new Date();
            const date = moment(dateToUse).format('MM/DD/yyyy');
            const time = moment(dateToUse).format('hh:mm:ss');
            if (notes != null) {
                log += `\n    Notes: ${notes}`;
            }
            log += `\n    Date: ${date}`;
            log += `\n    Time: ${time}`;
            if(performance != null) {
                log += `\n    Performance: ${performance} seconds`;
            }
            if (func != null) {
                log += `\n    Function: ${func}`;
            }
            log += '\n';
            console.log(log);
        }
    }
    try {
        format.function = func.split('.')[1];
        format.directory = func.split('.')[0];
    } catch (err) {
        format.function = func;
        format.directory = null;
    }
    return JSON.stringify(format) + ',';
});

// Setup output formatting for SQL Query logs
const queryFormat = winston.format.printf(({level, message, timestamp}) => {
    message = message.toString();
    message = message.split('"').join("'");
    const queryKey = (message.startsWith('Executing (default): DROP')) ? 'R' : (message.startsWith('Executing (default): CREATE')) ? 'C' : message.split('"').join('\'').substring(20, 22).trim();
    let queryType;
    let table = getTableFromQueryString(message, queryKey);
    table = (table == null || table === '' || table === 'undefined') ? 'Unknown' : table;
    switch (queryKey.toUpperCase()) {
        case 'S': queryType = 'Select'; break;
        case 'D': queryType = 'Delete'; break;
        case 'U': queryType = 'Update'; break;
        case 'C': queryType = 'Create'; break;
        case 'I': queryType = 'Insert'; break;
        case 'R': queryType = 'Drop'; break;
        default: queryType = 'Unknown'; break;
    }
    const format = {
        message: message,
        time: moment(timestamp).format('H:mm:ss'),
        timestamp: timestamp,
        SQL: true,
        table: table,
        type: queryType
    }
    return JSON.stringify(format) + ',';
});

// File object for standard logging
const logfile = new (winston.transports.DailyRotateFile)({
    filename: 'server',
    datePattern: 'YYYY-MM-DD',
    dirname: path.join(__dirname, '../../logs/server/logs'),
    extension: '.log'
});

// File object for exception logging
const exceptionFile = new (winston.transports.DailyRotateFile)({
    filename: 'exceptions',
    datePattern: 'YYYY-MM-DD',
    dirname: path.join(__dirname, '../../logs/server/exceptions'),
    extension: '.log'
});

// File object for rejection logging
const rejectionFile = new (winston.transports.DailyRotateFile)({
    filename: 'rejections',
    datePattern: 'YYYY-MM-DD',
    dirname: path.join(__dirname, '../../logs/server/rejections'),
    extension: '.log'
});

// File object for query logging
const queryFile = new (winston.transports.DailyRotateFile)({
    filename: 'queries',
    datePattern: 'YYYY-MM-DD',
    dirname: path.join(__dirname, '../../logs/server/sql'),
    extension: '.log'
});

// Block for handling environment settings that change logging preferences
const isPrintingQueries = (process.env.LOG_SQL_TO_CONSOLE) ? (process.env.LOG_SQL_TO_CONSOLE === 'true') : true;
const logFilesArr = [ logfile ];
const exceptionFilesArr = [ exceptionFile ];
const rejectFilesArr = [ rejectionFile ];
const queryFilesArr = [ queryFile ];
if (process.env.LOG_TO_CONSOLE === 'true' && process.env.LOG_TO_CONSOLE_CONDENSED === 'false') {
    logFilesArr.push(new winston.transports.Console);
    exceptionFilesArr.push(new winston.transports.Console);
    rejectFilesArr.push(new winston.transports.Console);
}
if (isPrintingQueries) {
    queryFilesArr.push(new winston.transports.Console);
}

// Instantiate and initialize a new singleton logger for use in all standard logging calls throughout the application
const logger = winston.createLogger({
    level:  process.env.LOG_LEVEL || 'debug',
    levels: { 'off': 0, 'error': 1, 'warn': 2, 'info': 3, 'http': 4, 'verbose': 5, 'debug': 6 },
    exitOnError: false,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.splat(),
        winston.format.json(),
        logFormat
    ),
    transports: logFilesArr,
    exceptionHandlers: exceptionFilesArr,
    rejectionHandlers: rejectFilesArr
});

// Instantiate and initialize a new logger that can handle our sequelize queries
const queryLogger = winston.createLogger({
    level: 'debug',
    levels: { 'off': 0, 'error': 1, 'warn': 2, 'info': 3, 'http': 4, 'verbose': 5, 'debug': 6 },
    exitOnError: false,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.splat(),
        winston.format.json(),
        queryFormat
    ),
    transports: queryFilesArr
});

// Toggle SQL logging on/off based on environment
const sqlEnvLevel = process.env.SQL_LOG_LEVEL;
const sqlLogger = (sqlEnvLevel === 'off') ? null : queryLogger.debug.bind(queryLogger);

// If you are getting TypeError: Converting circular structure to JSON, use this instead of JSON.stringify()
const simpleStringify = (object) => {
    const simpleObject = {};
    for (const prop in object ){
        if (!object.hasOwnProperty(prop)){
            continue;
        }
        if (typeof(object[prop]) == 'object'){
            continue;
        }
        if (typeof(object[prop]) == 'function'){
            continue;
        }
        simpleObject[prop] = object[prop];
    }
    return JSON.stringify(simpleObject);
};

// Can be passed as a second arg to JSON.stringify() to get around Circular references as well
// Use instead of logger.stringify() if you need to print embedded objects/methods)
const censor = (censor) => {
    let i = 0;
    return function(key, value) {
        if(i !== 0 && typeof(censor) === 'object' && typeof(value) == 'object' && censor == value)
            return '[Circular]';
        if(i >= 29) // seems to be a harded maximum of 30 serialized objects?
            return '[Unknown]';
        ++i; // so we know we aren't using the original object anymore
        return value;
    }
};

const formatString = (string) => {
    return string.split('\\"').join("'");
};

// Turns basically any passed variable into a readable string (ideally)
const getStringFromUnknownObjectType = (object) => {
    return object != null ? (Array.isArray(object) || typeof object === 'object') ? formatString(JSON.stringify(object)) : formatString(object.toString()) : object;
};

// Computes the table name from a SQL query string, given a certain query type
const getTableFromQueryString = (message, queryKey) => {
    let table;
    try {
        if (queryKey === 'U' || queryKey === 'I') {
            const afterQueryType = message.split( queryKey === 'U' ? 'UPDATE ' : 'INSERT' + ' INTO ');
            const tableText = afterQueryType[1].split("'");
            table = tableText[1];
        } else {
            try {
                if (typeof message.startsWith === 'function') {
                    const splitter = (message.startsWith('Executing (default): DROP')) ? 'IF EXISTS ' : (message.startsWith('Executing (default): CREATE TABLE')) ? 'IF NOT EXISTS ' : null;
                    if (splitter) {
                        const getIfExists = message.split(splitter);
                        const tableText = getIfExists[1];
                        const splice = tableText.split("'");
                        return splice[1];
                    }
                }
            } catch (err) {}
            const upper = message.indexOf('FROM');
            const splitt = upper === -1 ? 'from ' : 'FROM ';
            const getFrom = message.split(splitt);
            if (getFrom) {
                const tableText = getFrom[1];
                if (tableText) {
                    const whereIndex = tableText.indexOf('WHERE');
                    const lowerWhereIndex = tableText.indexOf('where');
                    const quoteIndex = tableText.indexOf("'");
                    let setByWhere = false;
                    let sep;
                    if (whereIndex != null && quoteIndex != null) {
                        if ((whereIndex === -1 && lowerWhereIndex === -1) || whereIndex > quoteIndex || lowerWhereIndex > quoteIndex) {
                            sep = "'";
                        } else {
                            sep = whereIndex > -1 ? 'WHERE' : 'where';
                            setByWhere = true;
                        }
                    } else {
                        sep = "'";
                    }
                    if (lowerWhereIndex === -1 && quoteIndex === -1 && whereIndex !== -1) {
                        sep = 'WHERE';
                        setByWhere = true;
                    }
                    if (lowerWhereIndex === -1 && whereIndex === -1 && quoteIndex !== -1) {
                        sep = "'";
                    }
                    if (whereIndex === -1 && quoteIndex === -1 && lowerWhereIndex !== -1) {
                        sep = 'where';
                        setByWhere = true;
                    }
                    table = tableText.split(sep);
                    if (table != null) {
                        table = setByWhere || table.length === 1 ? table[0].trim() : table[1];
                        table = table.indexOf(" ") > -1 ? table.split(" ")[0].toLowerCase() : table.toLowerCase();
                    }
                }
            }
        }
    } catch (err) {}
    return table;
}

const asciiLogo = "\n" +
"    .----------------.  .----------------.\n" +
"| .--------------. || .--------------. |\n" +
"| |   ______     | || | _____  _____ | |\n" +
"| |  |_   __ \\   | || ||_   _||_   _|| |\n" +
"| |    | |__) |  | || |  | | /\ | |  | |\n" +
"| |    |  ___/   | || |  | |/  \| |  | |\n" +
"| |   _| |_      | || |  |   /\   |  | |\n" +
"| |  |_____|     | || |  |__/  \__|  | |\n" +
"| |              | || |              | |\n" +
"| '--------------' || '--------------' |\n" +
"'----------------'  '----------------'";

// This properly binds calls to our singleton logger such that elsewhere you can simply call 'logger.error()'
// Without the .bind() calls you would need to call 'logger.logger.error()' elsewhere
module.exports = {
    queryLogger: sqlLogger,
    logify: simpleStringify,
    censor: censor,
    error: logger.error.bind(logger),
    warn: logger.warn.bind(logger),
    info: logger.info.bind(logger),
    http: logger.http.bind(logger),
    verbose: logger.verbose.bind(logger),
    debug: logger.debug.bind(logger),
    asciiLogo
}
