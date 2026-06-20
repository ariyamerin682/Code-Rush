const mongoose = require("mongoose");
const Problem = require("./models/Problem");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const dummyProblems = [
    {
        title: "Two Sum",
        difficulty: "Easy",
        category: "Arrays",
        description: "Given an array of integers 'nums' and an integer 'target', return indices of the two numbers such that they add up to target. \n\nAssume that each input would have exactly one solution, and you may not use the same element twice. \n\nYou can return the answer in any order.",
        sampleInput: "[2,7,11,15]\n9",
        expectedOutput: "[0,1]"
    },
    {
        title: "Reverse String",
        difficulty: "Easy",
        category: "Strings",
        description: "Write a function that reverses a string. The input string is given as an array of characters 's'.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.",
        sampleInput: "['h','e','l','l','o']",
        expectedOutput: "['o','l','l','e','h']"
    },
    {
        title: "Hello World Loop",
        difficulty: "Easy",
        category: "Basics",
        description: "Write a program that prints 'Hello CodeRush!' exactly 3 times, each on a new line.",
        sampleInput: "",
        expectedOutput: "Hello CodeRush!\nHello CodeRush!\nHello CodeRush!"
    }
];

// Connect to MongoDB using your URI in .env, then seed problems
mongoose
    .connect(process.env.MONGO_URI)
    .then(async () => {
        console.log("Connected to DB, wiping old problems...");
        await Problem.deleteMany({});

        console.log("Seeding fresh problems...");
        await Problem.insertMany(dummyProblems);

        console.log("✅ Successfully seeded 3 problems!");
        process.exit();
    })
    .catch((err) => {
        console.error("DB Connection Error:", err);
        process.exit(1);
    });
