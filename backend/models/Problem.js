const mongoose = require("mongoose");

const problemSchema = new mongoose.Schema({
  title: String,
  difficulty: String,
  category: String,
  description: String,
  sampleInput: String,
  sampleOutput: String,
  expectedOutput: String,
  timeLimit: Number
});

module.exports = mongoose.model("Problem", problemSchema);