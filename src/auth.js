const { pool } = require("./db");
const crypto = require("crypto");
const { Router } = require("express");

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const hash = (password, salt) =>
  crypto.scryptSync(password, salt, 64).toString("hex");

const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).send("Missing fields");

  const salt = crypto.randomBytes(16).toString("hex");
  try {
    await pool.query(
      "INSERT INTO users (username, password_hash, salt) VALUES ($1, $2, $3)",
      [username, hash(password, salt), salt]
    );
    res.sendStatus(201);
  } catch (err) {
    if (err.code === "23505") return res.status(409).send("Username taken"); // unique violation
    throw err;
  }
});

authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).send("Missing fields");

  const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
  const user = rows[0];

  const valid =
    user &&
    crypto.timingSafeEqual(
      Buffer.from(hash(password, user.salt)),
      Buffer.from(user.password_hash)
    );
  if (!valid) return res.status(401).send("Invalid credentials");

  const token = crypto.randomBytes(32).toString("hex");
  await pool.query("INSERT INTO sessions (token, user_id) VALUES ($1, $2)", [token, user.id]);

  res.cookie("session", token, {
    httpOnly: true, // JS on the page can't read it
    sameSite: "lax", // basic CSRF protection
    maxAge: SESSION_MAX_AGE,
  });
  res.sendStatus(204);
});

authRouter.post("/logout", async (req, res) => {
  await pool.query("DELETE FROM sessions WHERE token = $1", [req.cookies?.session])
  res.clearCookie("session");
  res.sendStatus(204);
});

// Use on any route that needs a logged-in user
async function requireAuth(req, res, next) {
  const token = req.cookies?.session;
  if (!token) return res.sendStatus(401);

  const { rows } = await pool.query(
    "SELECT user_id FROM sessions WHERE token = $1 AND created_at > now() - interval '7 days'",
    [token]
  );
  if (!rows[0]) return res.sendStatus(401);

  req.userId = rows[0].user_id;
  next();
}

module.exports = { authRouter, requireAuth, db };