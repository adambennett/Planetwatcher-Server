const fs = require('fs');
const path = require('path');
const args = process.argv.length > 2 ? process.argv[2] : null;
const environmentPath = path.join(__dirname, './.env');

const generate = () => {
    let options = null;
    try {
        /*
        Read any options passed into 'npm run generate {}'
        Options format:

        {
            port: number
            expressSecret: string
            dbHost: string
            dbPort: number
            dbName: string
            dbUser: string
            dbPass: string
            firebaseKeyPath: string
        }

        */
        try { options = args ? JSON.parse(args) : null; } catch (err) {
            console.log('Error generating environment file!', err);
        }

        // Prepare variables
        let port;
        let expressSecret;
        let dbHost;
        let dbPort;
        let dbName;
        let dbUser;
        let dbPass;

        // Check if any options were actually passed in and update defaults
        port = options && options.port ? options.port : '80';
        expressSecret = options && options.expressSecret ? options.expressSecret : 'aaaaaaaaaaaaaaa';
        dbHost = options && options.dbHost ? options.dbHost : 'localhost';
        dbPort = options && options.dbPort ? options.dbPort : '5432';
        dbName = options && options.dbName ? options.dbName : 'planetwatcher';
        dbUser = options && options.dbUser ? options.dbUser : '';
        dbPass = options && options.dbPass ? options.dbPass : '';

        // Create environment file with options above and all necessary defaults
        const env = `# Server Settings\nPORT=${port}\nNOTIFICATIONS=true\nEXPRESS_SECRET=${expressSecret}\nGOOGLE_APPLICATION_CREDENTIALS=\n\n# DB Settings\nDB_DIALECT=postgres\nDB_HOST=${dbHost}\nDB_PORT=${dbPort}\nDB_NAME=${dbName}\nDB_USERNAME=${dbUser}\nDB_PASSWORD=${dbPass}\nDB_MODE=update    # switch to create to populate database automatically\n\n# Logger Settings\nLOG_LEVEL=debug\nSQL_LOG_LEVEL=debug\nLOG_TO_CONSOLE=false\nLOG_TO_CONSOLE_CONDENSED=true\nLOG_SQL_TO_CONSOLE=false\n\n# Algorand Settings\nPURESTAKE_API_URL=\nPURESTAKE_API_KEY=\n\n# Notification Settings\nNOTIFY_TYPE=Both\n\n# Discord Settings\nDISCORD_TOKEN=`;

        // Write to ../core/.env
        fs.writeFileSync(environmentPath, env);
    } catch (err) {
        console.log('Error generating environment file!', err);
    }
};

generate();
