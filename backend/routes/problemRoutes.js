const express = require("express");
const router = express.Router();
const Problem = require("../models/Problem");

// Create Problem
router.post("/create", async (req, res) => {
  try {
    const problem = await Problem.create(req.body);
    res.json(problem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Random Problem
router.get("/random", async (req, res) => {
  try {
    const count = await Problem.countDocuments();
    if (count === 0) {
      return res.status(404).json({ message: "No problems found in database" });
    }
    const random = Math.floor(Math.random() * count);
    const problem = await Problem.findOne().skip(random);
    res.json(problem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Problem By ID
router.get("/:id", async (req, res) => {
  try {
    const problem = await Problem.findById(req.params.id);
    if (!problem) return res.status(404).json({ message: "Problem not found" });
    res.json(problem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;