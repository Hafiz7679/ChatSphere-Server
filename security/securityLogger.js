const fs = require("fs");
const path = require("path");

const SENSITIVE_PATTERNS = [
  /password/i, /secret/i, /token/i, /authorization/i, /api[_-]?key/i,
  /jwt[_-]?secret/i, /refresh[_-]?secret/i, /private[_-]?key/i,
  /mongodb(?:\+srv)?:\/\//i,
];

const containsSensitive = (data) => {
  if (typeof data === "string" && SENSITIVE_PATTERNS.some((p) => p.test(data))) {
    return true;
  }
  if (data && typeof data === "object") {
    for (const key of Object.keys(data)) {
      if (SENSITIVE_PATTERNS.some((p) => p.test(key))) return true;
    }
  }
  return false;
};

const redactSensitive = (data) => {
  if (typeof data === "string") return "[REDACTED]";
  if (data && typeof data === "object") {
    const redacted = {};
    for (const [key, val] of Object.entries(data)) {
      if (SENSITIVE_PATTERNS.some((p) => p.test(key))) {
        redacted[key] = "[REDACTED]";
      } else if (typeof val === "object" && val !== null) {
        redacted[key] = redactSensitive(val);
      } else {
        redacted[key] = val;
      }
    }
    return redacted;
  }
  return data;
};

const logDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logStream = fs.createWriteStream(path.join(logDir, "security.log"), { flags: "a" });

const securityLog = (event, details = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  };

  if (containsSensitive(entry)) {
    console.warn("[SECURITY-LOG] Attempted to log sensitive data - redacting");
  }

  const safe = redactSensitive(entry);
  const line = JSON.stringify(safe) + "\n";
  logStream.write(line);

  if (process.env.NODE_ENV !== "production") {
    console.log(`[SECURITY] ${event}`, JSON.stringify(redactSensitive({ ...details, ip: details.ip ? "[REDACTED]" : undefined })));
  }
};

module.exports = {
  securityLog,
  logLoginAttempt: (email, success, ip, reason) =>
    securityLog("LOGIN_ATTEMPT", { email, success, ip, reason }),
  logPasswordReset: (email, ip) =>
    securityLog("PASSWORD_RESET", { email, ip }),
  logPasswordResetComplete: (email, ip) =>
    securityLog("PASSWORD_RESET_COMPLETE", { email, ip }),
  logUploadActivity: (userId, fileName, fileSize, fileType, ip) =>
    securityLog("UPLOAD_ACTIVITY", { userId, fileName, fileSize, fileType, ip }),
  logInvalidToken: (tokenType, reason, ip) =>
    securityLog("INVALID_TOKEN", { tokenType, reason, ip }),
  logRateLimitEvent: (endpoint, ip, windowMs) =>
    securityLog("RATE_LIMIT", { endpoint, ip, windowMs }),
  logRegistration: (email, ip) =>
    securityLog("REGISTRATION", { email, ip }),
  logEmailVerification: (email, success, ip) =>
    securityLog("EMAIL_VERIFICATION", { email, success, ip }),
  logCsrfError: (ip, reason) =>
    securityLog("CSRF_ERROR", { ip, reason }),
  logSuspiciousActivity: (userId, action, details, ip) =>
    securityLog("SUSPICIOUS_ACTIVITY", { userId, action, details, ip }),
};
