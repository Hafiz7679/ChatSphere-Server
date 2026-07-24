const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require("../models/User");

    const email = "abdulhafizsk8927@gmail.com";
    let user = await User.findOne({ email });

    if (user) {
      user.role = "admin";
      user.isVerified = true;
      await user.save();
      console.log(`Updated ${email} to admin`);
    } else {
      const hashedPassword = await bcrypt.hash("Hafiz@8927504374", 12);
      await User.create({
        name: "Admin Hafiz",
        email,
        password: hashedPassword,
        role: "admin",
        isVerified: true,
      });
      console.log(`Created admin user: ${email}`);
    }

    await mongoose.disconnect();
    console.log("Done. Login at /admin/login");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
