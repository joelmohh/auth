const fs = require('fs');
const path = require('path');

const logFolderPath = path.join(__dirname, '../logs');

if (!fs.existsSync(logFolderPath)) {
    fs.mkdirSync(logFolderPath, { recursive: true });
}

function logError(error) {
    const currentTimestamp = new Date(Date.now()).toISOString().split('T')[0].replace(/-/g, '');

    const logMessage = `[${new Date(Date.now()).toISOString()}] ${error.stack || error}\n`;

    const file = path.join(logFolderPath, `${currentTimestamp}.log`);

    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, logMessage, 'utf8');
        
        console.error(error)

    } else {
        fs.appendFileSync(file, logMessage, 'utf8');

        console.error(error)
    }
}

module.exports = { logError };