const mongoose = require('mongoose');

const QPPPaperSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  subject: {
    type: String,
    default: '',
    trim: true,
  },
  unit: {
    type: String,
    default: '',
    trim: true,
  },
  title: {
    type: String,
    default: 'Question Paper',
    trim: true,
  },
  paper: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('QPPPaper', QPPPaperSchema);


