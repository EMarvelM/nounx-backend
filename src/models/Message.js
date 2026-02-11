const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  senderId: {
    type: String, // Maps to User.id in MySQL
    required: true,
    index: true
  },
  senderName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  roomType: {
    type: String, // 'FACULTY', 'DEPARTMENT', 'LEVEL', 'DM'
    required: true,
    enum: ['FACULTY', 'DEPARTMENT', 'LEVEL', 'DM'],
    index: true
  },
  roomId: {
    type: String, // id of faculty, department, level group, or DM combo
    required: true,
    index: true
  },
  attachments: [{
    type: String, // URL to attachment
    fileType: String
  }],
  isBot: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index for efficient room message fetching
MessageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
