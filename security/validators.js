const { body, param, query, validationResult } = require("express-validator");
const mongoose = require("mongoose");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    return res.status(400).json({
      success: false,
      message: messages.join(". "),
      errors: errors.array(),
    });
  }
  next();
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const registerValidator = [
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2, max: 50 }).withMessage("Name must be 2-50 characters")
    .matches(/^[a-zA-Z0-9\s\-'.]+$/).withMessage("Name contains invalid characters"),
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),
  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain an uppercase letter")
    .matches(/[0-9]/).withMessage("Password must contain a number")
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage("Password must contain a special character"),
  handleValidationErrors,
];

const loginValidator = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),
  body("password")
    .notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

const forgotPasswordValidator = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),
  handleValidationErrors,
];

const resetPasswordValidator = [
  param("token")
    .notEmpty().withMessage("Reset token is required")
    .isLength({ min: 32 }).withMessage("Invalid reset token"),
  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain an uppercase letter")
    .matches(/[0-9]/).withMessage("Password must contain a number")
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage("Password must contain a special character"),
  handleValidationErrors,
];

const updateProfileValidator = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage("Name must be 2-50 characters")
    .matches(/^[a-zA-Z0-9\s\-'.]+$/).withMessage("Name contains invalid characters"),
  body("bio")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Bio must be under 500 characters"),
  body("avatar")
    .optional()
    .isURL().withMessage("Avatar must be a valid URL"),
  body("settings")
    .optional()
    .isObject().withMessage("Settings must be an object"),
  body("settings.darkMode")
    .optional()
    .isBoolean().withMessage("darkMode must be boolean"),
  body("settings.notifications")
    .optional()
    .isBoolean().withMessage("notifications must be boolean"),
  body("settings.sound")
    .optional()
    .isBoolean().withMessage("sound must be boolean"),
  handleValidationErrors,
];

const updatePasswordValidator = [
  body("currentPassword")
    .notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain an uppercase letter")
    .matches(/[0-9]/).withMessage("Password must contain a number")
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage("Password must contain a special character"),
  handleValidationErrors,
];

const sendMessageValidator = [
  body("receiver")
    .optional()
    .custom((val) => !val || isValidObjectId(val)).withMessage("Invalid receiver ID"),
  body("chatId")
    .optional()
    .custom((val) => !val || isValidObjectId(val)).withMessage("Invalid chat ID"),
  body("text")
    .optional()
    .trim()
    .isLength({ max: 10000 }).withMessage("Message too long"),
  body("replyTo")
    .optional()
    .custom((val) => !val || isValidObjectId(val)).withMessage("Invalid replyTo ID"),
  body("attachments")
    .optional()
    .isArray().withMessage("Attachments must be an array"),
  body("attachments.*.url")
    .optional()
    .isURL().withMessage("Invalid attachment URL"),
  body("attachments.*.type")
    .optional()
    .isString().withMessage("Invalid attachment type"),
  handleValidationErrors,
];

const mongoIdParam = (name) =>
  param(name)
    .notEmpty().withMessage(`${name} is required`)
    .custom((val) => isValidObjectId(val)).withMessage(`Invalid ${name}`);

const messageIdParam = mongoIdParam("messageId");
const chatIdParam = mongoIdParam("chatId");
const userIdParam = mongoIdParam("id");

const reactToMessageValidator = [
  messageIdParam,
  body("emoji")
    .notEmpty().withMessage("Emoji is required")
    .isString().withMessage("Emoji must be a string")
    .isLength({ max: 10 }).withMessage("Invalid emoji"),
  handleValidationErrors,
];

const createChatValidator = [
  body("userId")
    .notEmpty().withMessage("User ID is required")
    .custom((val) => isValidObjectId(val)).withMessage("Invalid user ID"),
  handleValidationErrors,
];

const createGroupChatValidator = [
  body("name")
    .trim()
    .notEmpty().withMessage("Group name is required")
    .isLength({ min: 2, max: 50 }).withMessage("Group name must be 2-50 characters"),
  body("users")
    .isArray({ min: 2 }).withMessage("At least 2 users are required")
    .custom((val) => val.every((v) => isValidObjectId(v))).withMessage("Invalid user ID in users list"),
  handleValidationErrors,
];

const groupActionValidator = [
  body("chatId")
    .notEmpty().withMessage("Chat ID is required")
    .custom((val) => isValidObjectId(val)).withMessage("Invalid chat ID"),
  body("userId")
    .notEmpty().withMessage("User ID is required")
    .custom((val) => isValidObjectId(val)).withMessage("Invalid user ID"),
  handleValidationErrors,
];

const renameGroupValidator = [
  body("chatId")
    .notEmpty().withMessage("Chat ID is required")
    .custom((val) => isValidObjectId(val)).withMessage("Invalid chat ID"),
  body("chatName")
    .trim()
    .notEmpty().withMessage("Chat name is required")
    .isLength({ min: 2, max: 50 }).withMessage("Chat name must be 2-50 characters"),
  handleValidationErrors,
];

const paginationValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  handleValidationErrors,
];

const searchValidator = [
  query("q")
    .trim()
    .notEmpty().withMessage("Search query is required")
    .isLength({ max: 100 }).withMessage("Search query too long"),
  handleValidationErrors,
];

const adminSuspendValidator = [
  param("id")
    .notEmpty().withMessage("User ID is required")
    .custom((val) => isValidObjectId(val)).withMessage("Invalid user ID"),
  handleValidationErrors,
];

const adminDeleteValidator = [
  param("id")
    .notEmpty().withMessage("User ID is required")
    .custom((val) => isValidObjectId(val)).withMessage("Invalid user ID"),
  handleValidationErrors,
];

const markAsReadValidator = [
  body("chatId")
    .notEmpty().withMessage("Chat ID is required")
    .custom((val) => isValidObjectId(val)).withMessage("Invalid chat ID"),
  handleValidationErrors,
];

const editMessageValidator = [
  messageIdParam,
  body("text")
    .trim()
    .notEmpty().withMessage("Message text is required")
    .isLength({ max: 10000 }).withMessage("Message too long"),
  handleValidationErrors,
];

const refreshTokenValidator = [
  body("refreshToken")
    .notEmpty().withMessage("Refresh token is required"),
  handleValidationErrors,
];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  updateProfileValidator,
  updatePasswordValidator,
  sendMessageValidator,
  reactToMessageValidator,
  createChatValidator,
  createGroupChatValidator,
  groupActionValidator,
  renameGroupValidator,
  paginationValidator,
  searchValidator,
  adminSuspendValidator,
  adminDeleteValidator,
  markAsReadValidator,
  editMessageValidator,
  refreshTokenValidator,
  messageIdParam,
  chatIdParam,
  userIdParam,
  isValidObjectId,
};
