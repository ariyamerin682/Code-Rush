const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config();

async function seedAdmins() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const admins = [
    { username: "ariyamerin", email: "ariyamerin682@gmail.com", password: "adminpass1", role: "admin" },
    { username: "abrahamayir", email: "abrahamayir@gmail.com", password: "adminpass2", role: "admin" }
  ];

  for (const admin of admins) {
    const existing = await User.findOne({ email: admin.email });
    if (!existing) {
      await User.create(admin);
      console.log(`Admin created: ${admin.email}`);
    } else {
      console.log(`Admin already exists: ${admin.email}`);
    }
  }

  await mongoose.disconnect();
  console.log("Done");
}

seedAdmins().catch(err => { console.error(err); process.exit(1); });
