const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const auth = require('../middleware/auth');

router.get('/my-rooms', auth, roomController.getUserRooms);
router.get('/:roomId/messages', auth, roomController.getRoomMessages);

module.exports = router;
