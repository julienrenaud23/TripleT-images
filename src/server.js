import multer from "multer";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const express = require("express");
const cookieParser = require("cookie-parser");
const { authRouter, requireAuth } = require("./auth");
const { pool, init } = require("./db");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRouter);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const UPLOADS = path.join(process.cwd(), "uploads");

app.post("/images", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).send("No image");
  const id = crypto.randomUUID();
  await fs.mkdir(UPLOADS, { recursive: true });
  await sharp(req.file.buffer).resize(368, 448, { fit: "inside" }).jpeg({ quality: 75 })
    .toFile(path.join(UPLOADS, `${id}.jpg`));
  res.json({ id, url: `/images/${id}` });
});

app.post("/account", requireAuth, async (req, res) => {
  const { api_code } = req.body ?? {};
  if (!api_code)
    return res.sendStatus(400).send("No watch application key provided");
  
  try {
    await pool.query(`
      UPDATE users
      SET api_code = $1
      WHERE id = $2;
    `, [api_code, req.userId]);
    req.send(201);
  } catch (err) {
    if (err.code === "23505") return res.status(409).send("Code already linked with an account"); // unique violation
    throw err;
  }
});

app.get("/images/:filename", async (req, res) => {
  const token = req.cookies?.session;
  let user_id;
  if (!token) {
    // use api code from http header instead
    const api_code = req.header("x-api-code");
    if (!api_code)
      return res.sendStatus(401).send("invalid api code");

    const { rows } = await pool.query(`
      SELECT id FROM users WHERE api_code = $1
      `, api_code);
    if (!rows[0])
      return res.sendStatus(404).send("No account linked to this api_code yet");

    user_id = rows[0].id;
  } else {
    // get user_id from current login
    // reuses code from requireAuth
    const { rows } = await pool.query(
    "SELECT user_id FROM sessions WHERE token = $1 AND created_at > now() - interval '7 days'",
    [token]
    );

    if (!rows[0])
      return res.sendStatus(401).send("invalid login");
    user_id = rows[0].user_id;
  }

  // filename contains extension too
  const filename = path.basename(req.params.filename); // blocks path traversal
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  
  const image_dir = path.join(UPLOADS, `${user_id}`);
  res.sendFile(
    `${filename}`,
    {
      root: image_dir,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
    (err) => {
      if (err && !res.headersSent) res.sendStatus(404);
    }
  );
});

// todo: add app.get("/images") that returns the json
// add home, login, sign up, and settings page
// home = galery

await init().then(() => app.listen(3000));