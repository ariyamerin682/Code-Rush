const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const User = require("../models/User");
const Report = require("../models/Report");

// ==========================================
// 1. Review Submissions, Leaderboard, Scores
// ==========================================

// Get global leaderboard (Users sorted by score)
router.get("/leaderboard", async (req, res) => {
  try {
    const leaderboard = await User.find({ role: { $ne: 'admin' } }).sort({ score: -1 }).select("username score").limit(50);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// Get all submissions across active or archived rooms
router.get("/submissions", async (req, res) => {
  try {
    const rooms = await Room.find({ "submissions.0": { $exists: true } }).select("roomId submissions");
    let allSubmissions = [];
    rooms.forEach(room => {
      room.submissions.forEach(sub => {
        allSubmissions.push({ roomId: room.roomId, ...sub.toObject() });
      });
    });
    res.json(allSubmissions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

// ==========================================
// 2. Manage Rooms
// ==========================================

// View all rooms
router.get("/rooms", async (req, res) => {
  try {
    const rooms = await Room.find().sort({ matchStartTime: -1 });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// Force End / Delete a room
router.delete("/rooms/:id", async (req, res) => {
  try {
    await Room.findByIdAndDelete(req.params.id);
    res.json({ message: "Room removed successfully by moderator" });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove room" });
  }
});

// ==========================================
// 3. View Reports, Feedbacks, Alerts
// ==========================================

// Get all incoming moderator alerts, reports, and feedbacks
router.get("/reports", async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// Create a new report or feedback
router.post("/reports", async (req, res) => {
  try {
    const { reportedBy, targetUser, roomId, type, description } = req.body;
    
    if (!description || !type) {
      return res.status(400).json({ status: "error", msg: "Type and description are required" });
    }

    const newReport = await Report.create({
      reportedBy: reportedBy || "Anonymous",
      targetUser,
      roomId,
      type,
      description
    });

    res.json({ status: "success", report: newReport });
  } catch (error) {
    res.status(500).json({ status: "error", msg: "Failed to submit report/feedback" });
  }
});

// Update report status
router.put("/reports/:id", async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(
      req.params.id, 
      { status: req.body.status },
      { new: true }
    );
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: "Failed to update report status" });
  }
});

module.exports = router;
