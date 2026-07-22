const http = require("http");

const PORT = 5097;

let passed = 0;
let failed = 0;
let server = null;

async function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "localhost",
      port: PORT,
      path,
      method,
      headers: { "Content-Type": "application/json", ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function t(condition, name, detail = "") {
  if (condition) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.log(`  FAIL: ${name}${detail ? ` - ${detail}` : ""}`); }
}

async function run() {
  process.env.JWT_SECRET = "test-jwt-secret-api";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-api";
  process.env.NODE_ENV = "test";
  process.env.CLIENT_URL = "http://localhost:3000";

  const app = require("../app");
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));

  try {
    console.log("\n=== VALIDATION-LAYER API TESTS ===\n");

    // Security Headers
    console.log("--- Security Headers ---");
    const h = (await request("GET", "/")).headers;
    await t(h["x-frame-options"] === "DENY", "X-Frame-Options: DENY");
    await t(h["x-content-type-options"] === "nosniff", "X-Content-Type-Options: nosniff");
    await t(h["referrer-policy"] !== undefined, "Referrer-Policy present");
    await t(h["content-security-policy"] !== undefined, "CSP header present");

    // Input Validation (bypasses DB)
    console.log("\n--- Input Validation ---");

    let r = await request("POST", "/api/auth/register", {});
    await t(r.status === 400, "Empty register rejected");

    r = await request("POST", "/api/auth/register", { name: "Test User", email: "test@e.co", password: "weak" });
    await t(r.status === 400, "Weak password rejected");

    r = await request("POST", "/api/auth/register", { name: "Test User", email: "test@e.co", password: "alllowercase1!" });
    await t(r.status === 400, "No uppercase password rejected");

    r = await request("POST", "/api/auth/register", { name: "Test User", email: "test@e.co", password: "NoNumbersHere!" });
    await t(r.status === 400, "No number password rejected");

    r = await request("POST", "/api/auth/register", { name: "Test User", email: "test@e.co", password: "NoSpecialChar1" });
    await t(r.status === 400, "No special char password rejected");

    r = await request("POST", "/api/auth/register", { name: "Test User", email: "notanemail", password: "StrongPass1!" });
    await t(r.status === 400, "Invalid email rejected", `status=${r.status}`);

    r = await request("POST", "/api/auth/login", {});
    await t(r.status === 400, "Empty login rejected");

    r = await request("POST", "/api/auth/login", { email: "test@e.co" });
    await t(r.status === 400, "Login no password rejected");

    r = await request("POST", "/api/auth/forgot-password", { email: "" });
    await t(r.status === 400, "Forgot password empty email rejected");

    r = await request("POST", "/api/auth/forgot-password", { email: "bad" });
    await t(r.status === 400, "Forgot password invalid email rejected");

    // CSRF
    console.log("\n--- CSRF Protection ---");
    r = await request("GET", "/api/csrf-token");
    await t(r.status === 200, "CSRF endpoint works");
    await t(r.body?.csrfToken !== undefined, "CSRF token returned");

    // Route Security
    console.log("\n--- Route Security ---");
    r = await request("GET", "/api/nonexistent");
    await t(r.status === 404, "Unknown route returns 404");

    r = await request("GET", "/api/auth/profile");
    await t(r.status === 401, "Protected route returns 401 without auth");

    r = await request("GET", "/api/admin/stats");
    await t(r.status === 401, "Admin route returns 401 without auth");

  } finally {
    server.close();
    console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed (${Math.round(passed/(passed+failed)*100) || 0}%) ===\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
