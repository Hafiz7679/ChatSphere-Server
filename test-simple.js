require("dotenv").config();
const mongoose = require("mongoose");

async function test() {
  try {
    console.log("MongoDB URI:", process.env.MONGODB_URI?.substring(0, 60) + "...");
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    console.log("✓ Connected to MongoDB!");
    console.log("✓ Collections:", await mongoose.connection.db.collections());
    await mongoose.connection.db.dropDatabase();
    console.log("✓ Test database dropped.");
    await mongoose.disconnect();
    console.log("✓ Disconnected.");
  } catch (err) {
    console.error("✗ Connection failed:", err.message);
  }
}
test();