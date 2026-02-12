const fs = require('fs');
const path = require('path');

// This loader runs before the main server to inject environment variables
// from a persistent location outside public_html (which gets wiped on deploy).

// Path to the persistent .env file (one level up from public_html)
// We are in src/, so: ../.. goes to public_html/ -> domain_root/
const persistentEnvPath = path.resolve(__dirname, '../../.env');

// Target path: .env inside public_html (where dotenv expects it)
const targetEnvPath = path.resolve(__dirname, '../.env');

console.log('Loader: Checks for persistent .env...');

if (fs.existsSync(persistentEnvPath)) {
    try {
        fs.copyFileSync(persistentEnvPath, targetEnvPath);
        console.log('Loader: Copied .env successfully.');
    } catch (err) {
        console.error('Loader: Error copying .env:', err);
    }
} else {
    console.warn('Loader: Persistent .env not found at', persistentEnvPath);
}

// Start the actual application
require('./server');
