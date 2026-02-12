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

const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// DB Connections
// MySQL - Run schema sync at startup (Hostinger build env can't reach DB, only runtime can)
const { execSync } = require('child_process');
try {
    console.log('Syncing database schema...');
    execSync('./node_modules/.bin/prisma db push --accept-data-loss', { stdio: 'inherit' });
    console.log('Database schema synced successfully');
} catch (err) {
    console.error('Database schema sync failed (tables may already exist):', err.message);
}

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
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
