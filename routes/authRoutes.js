const express = require("express");

const router = express.Router();

const {
  register,
  login,
  getUsers,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

// Register
router.post("/register", register);

// Login
router.post("/login", login);

// Get All Users
router.get("/users", protect, getUsers);

// Profile
router.get("/profile", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Protected Route Accessed",
    user: req.user,
  });
});

module.exports = router;