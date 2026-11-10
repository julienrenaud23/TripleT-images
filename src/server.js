const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs/promises");
const path = require("path");

/*
Images get stored in ./uploads/user_id
The api can fetch images if its linked to an account
*/

const express = require("express");
const cookieParser = require("cookie-parser");
const { authRouter, requireAuth, requireAuthOrAPI } = require("./auth");
const { pool, init } = require("./db");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRouter);
app.use("/images", requireAuthOrAPI);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploads_path = path.join(process.cwd(), "uploads");


app.post("/images", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).send("No image");

  const { filename } = req.body ?? {};
  if (!filename) return res.status(400).send("Must include a filename");

  const image_path = path.join(uploads_path, `${req.user_id}`, `${filename}.jpg`);
  await fs.mkdir(path.dirname(image_path), { recursive: true });
  // ./uploads/uid

  await sharp(req.file.buffer).resize(368, 448, { fit: "inside" }).jpeg({ quality: 75 })
    .toFile(image_path);
  res.json({ id: req.user_id, url: `/images/${req.user_id}` });
});

app.post("/account", requireAuth, async (req, res) => {
  const { api_code } = req.body ?? {};
  if (!api_code)
    return res.status(400).send("No watch application key provided");
  
  try {
    await pool.query(`
      UPDATE users
      SET api_code = $1
      WHERE id = $2;
    `, [api_code, req.user_id]);
    req.sendStatus(201);
  } catch (err) {
    if (err.code === "23505") return res.status(409).send("Code already linked with an account"); // unique violation
    throw err;
  }
});

app.get("/images/:filename", requireAuthOrAPI, async (req, res) => {
  let user_id = req.user_id;

  // filename contains extension too
  const filename = path.basename(req.params.filename); // blocks path traversal
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  
  const image_dir = path.join(uploads_path, `${user_id}`);
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

app.get("/images", requireAuthOrAPI, async (req, res) => {
  let user_id = req.user_id;
  const dir_path = path.join(uploads_path, `${user_id}`);
  const dir_obj = await listDirJSON(dir_path);

  if (dir_obj == null) {
    // create user's directory
    const image_path = path.join(process.cwd(), "uploads", `${req.user_id}`, `${filename}.jpg`);
    await fs.mkdir(path.dirname(image_path), { recursive: true });
  }
  res.json(dir_obj);
});


async function listDirJSON(dir_path) {
  try {
    const entries = await fs.readdir(dir_path, { withFileTypes: true });
    let file_infos = [];
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(dir_path, entry.name);
        
        // Fetch metadata stats for the file
        const stats = await fs.stat(fullPath);
        
        // stats.mtime holds the JavaScript Date object of the last modification
        const file_obj = {
                  filename: entry.name,
                  time: stats.mtime.toISOString()
                };
        file_infos.push(file_obj);
      }
    }

    return file_infos;
  } catch (err) {
    return null;
  }
}

// for testing
module.exports = { app }

// add home, login, sign up, and settings page
// home = galery

init().then(() => app.listen(3000));