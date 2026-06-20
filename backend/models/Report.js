const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  reportedBy: String,
  targetUser: String,
  roomId: String,
  type: { 
    type: String, 
    enum: ['Report', 'Feedback', 'Alert'], 
    default: 'Report' 
  },
  description: String,
  status: { 
    type: String, 
    enum: ['Pending', 'Reviewed', 'Resolved'],
    default: 'Pending' 
  },
  starred: { type: Boolean, default: false },
  forwardedToDev: { type: Boolean, default: false },
  forwardedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Report", reportSchema);
