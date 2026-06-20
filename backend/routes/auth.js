const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { secret } = require("../jwt");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", async (req, res, next) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!emailPattern.test(email) || password.length < 6) {
    return res.status(400).json({ error: "Email không hợp lệ hoặc mật khẩu ngắn hơn 6 ký tự." });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO users(email,password) VALUES(?,?)",
      [email, hash],
      (err) => {
        if (err?.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ error: "Email đã được sử dụng." });
        }
        if (err) return next(err);
        res.status(201).json({ ok: true });
      }
    );
  } catch (error) {
    next(error);
  }
});

router.post("/login", (req, res, next) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!email || !password) {
    return res.status(400).json({ error: "Vui lòng nhập email và mật khẩu." });
  }

  db.query("SELECT id, password FROM users WHERE email=? LIMIT 1", [email], async (err, users) => {
    if (err) return next(err);
    const user = users[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Email hoặc mật khẩu không đúng." });
    }

    const token = jwt.sign({ id: user.id }, secret, { expiresIn: "7d" });
    res.json({ token });
  });
});

module.exports = router;
