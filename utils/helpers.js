const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const COMMON_PASSWORDS = new Set([
  "password", "password123", "password123!", "Password123", "Password123!",
  "Password1!", "password1!", "admin123", "admin123!", "Admin123!",
  "12345678", "123456789", "qwerty123", "qwerty123!", "Qwerty123!",
  "letmein", "welcome", "welcome123", "welcome123!",
  "monkey", "dragon", "master", "master123",
  "abc123", "abc123!", "passw0rd", "P@ssw0rd", "p@ssw0rd",
  "hello123", "Hello123!", "hello123!", "changeme", "summer2024",
  "winter2024", "spring2024", "autumn2024",
  "iloveyou", "iloveyou123", "trustno1", "sunshine",
  "11111111", "111111111", "00000000",
  "princess", "football", "baseball", "starwars",
]);

function sanitizeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

function stripHtmlTags(str) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "");
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$")) {
      delete obj[key];
    } else if (typeof obj[key] === "string") {
      obj[key] = stripHtmlTags(obj[key]);
    } else if (typeof obj[key] === "object") {
      sanitizeObject(obj[key]);
    }
  }
}

function generateToken(userId) {
  return jwt.sign(
    { id: userId, type: "access" },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
}

function generateRefreshToken(userId) {
  return jwt.sign(
    { id: userId, type: "refresh", jti: crypto.randomBytes(16).toString("hex") },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
}

function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;
  const [localPart, domain] = email.split("@");
  if (localPart.length > 64) return false;
  if (domain.length > 255) return false;
  return true;
}

function validatePassword(password) {
  const errors = [];
  if (!password || typeof password !== "string") {
    errors.push("Password is required");
    return errors;
  }
  if (password.length < 8) errors.push("Password must be at least 8 characters");
  if (password.length > 128) errors.push("Password must be under 128 characters");
  if (!/[A-Z]/.test(password)) errors.push("Password must contain at least 1 uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Password must contain at least 1 lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Password must contain at least 1 number");
  if (!/[!@#$%^&*(),.?":{}|<>~`_\-+=;'\[\]\\\/]/.test(password))
    errors.push("Password must contain at least 1 special character");
  if (/(.)\1{2,}/.test(password)) errors.push("Password contains too many repeated characters");
  if (/^[A-Za-z0-9!@#$%^&*(),.?":{}|<>]*$/.test(password) && password.length > 0) {
    const lower = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lower)) errors.push("This password is too common. Choose a stronger password");
  }
  return errors;
}

function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateCsrfSecret() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = {
  sanitizeHtml,
  stripHtmlTags,
  sanitizeObject,
  generateToken,
  generateRefreshToken,
  verifyToken,
  validateEmail,
  validatePassword,
  generateSecureToken,
  hashToken,
  generateCsrfSecret,
};
