const express = require("express");
const router = express.Router();
const {
  register, login, adminLogin, logout, getProfile, updateProfile,
  updatePassword, getUsers, refreshToken, forgotPassword,
  resetPassword, verifyEmail, searchUsers, resendVerification,
} = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");
const {
  registerValidator, loginValidator, forgotPasswordValidator,
  resetPasswordValidator, updateProfileValidator,
  updatePasswordValidator, searchValidator, paginationValidator,
  refreshTokenValidator,
} = require("../security/validators");

router.post("/register", registerValidator, register);
router.post("/login", loginValidator, login);
router.post("/admin-login", loginValidator, adminLogin);
router.post("/logout", protect, logout);
router.get("/users/search", protect, searchValidator, searchUsers);
router.get("/users", protect, paginationValidator, getUsers);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfileValidator, updateProfile);
router.put("/password", protect, updatePasswordValidator, updatePassword);
router.post("/refresh-token", refreshTokenValidator, refreshToken);
router.post("/forgot-password", forgotPasswordValidator, forgotPassword);
router.post("/reset-password/:token", resetPasswordValidator, resetPassword);
router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", forgotPasswordValidator, resendVerification);

module.exports = router;
