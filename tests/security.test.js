const { validatePassword, validateEmail, sanitizeHtml, stripHtmlTags, generateToken, generateRefreshToken, hashToken, generateSecureToken } = require("../utils/helpers");
const { registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator, updatePasswordValidator } = require("../security/validators");

let passed = 0;
let failed = 0;
const tests = [];

function assert(condition, name, details = "") {
  if (condition) {
    passed++;
    tests.push(`  PASS: ${name}`);
  } else {
    failed++;
    tests.push(`  FAIL: ${name}${details ? ` - ${details}` : ""}`);
  }
}

function assertRejects(fn, expectedMsg, name) {
  return Promise.resolve().then(async () => {
    try {
      await fn();
      failed++;
      tests.push(`  FAIL: ${name} - expected rejection but was accepted`);
    } catch (err) {
      if (expectedMsg && err.message && err.message.includes(expectedMsg)) {
        passed++;
        tests.push(`  PASS: ${name}`);
      } else {
        failed++;
        tests.push(`  FAIL: ${name} - expected "${expectedMsg}" got "${err.message}"`);
      }
    }
  });
}

async function runTests() {
  console.log("\n=== PASSWORD VALIDATION TESTS ===\n");

  // Password validation
  assert(validatePassword("").length > 0, "Empty password rejected");
  assert(validatePassword("short1A!").length === 0, "Valid password accepted (short1A!)");
  assert(validatePassword("abcdefgh").length > 0, "No uppercase rejected");
  assert(validatePassword("ABCDEFGH").length > 0, "No lowercase rejected");
  assert(validatePassword("NoNumber!").length > 0, "No number rejected");
  assert(validatePassword("NoSpecial1").length > 0, "No special char rejected");
  assert(validatePassword("Ab1!").length > 0, "Too short rejected");
  assert(validatePassword("a".repeat(200)).length > 0, "Too long rejected");
  assert(validatePassword("Valid1@Pass").length === 0, "Strong password accepted");
  assert(validatePassword("Password1!").length > 0, "Common password rejected (Password1!)");

  console.log("\n=== EMAIL VALIDATION TESTS ===\n");

  assert(validateEmail("test@example.com"), "Valid email accepted");
  assert(!validateEmail("notanemail"), "Invalid email rejected");
  assert(!validateEmail(""), "Empty email rejected");
  assert(!validateEmail("@domain.com"), "No local part rejected");

  console.log("\n=== HTML SANITIZATION TESTS ===\n");

  assert(sanitizeHtml("<script>alert('xss')</script>") === "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;", "Script tag escaped");
  assert(sanitizeHtml("<img src=x onerror=alert(1)>") === "&lt;img src=x onerror=alert(1)&gt;", "Img onerror escaped");
  assert(sanitizeHtml("") === "", "Empty string handled");
  assert(sanitizeHtml(null) === "", "Null handled");
  assert(sanitizeHtml(123) === "", "Non-string handled");
  assert(stripHtmlTags("<b>bold</b>") === "bold", "HTML tags stripped");
  assert(stripHtmlTags("<script>alert(1)</script>") === "alert(1)", "Script stripped");

  console.log("\n=== TOKEN GENERATION TESTS ===\n");

  const token = generateToken("507f1f77bcf86cd799439011");
  assert(typeof token === "string" && token.split(".").length === 3, "JWT token generated with 3 parts");

  const refreshToken = generateRefreshToken("507f1f77bcf86cd799439011");
  assert(typeof refreshToken === "string" && refreshToken.split(".").length === 3, "Refresh token generated with 3 parts");

  assert(generateSecureToken(32).length === 64, "Secure token 32 bytes = 64 hex chars");
  assert(generateSecureToken(16).length === 32, "Secure token 16 bytes = 32 hex chars");

  const raw = "test-token-123";
  const hashed1 = hashToken(raw);
  const hashed2 = hashToken(raw);
  assert(hashed1 === hashed2, "Hash token is deterministic");
  assert(hashed1.length === 64, "SHA256 hash is 64 hex chars");
  assert(hashToken("different") !== hashed1, "Different inputs produce different hashes");

  console.log("\n=== COMMON PASSWORD TESTS ===\n");

  const commonPasswords = ["Password123!", "Password1!", "Qwerty123!", "Hello123!"];
  for (const pwd of commonPasswords) {
    assert(validatePassword(pwd).length > 0, `Common password '${pwd}' rejected`);
  }

  console.log("\n=== INPUT VALIDATION TESTS ===\n");

  // Test validation schemas
  console.log("\n  (Express-validator schemas require req/body mocking - structural check)");
  assert(typeof registerValidator === "object" && registerValidator.length >= 2, "registerValidator has valid structure", `length=${registerValidator.length}`);
  assert(typeof loginValidator === "object" && loginValidator.length >= 2, "loginValidator has valid structure");
  assert(typeof forgotPasswordValidator === "object" && forgotPasswordValidator.length >= 2, "forgotPasswordValidator has valid structure");
  assert(typeof resetPasswordValidator === "object" && resetPasswordValidator.length >= 3, "resetPasswordValidator has valid structure");
  assert(typeof updatePasswordValidator === "object" && updatePasswordValidator.length >= 3, "updatePasswordValidator has valid structure");

  console.log("\n=== SUMMARY ===\n");
  console.log(`  Total: ${passed + failed}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Rate: ${Math.round(passed / (passed + failed) * 100)}%\n`);

  if (failed > 0) {
    console.log("  FAILED TESTS:");
    tests.filter(t => t.includes("FAIL")).forEach(t => console.log(`    ${t}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
