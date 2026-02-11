const { PrismaClient } = require('@prisma/client');
const Message = require('../models/Message');
const prisma = new PrismaClient();

exports.getUserRooms = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        let rooms = [];

        // All users see their faculty/dept if assigned
        if (user.role === 'AGENT' || user.role === 'ADMIN') {
            // Agents see EVERYTHING
            const faculties = await prisma.faculty.findMany({
                include: { departments: true }
            });

            faculties.forEach(f => {
                rooms.push({ id: f.id, name: f.name, type: 'FACULTY' });
                f.departments.forEach(d => {
                    rooms.push({ id: d.id, name: d.name, type: 'DEPARTMENT', facultyName: f.name });
                    // Add levels for agents too
                    [100, 200, 300, 400, 500].forEach(l => {
                        rooms.push({ id: `${d.id}-${l}`, name: `${d.name} ${l}L`, type: 'LEVEL', departmentId: d.id, level: l });
                    });
                });
            });
        } else {
            // Students see only their specific silos
            if (user.facultyId) {
                const faculty = await prisma.faculty.findUnique({ where: { id: user.facultyId } });
                if (faculty) rooms.push({ id: faculty.id, name: faculty.name, type: 'FACULTY' });
            }

            if (user.departmentId) {
                const dept = await prisma.department.findUnique({ where: { id: user.departmentId } });
                if (dept) {
                    rooms.push({ id: dept.id, name: dept.name, type: 'DEPARTMENT' });
                    if (user.level) {
                        rooms.push({ id: `${dept.id}-${user.level}`, name: `${dept.name} ${user.level}L`, type: 'LEVEL', level: user.level });
                    }
                }
            }
        }

        res.json(rooms);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching rooms' });
    }
};

exports.getRoomMessages = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { limit = 50, before } = req.query;

        const query = { roomId };
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json(messages.reverse());
    } catch (err) {
        res.status(500).json({ message: 'Error fetching messages' });
    }
};
