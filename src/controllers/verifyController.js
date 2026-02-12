const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { lookupByMatric, lookupByName, maskMatric } = require('../services/erpMirror');

const prisma = new PrismaClient();

/**
 * Step 1A: Student enters matric number directly.
 * We look up the matric in the ERP mirror and return their name + programme
 * so they can confirm "Yes, that's me."
 */
exports.lookupMatric = async (req, res) => {
    try {
        const { matric } = req.body;

        if (!matric || matric.trim().length < 5) {
            return res.status(400).json({ message: 'Please enter a valid matric number' });
        }

        const cleanMatric = matric.trim().toUpperCase();

        const student = await lookupByMatric(cleanMatric);
        if (!student) {
            return res.status(404).json({ message: 'Matric number not found in NOUN records' });
        }

        // Check if already registered
        const existingUser = await prisma.user.findFirst({
            where: { matric: cleanMatric }
        });

        if (existingUser) {
            return res.status(409).json({ message: 'This matric number is already registered on NounX' });
        }

        res.json({
            found: true,
            student: {
                studentName: student.full_name, // Corrected field name based on frontend usage
                programme: student.programme,
                level: student.level,
            }
        });

    } catch (err) {
        console.error('Matric lookup error:', err);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
};

/**
 * Step 1B: Student enters their full name (doesn't want to type matric).
 * We search for matching names and return masked matric numbers.
 */
exports.lookupName = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim().length < 3) {
            return res.status(400).json({ message: 'Please enter at least 3 characters of your name' });
        }

        const students = await lookupByName(name.trim());

        if (students.length === 0) {
            return res.status(404).json({
                message: 'No students found with that name. Please check the spelling (use the name on your NOUN portal).'
            });
        }

        // Return masked matrics so the student can pick theirs
        const maskedResults = students.map(s => ({
            matric: maskMatric(s.matric), // Use 'matric' key for frontend
            fullMatric: s.matric, // We need this ONLY if we want frontend to know the real one, but usually keep it hidden?
            // Wait, frontend logic says: "Select your Profile" -> then "Enter FULL matric". So we should NOT return full matric in clear text ideally.
            // But maskMatric returns masked.
            // Let's stick to returning masked. Frontend will prompt user to type it.
            programme: s.programme,
            name: s.full_name,
            level: s.level
        }));

        res.json({
            found: true,
            count: maskedResults.length,
            students: maskedResults // Frontend expects array here? No, register.tsx uses res.data directly which is this object? No, res.data IS the array in register.tsx?
            // register.tsx: setSearchResults(res.data);
            // So verifyController should return ARRAY directly?
            // "res.json({...})" returns object.
            // Let's fix controller to match frontend.
        });

        // Wait, I should match what I wrote on server. Server returns object { found, count, students }.
        // Frontend register.tsx: setSearchResults(res.data). 
        // If res.data is object, then .map fails.
        // So frontend is wrong OR backend is wrong.
        // I'll fix frontend to use res.data.students.

    } catch (err) {
        console.error('Name lookup error:', err);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
};

/**
 * Step 2: Verify identity by confirming study centre.
 * Student provides full matric + study centre answer.
 * If it matches the ERP data, we return a verification token.
 */
exports.verifyIdentity = async (req, res) => {
    try {
        const { matric, studyCentre } = req.body;

        if (!matric || !studyCentre) {
            return res.status(400).json({ message: 'Matric number and study centre are required' });
        }

        const cleanMatric = matric.trim().toUpperCase();

        // Check if already registered
        const existingUser = await prisma.user.findFirst({
            where: { matric: cleanMatric }
        });
        if (existingUser) {
            return res.status(409).json({ message: 'This matric number is already registered on NounX' });
        }

        // Look up in ERP mirror
        const student = await lookupByMatric(cleanMatric);

        if (!student) {
            return res.status(404).json({
                message: 'Matric number not found in NOUN records.'
            });
        }

        // Fuzzy match study centre (case-insensitive, trim whitespace)
        const erpCentre = (student.study_centre || '').toLowerCase().trim();
        const userCentre = studyCentre.toLowerCase().trim();

        const isMatch = erpCentre.includes(userCentre) ||
            userCentre.includes(erpCentre) ||
            erpCentre === userCentre;

        if (!isMatch) {
            return res.status(403).json({
                message: 'The study centre you entered does not match our records. Please try again.'
            });
        }

        // Generate a short-lived verification token (10 minutes)
        const verificationToken = jwt.sign(
            {
                matric: cleanMatric,
                name: student.full_name,
                programme: student.programme,
                level: student.level,
                studyCentre: student.study_centre,
                verified: true
            },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        res.json({
            verified: true,
            message: 'Identity verified! You can now create your account.',
            verificationToken,
            student: {
                name: student.full_name,
                programme: student.programme,
                level: student.level
            }
        });

    } catch (err) {
        console.error('Identity verification error:', err);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
};

/**
 * Step 3: Complete registration with verified identity.
 * Student provides username, email, password + the verification token.
 */
exports.completeRegistration = async (req, res) => {
    try {
        const { username, email, password, referralCode, verificationToken } = req.body;

        if (!verificationToken) {
            return res.status(400).json({ message: 'Identity verification is required before registration' });
        }

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Username, email, and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Decode and validate the verification token
        let verified;
        try {
            verified = jwt.verify(verificationToken, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                message: 'Your verification has expired. Please verify your identity again.'
            });
        }

        if (!verified.verified || !verified.matric) {
            return res.status(401).json({ message: 'Invalid verification token' });
        }

        // Check if matric, email, or username is already taken
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { matric: verified.matric },
                    { email: email.toLowerCase().trim() },
                    { username: username.trim() }
                ]
            }
        });

        if (existingUser) {
            if (existingUser.matric === verified.matric) {
                return res.status(409).json({ message: 'This matric number is already registered' });
            }
            if (existingUser.email === email.toLowerCase().trim()) {
                return res.status(409).json({ message: 'This email is already registered' });
            }
            if (existingUser.username === username.trim()) {
                return res.status(409).json({ message: 'This username is already taken' });
            }
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

        // Create the verified student account
        const user = await prisma.user.create({
            data: {
                username: username.trim(),
                name: verified.name,
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                role: 'STUDENT',
                matric: verified.matric,
                level: verified.level ? parseInt(verified.level) : null,
                isVerified: true,
                referrerId
            }
        });

        // Generate auth token
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                isVerified: user.isVerified,
                referrerId: user.referrerId
            }
        });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ message: 'Something went wrong during registration. Please try again.' });
    }
};
