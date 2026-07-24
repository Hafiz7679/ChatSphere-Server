const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@chatsphere.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123456";
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";

(async () => {
  try {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.log("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env for custom admin credentials.");
      console.log(`Using defaults: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}\n`);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    const User = require("../models/User");

    let user = await User.findOne({ email: ADMIN_EMAIL });

    if (user) {
      user.role = "admin";
      user.isVerified = true;
      await user.save();
      console.log(`Updated ${ADMIN_EMAIL} to admin`);
    } else {
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await User.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: "admin",
        isVerified: true,
      });
      console.log(`Created admin user: ${ADMIN_EMAIL}`);
    }

    await mongoose.disconnect();
    console.log("Done. Login at /admin/login");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
