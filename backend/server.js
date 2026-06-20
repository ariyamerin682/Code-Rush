const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch((err) => console.log("MongoDB Error ❌", err.message));

app.use("/api/problems", require("./routes/problemRoutes"));
app.use("/api/rooms", require("./routes/roomRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/moderators", require("./routes/moderatorRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

// Serve Frontend Static Files
const path = require("path");
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.redirect("/zoom%20(1).html");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});