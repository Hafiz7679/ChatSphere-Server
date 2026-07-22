const express = require("express");
const router = express.Router();
const {
  getStats,
  getUsers,
  suspendUser,
  deleteUser,
  getHealth,
} = require("../controllers/adminController");
const { protectAdmin } = require("../middleware/authMiddleware");

router.get("/stats", protectAdmin, getStats);
router.get("/users", protectAdmin, getUsers);
router.put("/users/:id/suspend", protectAdmin, suspendUser);
router.delete("/users/:id", protectAdmin, deleteUser);
router.get("/health", protectAdmin, getHealth);

module.exports = router;
