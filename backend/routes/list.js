const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");
const { getBoardAccess, getListAccess } = require("../boardAccess");

const router = express.Router();
const sql = db.promise();

router.get("/board/:boardId", auth, async (req, res, next) => {
  try {
    const board = await getBoardAccess(Number(req.params.boardId), req.user.id);
    if (!board) return res.status(404).json({ error: "Không tìm thấy board." });
    const [lists] = await sql.query("SELECT id, title, position FROM lists WHERE board_id=? ORDER BY position,id", [board.id]);
    res.json(lists);
  } catch (error) { next(error); }
});

router.post("/board/:boardId", auth, async (req, res, next) => {
  const title = String(req.body.title || "").trim();
  if (!title || title.length > 255) return res.status(400).json({ error: "Tên cột không hợp lệ." });
  try {
    const board = await getBoardAccess(Number(req.params.boardId), req.user.id);
    if (!board) return res.status(404).json({ error: "Không tìm thấy board." });
    const [rows] = await sql.query("SELECT COALESCE(MAX(position),-1)+1 AS position FROM lists WHERE board_id=?", [board.id]);
    const [result] = await sql.query("INSERT INTO lists(board_id,title,position) VALUES(?,?,?)", [board.id, title, rows[0].position]);
    res.status(201).json({ id: result.insertId, title, position: rows[0].position });
  } catch (error) { next(error); }
});

router.put("/:listId", auth, async (req, res, next) => {
  const title = String(req.body.title || "").trim();
  if (!title || title.length > 255) return res.status(400).json({ error: "Tên cột không hợp lệ." });
  try {
    const list = await getListAccess(Number(req.params.listId), req.user.id);
    if (!list) return res.status(404).json({ error: "Không tìm thấy cột." });
    await sql.query("UPDATE lists SET title=? WHERE id=?", [title, list.id]);
    res.json({ id: list.id, title });
  } catch (error) { next(error); }
});

router.delete("/:listId", auth, async (req, res, next) => {
  try {
    const list = await getListAccess(Number(req.params.listId), req.user.id);
    if (!list) return res.status(404).json({ error: "Không tìm thấy cột." });
    const [counts] = await sql.query("SELECT COUNT(*) AS total FROM lists WHERE board_id=?", [list.board_id]);
    if (counts[0].total <= 1) return res.status(400).json({ error: "Board phải có ít nhất một cột." });
    await sql.query("DELETE FROM cards WHERE list_id=?", [list.id]);
    await sql.query("DELETE FROM lists WHERE id=?", [list.id]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

module.exports = router;
