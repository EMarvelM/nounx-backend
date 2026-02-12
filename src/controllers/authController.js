const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.register = async (req, res) => {
    try {
        const { username, name, email, password, role, facultyId, departmentId, level, referralCode } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { username }] }
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User with this email or username already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Referral logic
        let referrerId = null;
        if (referralCode) {
            const agent = await prisma.user.findUnique({
                where: { username: referralCode }
            });
            if (agent && agent.role === 'AGENT') {
                referrerId = agent.id;
            }
        }

        // Create user
        const user = await prisma.user.create({
            data: {
                username,
                name,
                email,
                password: hashedPassword,
                role: 'STUDENT', // Default all public registrations to STUDENT
                facultyId,
                departmentId,
                level: level ? parseInt(level) : null,
                referrerId
            }
        });

        // Generate token
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                referrerId: user.referrerId
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        if (user.status === 'SUSPENDED') {
            return res.status(403).json({ message: 'Your account has been suspended' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                facultyId: user.facultyId,
                departmentId: user.departmentId,
                level: user.level
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error during login' });
    }
};
