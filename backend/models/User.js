const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  score: {
    type: Number,
    default: 0
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  suspended: { type: Boolean, default: false },
  suspendedUntil: { type: Date, default: null },
  banned: { type: Boolean, default: false },
  roomId: String
});

module.exports = mongoose.model("User", userSchema);