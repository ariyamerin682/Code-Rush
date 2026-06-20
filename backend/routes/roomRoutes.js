const express = require("express");
const router = express.Router();
const axios = require("axios");
const Problem = require("../models/Problem");
const Room = require("../models/Room");

router.post("/submit", async (req, res) => {
  try {
    const { roomId, username, code, language } = req.body;

    const room = await Room.findOne({ roomId, isActive: true });
    if (!room) {
      return res.status(400).json({ message: "Room not active or not found" });
    }

    const problem = await Problem.findById(room.problemId);
    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    // JDoodle API Call
    const response = await axios.post("https://api.jdoodle.com/v1/execute", {
      clientId: process.env.JDOODLE_CLIENT_ID,
      clientSecret: process.env.JDOODLE_CLIENT_SECRET,
      script: code,
      language: language,
      versionIndex: "0",
      stdin: problem.sampleInput
    });

    // Provide safe fallbacks in case output or expectedOutput is undefined
    const output = response.data.output?.trim() || "";
    const expected = problem.expectedOutput?.trim() || "";

    // Record or update this player's submission
    const subIndex = room.submissions.findIndex(s => s.name === username);
    if (subIndex === -1) {
      room.submissions.push({ name: username, code: code, passed: (output === expected) });
    } else {
      room.submissions[subIndex].code = code;
      room.submissions[subIndex].passed = (output === expected);
    }

    if (output === expected) {
      if (!room.winner) {
        room.winner = username;
        // Optional: Keep room active so others can finish, or end now.
        // The user wants the match to end when a player submits correctly.
        room.isActive = false;
        setTimeout(async () => {
          try {
            // Reset room logic
            const r = await Room.findById(room._id);
            if (r) {
              r.matchStartTime = null;
              r.problemId = null;
              r.submissions = [];
              r.winner = null;
              r.surrenderedPlayers = [];
              r.players.forEach(p => p.ready = false);
              r.isActive = true;
              await r.save();
            }
          } catch (e) {}
        }, 20000); // Reset after 20s
        
        // Add points to the winning user based on difficulty
        let reward = 50; // Medium default
        if (room.difficulty === "Easy") reward = 10;
        else if (room.difficulty === "Hard") reward = 100;

        const User = require("../models/User");
        const userDoc = await User.findOne({ username });
        if (userDoc) {
          userDoc.score = (userDoc.score || 0) + reward;
          await userDoc.save();
        }
      }
    }

    // Check if ALL players have passed (if we didn't already end it)
    const allPassed = room.players.every(p => 
      room.submissions.find(s => s.name === p.name && s.passed)
    );

    if (allPassed && room.isActive) {
      room.isActive = false;
      setTimeout(async () => {
        try {
          // Reset room logic
          const r = await Room.findById(room._id);
          if (r) {
            r.matchStartTime = null;
            r.problemId = null;
            r.submissions = [];
            r.winner = null;
            r.surrenderedPlayers = [];
            r.players.forEach(p => p.ready = false);
            r.isActive = true;
            await r.save();
          }
        } catch (e) {}
      }, 20000); 
    }

    await room.save();

    if (output === expected) {
      return res.json({
        message: "Correct! Code submitted. Waiting for match to end...",
        winner: room.winner,
        output: output,
        allSubmitted: !room.isActive
      });
    }

    res.json({
      message: "Incorrect output. Try again or wait for time.",
      output,
      allSubmitted: !room.isActive
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all active rooms (auto-deletes empty ones)
router.get("/", async (req, res) => {
  try {
    await Room.deleteMany({ isActive: true, players: { $size: 0 } });
    const rooms = await Room.find({ isActive: true }).sort({ _id: -1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new room
router.post("/create", async (req, res) => {
  try {
    const { roomName, maxPlayers, difficulty, username } = req.body;

    // Check if room with same name exists and is active
    const existing = await Room.findOne({ roomId: roomName, isActive: true });
    if (existing) {
      return res.status(400).json({ status: "error", msg: "Room name already in use" });
    }

    let matchDuration = 15 * 60; // default medium (15 mins)
    if (difficulty === "Easy") matchDuration = 4 * 60; // 4 mins
    if (difficulty === "Hard") matchDuration = 25 * 60; // 25 mins

    const newRoom = await Room.create({
      roomId: roomName,
      host: username,
      maxPlayers: parseInt(maxPlayers) || 8,
      difficulty: difficulty || "Medium",
      matchDuration: matchDuration,
      players: username ? [{ name: username, ready: false }] : [],
      isActive: true
    });

    res.json({ status: "success", room: newRoom });
  } catch (err) {
    res.status(500).json({ status: "error", msg: err.message });
  }
});

// Join a room
router.post("/join", async (req, res) => {
  try {
    const { roomName, username } = req.body;

    let room = await Room.findOne({ roomId: roomName, isActive: true });
    if (!room) {
      return res.status(404).json({ status: "error", msg: "Room not found or no longer active" });
    }

    // Check if player is already inside
    const isInside = room.players.some(p => p.name === username);
    const isBanned = room.surrenderedPlayers?.includes(username);

    if (isBanned && room.isActive && room.matchStartTime) {
        // If match is active and they surrendered, keep them out
        return res.status(403).json({ status: "error", msg: "You surrendered this match. Wait for the next round." });
    }

    if (!isInside) {
      if (room.players.length >= (room.maxPlayers || 8)) {
        return res.status(400).json({ status: "error", msg: "Room is full" });
      }
      room.players.push({ name: username, ready: false });
      await room.save();
    }

    res.json({ status: "success", room });
  } catch (err) {
    res.status(500).json({ status: "error", msg: err.message });
  }
});

// Endpoint for polling match status and exact synchronized time
router.get("/status/:id", async (req, res) => {
  try {
    const roomId = req.params.id;
    // Find the room by ID/Name, prioritizing active ones and sorting by newest first
    let room = await Room.findOne({ roomId, isActive: true }) || await Room.findOne({ roomId }).sort({ _id: -1 });

    if (!room) return res.status(404).json({ error: "Room not found" });

    let timeRemaining = room.matchDuration;
    let isStarted = false;
    let gameOver = !room.isActive;

    if (room.matchStartTime) {
      isStarted = true;
      const now = new Date();
      const elapsedSeconds = Math.floor((now - new Date(room.matchStartTime)) / 1000);
      timeRemaining = Math.max(0, room.matchDuration - elapsedSeconds);

      if (timeRemaining <= 0) {
        gameOver = true;
        // Force close room if time ran out
        if (room.isActive) {
          room.isActive = false;
          setTimeout(async () => {
            try {
              const r = await Room.findById(room._id);
              if (r) {
                r.matchStartTime = null;
                r.problemId = null;
                r.submissions = [];
                r.winner = null;
                r.surrenderedPlayers = [];
                r.players.forEach(p => p.ready = false);
                r.isActive = true;
                await r.save();
              }
            } catch (e) {}
          }, 20000); // Reset after 20s
        }
      }
    }

    res.json({
      isStarted: isStarted,
      timeRemaining: timeRemaining,
      gameOver: gameOver,
      winner: room.winner,
      activePlayers: room.players.length,
      submissions: room.submissions.length
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get details of a single room
router.get("/room/:id", async (req, res) => {
  try {
    const roomId = req.params.id;
    // Find room prioritizing active ones, then newest
    let room = await Room.findOne({ roomId, isActive: true }) || await Room.findOne({ roomId }).sort({ _id: -1 });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle player readiness
router.post("/ready/:id", async (req, res) => {
  try {
    const roomId = req.params.id;
    const { username } = req.body;

    let room = await Room.findOne({ roomId, isActive: true });
    if (!room) return res.status(404).json({ error: "Room not found" });

    // Find requested user and toggle their ready boolean
    const playerIndex = room.players.findIndex(p => p.name === username);
    if (playerIndex !== -1) {
      room.players[playerIndex].ready = !room.players[playerIndex].ready;
      await room.save();
    }

    res.json({ status: "success", room });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leave room
router.post("/leave/:id", async (req, res) => {
  try {
    const roomId = req.params.id;
    const { username } = req.body;

    let room = await Room.findOne({ roomId, isActive: true });
    if (!room) return res.status(404).json({ error: "Room not found" });

    const wasHost = room.host === username;
    const matchInProgress = room.matchStartTime && room.isActive;

    room.players = room.players.filter(p => p.name !== username);

    if (matchInProgress) {
      if (!room.surrenderedPlayers.includes(username)) {
        room.surrenderedPlayers.push(username);
      }
    }

    // Auto-close room if empty
    if (room.players.length === 0) {
      await Room.deleteOne({ _id: room._id });
      return res.json({ status: "success", room: null });
    }

    // If host leaves, transfer to next player
    if (wasHost && room.players.length > 0) {
      room.host = room.players[0].name;
    }

    await room.save();
    res.json({ status: "success", room });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Surrender endpoint
router.post("/surrender/:id", async (req, res) => {
  try {
    const roomId = req.params.id;
    const { username } = req.body;

    let room = await Room.findOne({ roomId, isActive: true });
    if (!room) return res.status(404).json({ error: "Room not found" });

    // Remove from players
    room.players = room.players.filter(p => p.name !== username);
    
    // Add to surrendered
    if (!room.surrenderedPlayers.includes(username)) {
      room.surrenderedPlayers.push(username);
    }

    // If room empty, delete
    if (room.players.length === 0) {
      await Room.deleteOne({ _id: room._id });
      return res.json({ status: "success", room: null });
    }

    // Transfer host if needed
    if (room.host === username) {
      room.host = room.players[0].name;
    }

    await room.save();
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple in-memory chat (for now)
const roomChats = {};

router.post("/send_message/:id", (req, res) => {
  const roomId = req.params.id;
  const { user, message } = req.body;

  if (!roomChats[roomId]) roomChats[roomId] = [];
  roomChats[roomId].push({ user, msg: message });

  // Keep only last 50 messages
  if (roomChats[roomId].length > 50) roomChats[roomId].shift();

  res.json({ status: "success" });
});

router.get("/get_messages/:id", (req, res) => {
  const roomId = req.params.id;
  res.json(roomChats[roomId] || []);
});

// Start game: Pick a random problem and formalize start time
router.post("/start/:id", async (req, res) => {
  try {
    const roomId = req.params.id;
    const { username } = req.body;
    let room = await Room.findOne({ roomId, isActive: true });

    if (!room) return res.status(404).json({ error: "Room not found" });

    if (room.host && room.host !== username) {
      return res.status(403).json({ error: "Only the host can start the match." });
    }

    const minPlayersRequired = 1; // Allow starting with 1 player for solo testing/practice
    if (room.players.length < minPlayersRequired) {
      return res.status(400).json({ error: `At least ${minPlayersRequired} players required to start.` });
    }

    const allOthersReady = room.players.every(p => p.name === room.host || p.ready);
    if (!allOthersReady) {
      return res.status(400).json({ error: "All players must be ready to start." });
    }

    if (!room.matchStartTime) {
      // Set the match start time strictly here
      room.matchStartTime = new Date();
    }

    if (!room.problemId) {
      // Pick random problem matching difficulty
      const requestedDifficulty = room.difficulty || "Medium";
      let count = await Problem.countDocuments();

      // Seed problems if DB is empty
      if (count === 0) {
        await Problem.insertMany([
          {
            title: "Two Sum",
            difficulty: "Easy",
            category: "Arrays",
            description: "Given an array of integers 'nums' and an integer 'target', return indices of the two numbers such that they add up to target. \n\nAssume that each input would have exactly one solution, and you may not use the same element twice.",
            sampleInput: "[2,7,11,15]\n9",
            expectedOutput: "[0,1]"
          },
          {
            title: "Longest Substring Without Repeating Characters",
            difficulty: "Medium",
            category: "Strings",
            description: "Given a string s, find the length of the longest substring without repeating characters.",
            sampleInput: "abcabcbb",
            expectedOutput: "3"
          },
          {
            title: "Median of Two Sorted Arrays",
            difficulty: "Hard",
            category: "Arrays",
            description: "Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.",
            sampleInput: "[1,3]\n[2]",
            expectedOutput: "2"
          }
        ]);
        count = await Problem.countDocuments();
      }

      if (count > 0) {
        let diffCount = await Problem.countDocuments({ difficulty: requestedDifficulty });
        let problemQuery = { difficulty: requestedDifficulty };
        
        // Fallback if no problem of that difficulty exists yet
        if (diffCount === 0) {
          problemQuery = {};
          diffCount = count;
        }

        const random = Math.floor(Math.random() * diffCount);
        const problems = await Problem.find(problemQuery).skip(random).limit(1);
        if (problems && problems.length > 0) {
          room.problemId = problems[0]._id;
        } else {
          // Final fallback
          const anyProblem = await Problem.findOne();
          room.problemId = anyProblem._id;
        }
      } else {
        return res.status(400).json({ error: "No problems exist in DB. Need to seed problems first." });
      }
    }

    await room.save();
    res.json({ status: "success", room });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
