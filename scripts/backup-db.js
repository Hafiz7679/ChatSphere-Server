/**
 * ChatSphere Database Backup Script
 *
 * Usage:
 *   node scripts/backup-db.js                  # Backup to default dir
 *   node scripts/backup-db.js ./my-backups     # Custom backup directory
 *
 * Requires: MongoDB tools (mongodump) installed locally
 * Or: Set MONGODB_URI to use Mongoose streaming backup
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const backupDir = path.resolve(process.argv[2] || path.join(__dirname, "..", "backups"));
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(backupDir, `chatsphere-backup-${timestamp}`);

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not set in .env");
  process.exit(1);
}

console.log(`Backing up database to: ${outputDir}`);

try {
  execSync(
    `mongodump --uri="${uri}" --out="${outputDir}" --gzip`,
    { stdio: "inherit", timeout: 300000 }
  );
  console.log(`Backup complete: ${outputDir}`);

  // Keep only last 7 backups
  const backups = fs.readdirSync(backupDir)
    .filter((f) => f.startsWith("chatsphere-backup-"))
    .map((f) => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  if (backups.length > 7) {
    backups.slice(7).forEach((b) => {
      const fullPath = path.join(backupDir, b.name);
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`Removed old backup: ${b.name}`);
    });
  }
} catch (err) {
  console.error("Backup failed:", err.message);
  process.exit(1);
}
