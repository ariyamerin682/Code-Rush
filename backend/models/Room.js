const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomId: String,
  host: String, // Tracks the creator of the room
  players: [{
    name: String,
    ready: { type: Boolean, default: false }
  }],
  maxPlayers: { type: Number, default: 8 },
  difficulty: { type: String, default: "Medium" },
  problemId: String,
  matchStartTime: { type: Date, default: null }, // Formal start time
  matchDuration: { type: Number, default: 15 * 60 }, // 15 minutes by default
  submissions: [{ // Track players who have submitted code
    name: String,
    code: String,
    passed: Boolean
  }],
  winner: String,
  surrenderedPlayers: [String], // Players who left mid-match
  isActive: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model("Room", roomSchema);