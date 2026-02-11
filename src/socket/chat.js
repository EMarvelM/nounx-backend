const Message = require('../models/Message');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        socket.on('join_room', (roomId) => {
            socket.join(roomId);
            console.log(`User ${socket.id} joined room ${roomId}`);
        });

        socket.on('send_message', async (data) => {
            const { senderId, senderName, content, roomType, roomId } = data;

            try {
                // Referral/Privacy Logic for DMs
                if (roomType === 'DM') {
                    const studentId = roomId.split('-').find(id => id !== senderId);
                    const student = await prisma.user.findUnique({ where: { id: studentId } });
                    const sender = await prisma.user.findUnique({ where: { id: senderId } });

                    if (sender.role === 'AGENT' && student.referrerId && student.referrerId !== senderId) {
                        // Check if student has messaged this agent before
                        const previousInteraction = await Message.findOne({
                            roomId,
                            senderId: studentId
                        });

                        if (!previousInteraction) {
                            return socket.emit('error', { message: 'You are not allowed to DM this student first (Linked to another agent)' });
                        }
                    }
                }

                // Save to MongoDB
                const newMessage = new Message({
                    senderId,
                    senderName,
                    content,
                    roomType,
                    roomId
                });

                await newMessage.save();

                // Emit to room
                io.to(roomId).emit('new_message', newMessage);

            } catch (err) {
                console.error('Socket error:', err);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected');
        });
    });
};
