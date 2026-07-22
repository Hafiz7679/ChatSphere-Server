const MIN_SECRET_LENGTH = 32;

const checks = [];

function check(name, condition, severity, fix) {
  checks.push({ name, passed: !!condition, severity, fix });
}

function validateEnv() {
  check(
    "JWT_SECRET strength",
    process.env.JWT_SECRET && process.env.JWT_SECRET.length >= MIN_SECRET_LENGTH && process.env.JWT_SECRET !== "mysecretkey123",
    "CRITICAL",
    "Run `node scripts/generate-secrets.js` and add JWT_SECRET to .env"
  );

  check(
    "JWT_REFRESH_SECRET strength",
    process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length >= MIN_SECRET_LENGTH && process.env.JWT_REFRESH_SECRET !== "myrefreshsecret456",
    "CRITICAL",
    "Run `node scripts/generate-secrets.js` and add JWT_REFRESH_SECRET to .env"
  );

  check(
    "NODE_ENV configured",
    process.env.NODE_ENV === "production" || process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
    "MEDIUM",
    "Set NODE_ENV to 'production', 'development', or 'test' in .env"
  );

  check(
    "CLIENT_URL configured",
    !!process.env.CLIENT_URL,
    "HIGH",
    "Set CLIENT_URL to your frontend URL (e.g., http://localhost:3000)"
  );

  check(
    "MONGODB_URI configured",
    !!process.env.MONGODB_URI,
    "CRITICAL",
    "Set MONGODB_URI to your MongoDB connection string"
  );

  check(
    "Email provider configured (production)",
    process.env.NODE_ENV !== "production" || !!process.env.RESEND_API_KEY || !!process.env.SENDGRID_API_KEY || !!process.env.SMTP_HOST,
    "HIGH",
    "Configure RESEND_API_KEY, SENDGRID_API_KEY, or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS for production email"
  );

  check(
    "Cloudinary configured (production)",
    process.env.NODE_ENV !== "production" || !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
    "HIGH",
    "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET for file uploads"
  );

  check(
    "HTTPS enforcement (production)",
    process.env.NODE_ENV !== "production" || process.env.HTTPS === "true",
    "MEDIUM",
    "Set HTTPS=true in .env for production. Configure SSL certificates."
  );

  console.log("\n=== ENVIRONMENT VALIDATION ===\n");
  let critical = 0, high = 0, medium = 0;

  for (const c of checks) {
    const icon = c.passed ? "✓" : "✗";
    const sev = c.severity.padEnd(8);
    if (!c.passed) {
      if (c.severity === "CRITICAL") critical++;
      else if (c.severity === "HIGH") high++;
      else medium++;
    }
    console.log(` ${icon} [${sev}] ${c.name}`);
    if (!c.passed) console.log(`     Fix: ${c.fix}`);
  }

  console.log(`\n${critical + high + medium} issues found (${critical} critical, ${high} high, ${medium} medium)`);

  if (critical > 0 || high > 0) {
    console.log("\n⚠️  Resolve critical and high-priority issues before deploying to production.\n");
    return false;
  }

  console.log("✓ Environment is configured correctly.\n");
  return true;
}

if (require.main === module) {
  validateEnv();
}

module.exports = { validateEnv };
