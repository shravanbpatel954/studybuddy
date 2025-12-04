const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  name: String,
  type: {
    type: String,
    enum: ['module', 'global', 'dm'],
    required: true
  },
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module'
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
