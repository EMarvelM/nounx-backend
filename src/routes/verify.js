const express = require('express');
const router = express.Router();
const verifyController = require('../controllers/verifyController');

/**
 * @swagger
 * /api/verify/lookup-matric:
 *   post:
 *     summary: "Step 1A: Look up a student by matric number"
 *     description: Student enters their matric directly. Returns their name and programme for confirmation.
 *     tags: [Identity Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [matric]
 *             properties:
 *               matric:
 *                 type: string
 *                 example: "NOU233403330"
 *     responses:
 *       200:
 *         description: Student found
 *       404:
 *         description: Matric not found in NOUN records
 *       409:
 *         description: Matric already registered on NounX
 */
router.get('/centres', verifyController.getCentres);
router.post('/lookup-matric', verifyController.lookupMatric);

/**
 * @swagger
 * /api/verify/lookup-matric:

/**
 * @swagger
 * /api/verify/lookup-name:
 *   post:
 *     summary: "Step 1B: Search for students by name"
 *     description: Student enters their full name. Returns masked matric numbers so they can identify theirs without typing it.
 *     tags: [Identity Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *     responses:
 *       200:
 *         description: Matching students found with masked matric numbers
 *       404:
 *         description: No students found with that name
 */
router.post('/lookup-name', verifyController.lookupName);

/**
 * @swagger
 * /api/verify/confirm-identity:
 *   post:
 *     summary: "Step 2: Verify identity with study centre"
 *     description: Student provides their full matric number and answers the study centre challenge question.
 *     tags: [Identity Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [matric, studyCentre]
 *             properties:
 *               matric:
 *                 type: string
 *                 example: "NOU233403330"
 *               studyCentre:
 *                 type: string
 *                 example: "McCarthy Study Centre Lagos"
 *     responses:
 *       200:
 *         description: Identity verified. Returns a short-lived verification token.
 *       403:
 *         description: Study centre does not match records
 *       404:
 *         description: Matric not found
 */
router.post('/confirm-identity', verifyController.verifyIdentity);

/**
 * @swagger
 * /api/verify/complete-registration:
 *   post:
 *     summary: "Step 3: Complete registration after verification"
 *     description: Student creates their account using the verification token from Step 2.
 *     tags: [Identity Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password, verificationToken]
 *             properties:
 *               username:
 *                 type: string
 *                 example: "marvel_x"
 *               email:
 *                 type: string
 *                 example: "marvel@gmail.com"
 *               password:
 *                 type: string
 *                 example: "securepassword123"
 *               referralCode:
 *                 type: string
 *                 example: "agent_marvel"
 *               verificationToken:
 *                 type: string
 *                 description: "The token received from the confirm-identity step"
 *     responses:
 *       201:
 *         description: Account created successfully
 *       401:
 *         description: Verification token expired or invalid
 *       409:
 *         description: Matric, email, or username already taken
 */
router.post('/complete-registration', verifyController.completeRegistration);

module.exports = router;
