import multer from "multer";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const express = require("express");
const cookieParser = require("cookie-parser");
const { authRouter, requireAuth, db } = require("./auth");
const { pool, init } = require("./db");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRouter);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const UPLOADS = path.join(process.cwd(), "uploads");

app.use("/images", (req, res, next) => {
  // change it so it compares to api_code
  // also mkdir in uploads: uploads/api_code and then the watch can download it
  if (req.header("x-api-key") !== process.env.API_KEY) return res.sendStatus(401);
  next();
});

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
    return res.sendStatus(400).send("No watch key provided");
  
  await pool.query(`
    UPDATE users
    SET api_code = $1
    WHERE id = $2;
  `, [api_code, req.userId]);
});

app.get("/images/:id", (req, res) => {
  const id = path.basename(req.params.id); // blocks path traversal
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.sendFile(path.join(UPLOADS, `${id}.jpg`), (err) => err && res.sendStatus(404));
});

await init().then(() => app.listen(3000));