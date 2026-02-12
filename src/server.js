if (process.env.NODE_ENV !== 'production') require('dotenv').config();
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

const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// DB Connections — Sync schema at startup
const { execSync } = require('child_process');
const path = require('path');
try {
    // Get the directory of the currently running Node.js binary
    const nodeDir = path.dirname(process.execPath);
    const env = { ...process.env, PATH: `${nodeDir}:${process.env.PATH || ''}` };
    // Fix permissions on Prisma engine binaries
    execSync('chmod +x ./node_modules/.bin/prisma ./node_modules/@prisma/engines/* 2>/dev/null || true');
    const output = execSync('./node_modules/.bin/prisma db push --accept-data-loss 2>&1', { env }).toString();
    console.log('Database schema synced:', output);
} catch (err) {
    console.error('Schema sync failed:', err.stdout ? err.stdout.toString() : err.message);
}

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
        has_DATABASE_URL: !!process.env.DATABASE_URL,
        has_MONGODB_URI: !!process.env.MONGODB_URI,
        has_JWT_SECRET: !!process.env.JWT_SECRET,
        has_ERP_MIRROR_DB_URL: !!process.env.ERP_MIRROR_DB_URL,
        NODE_ENV: process.env.NODE_ENV,
        execPath: process.execPath,
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
