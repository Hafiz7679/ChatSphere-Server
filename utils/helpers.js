const jwt = require("jsonwebtoken");

function sanitizeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "");
}

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function generateRefreshToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET || "refresh-secret-key", {
    expiresIn: "30d",
  });
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push("Password must be at least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("Password must contain at least 1 uppercase letter");
  if (!/[0-9]/.test(password)) errors.push("Password must contain at least 1 number");
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push("Password must contain at least 1 special character");
  return errors;
}

module.exports = {
  sanitizeHtml,
  generateToken,
  generateRefreshToken,
  validateEmail,
  validatePassword,
};
