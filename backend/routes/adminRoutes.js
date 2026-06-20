const express = require("express");
const router = express.Router();
const Report = require("../models/Report");
const User = require("../models/User");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.ADMIN_EMAIL,
    pass: process.env.ADMIN_EMAIL_PASS
  }
});

router.get("/reports", async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

router.put("/reports/:id/solve", async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: "Report solved and deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to solve report" });
  }
});

router.put("/reports/:id/star", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    report.starred = !report.starred;
    await report.save();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle star" });
  }
});

router.post("/reports/:id/forward", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: "valkare725@gmail.com",
      subject: `[Developer Forward] ${report.type} from ${report.reportedBy}`,
      html: `
        <h2>Forwarded Report/Feedback</h2>
        <p><strong>Type:</strong> ${report.type}</p>
        <p><strong>From:</strong> ${report.reportedBy || "Anonymous"}</p>
        ${report.targetUser ? `<p><strong>Target User:</strong> ${report.targetUser}</p>` : ""}
        ${report.roomId ? `<p><strong>Room:</strong> ${report.roomId}</p>` : ""}
        <p><strong>Description:</strong></p>
        <blockquote>${report.description}</blockquote>
        <p><strong>Reported at:</strong> ${report.createdAt}</p>
        <hr>
        <p><em>Forwarded by admin via CodeRush Admin Panel</em></p>
      `
    };

    await transporter.sendMail(mailOptions);

    report.forwardedToDev = true;
    report.forwardedAt = new Date();
    await report.save();

    res.json({ message: "Forwarded to developer", report });
  } catch (error) {
    res.status(500).json({ error: "Failed to forward report" });
  }
});

// ===== User Management (Suspend/Ban) =====

router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.put("/users/:id/suspend", async (req, res) => {
  try {
    const { days } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role === "admin") return res.status(403).json({ error: "Cannot suspend an admin" });

    user.suspended = true;
    if (days) {
      user.suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    } else {
      user.suspendedUntil = null;
    }
    await user.save();
    res.json({ message: `User suspended${days ? ` for ${days} day(s)` : ""}`, user });
  } catch (error) {
    res.status(500).json({ error: "Failed to suspend user" });
  }
});

router.put("/users/:id/unsuspend", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.suspended = false;
    user.suspendedUntil = null;
    await user.save();
    res.json({ message: "User unsuspended", user });
  } catch (error) {
    res.status(500).json({ error: "Failed to unsuspend user" });
  }
});

router.put("/users/:id/ban", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role === "admin") return res.status(403).json({ error: "Cannot ban an admin" });
    user.banned = true;
    user.suspended = false;
    user.suspendedUntil = null;
    await user.save();
    res.json({ message: "User banned permanently", user });
  } catch (error) {
    res.status(500).json({ error: "Failed to ban user" });
  }
});

router.put("/users/:id/unban", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.banned = false;
    await user.save();
    res.json({ message: "User unbanned", user });
  } catch (error) {
    res.status(500).json({ error: "Failed to unban user" });
  }
});

module.exports = router;
