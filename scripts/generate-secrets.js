const crypto = require("crypto");

const jwtSecret = crypto.randomBytes(32).toString("hex");
const refreshSecret = crypto.randomBytes(32).toString("hex");
const csrfSecret = crypto.randomBytes(32).toString("hex");

console.log("\n=== CHATSPHERE SECRETS ===");
console.log("Add these to your .env file:\n");
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`JWT_REFRESH_SECRET=${refreshSecret}`);
console.log(`CSRF_SECRET=${csrfSecret}`);
console.log("\n=== VALIDATION ===");
console.log(`JWT_SECRET length: ${jwtSecret.length} chars (256 bits)`);
console.log(`JWT_REFRESH_SECRET length: ${refreshSecret.length} chars (256 bits)`);
console.log("Both secrets meet the minimum 256-bit requirement.\n");
