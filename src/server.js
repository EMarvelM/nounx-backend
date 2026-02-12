const fs = require('fs');
const path = require('path');

// Hostinger Persistency Hack:
// Copy .env from parent directory (persistent) to current directory (wiped on deploy)
try {
    const persistentEnvPath = path.resolve(__dirname, '../../.env');
    const targetEnvPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(persistentEnvPath)) {
        fs.copyFileSync(persistentEnvPath, targetEnvPath);
        console.log('Server: Successfully restored persistent .env');
    } else {
        console.warn('Server: Persistent .env not found at', persistentEnvPath);
    }
} catch (error) {
    console.error('Server: Failed to restore .env:', error);
}

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { swaggerUi, specs } = require('./utils/swagger');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const prisma = require('./prisma');

// Middleware
app.use(cors());
app.use(express.json());


// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});
// TEMP: Debug env vars (remove after confirming)
app.get('/debug-env', (req, res) => {
    res.json({
        time: new Date().toISOString(),
        node: process.version,
        execPath: process.execPath,
        envKeysSample: Object.keys(process.env).filter(k => k.includes('MONGO') || k.includes('JWT') || k.includes('DATABASE') || k.includes('ERP')),
        has_DATABASE_URL: !!process.env.DATABASE_URL,
        has_MONGODB_URI: !!process.env.MONGODB_URI,
        mongoose_status: mongoose.connection.readyState, // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
        has_JWT_SECRET: !!process.env.JWT_SECRET,
        has_ERP_MIRROR_DB_URL: !!process.env.ERP_MIRROR_DB_URL,
        NODE_ENV: process.env.NODE_ENV,
    });
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Auth Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Group/Room Routes
const roomRoutes = require('./routes/rooms');
app.use('/api/rooms', roomRoutes);

// Identity Verification Routes
const verifyRoutes = require('./routes/verify');
app.use('/api/verify', verifyRoutes);

// Socket Logic
require('./socket/chat')(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
