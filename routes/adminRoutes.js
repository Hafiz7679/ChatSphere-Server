const express = require("express");
const router = express.Router();
const {
  getStats, getUsers, getUserById,
  suspendUserHandler, deleteUserHandler,
  changeUserRole, resetUserPassword, verifyUserEmail, disableAccount,
  getOnlineUsers, getMessageStats,
  getAnalytics, getReports, getHealth, getSettings,
} = require("../controllers/adminController");
const { protectAdmin } = require("../middleware/authMiddleware");
const { paginationValidator } = require("../security/validators");

router.get("/stats", protectAdmin, getStats);
router.get("/users", protectAdmin, getUsers);
router.get("/users/online", protectAdmin, getOnlineUsers);
router.get("/users/:id", protectAdmin, getUserById);
router.put("/users/:id/suspend", protectAdmin, suspendUserHandler);
router.delete("/users/:id", protectAdmin, deleteUserHandler);
router.put("/users/:id/role", protectAdmin, changeUserRole);
router.put("/users/:id/reset-password", protectAdmin, resetUserPassword);
router.put("/users/:id/verify", protectAdmin, verifyUserEmail);
router.put("/users/:id/disable", protectAdmin, disableAccount);
router.get("/messages/stats", protectAdmin, getMessageStats);
router.get("/analytics", protectAdmin, getAnalytics);
router.get("/reports", protectAdmin, getReports);
router.get("/health", protectAdmin, getHealth);
router.get("/settings", protectAdmin, getSettings);

module.exports = router;
