const express = require("express");
const router = express.Router();
const {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  updatePassword,
  getUsers,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  searchUsers,
} = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.post("/logout", protect, logout);
router.get("/users/search", protect, searchUsers);
router.get("/users", protect, getUsers);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/password", protect, updatePassword);
router.post("/refresh-token", refreshToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/verify-email/:token", verifyEmail);

module.exports = router;
