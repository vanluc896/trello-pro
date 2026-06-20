const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");
const { getBoardAccess } = require("../boardAccess");

const router = express.Router();
const sql = db.promise();
const validId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

router.get("/", auth, async (req, res, next) => {
  try {
    const [boards] = await sql.query(
      `SELECT DISTINCT b.id, b.title,
              CASE WHEN b.user_id=? THEN 'owner' ELSE 'member' END AS role
       FROM boards b
       LEFT JOIN board_members bm ON bm.board_id=b.id
       WHERE b.user_id=? OR bm.user_id=?
       ORDER BY b.id DESC`,
      [req.user.id, req.user.id, req.user.id]
    );
    res.json(boards);
  } catch (error) { next(error); }
});

router.post("/", auth, async (req, res, next) => {
  const title = String(req.body.title || "").trim();
  if (!title || title.length > 255) return res.status(400).json({ error: "Tên board phải có từ 1 đến 255 ký tự." });

  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query("INSERT INTO boards(user_id,title) VALUES(?,?)", [req.user.id, title]);
    await connection.query("INSERT INTO lists(board_id,title,position) VALUES(?,?,0)", [result.insertId, "Công việc"]);
    await connection.commit();
    res.status(201).json({ id: result.insertId, title, role: "owner" });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

router.get("/:boardId", auth, async (req, res, next) => {
  try {
    const board = validId(req.params.boardId) && await getBoardAccess(Number(req.params.boardId), req.user.id);
    if (!board) return res.status(404).json({ error: "Không tìm thấy board." });
    const [members] = await sql.query(
      `SELECT u.id, u.email, 'member' AS role FROM board_members bm
       JOIN users u ON u.id=bm.user_id WHERE bm.board_id=?
       UNION ALL
       SELECT u.id, u.email, 'owner' AS role FROM boards b
       JOIN users u ON u.id=b.user_id WHERE b.id=?`,
      [board.id, board.id]
    );
    res.json({ id: board.id, title: board.title, role: board.role, members });
  } catch (error) { next(error); }
});

router.put("/:boardId", auth, async (req, res, next) => {
  const title = String(req.body.title || "").trim();
  if (!title || title.length > 255) return res.status(400).json({ error: "Tên board không hợp lệ." });
  try {
    const board = await getBoardAccess(Number(req.params.boardId), req.user.id);
    if (!board) return res.status(404).json({ error: "Không tìm thấy board." });
    if (board.role !== "owner") return res.status(403).json({ error: "Chỉ chủ board được đổi tên." });
    await sql.query("UPDATE boards SET title=? WHERE id=?", [title, board.id]);
    res.json({ id: board.id, title });
  } catch (error) { next(error); }
});

router.delete("/:boardId", auth, async (req, res, next) => {
  try {
    const board = await getBoardAccess(Number(req.params.boardId), req.user.id);
    if (!board) return res.status(404).json({ error: "Không tìm thấy board." });
    if (board.role !== "owner") return res.status(403).json({ error: "Chỉ chủ board được xóa board." });
    await sql.query("DELETE FROM boards WHERE id=?", [board.id]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post("/:boardId/share", auth, async (req, res, next) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  try {
    const board = await getBoardAccess(Number(req.params.boardId), req.user.id);
    if (!board) return res.status(404).json({ error: "Không tìm thấy board." });
    if (board.role !== "owner") return res.status(403).json({ error: "Chỉ chủ board được mời thành viên." });
    const [users] = await sql.query("SELECT id, email FROM users WHERE email=? LIMIT 1", [email]);
    if (!users.length) return res.status(404).json({ error: "Email này chưa đăng ký tài khoản." });
    if (users[0].id === board.user_id) return res.status(400).json({ error: "Bạn đã là chủ board." });
    await sql.query("INSERT IGNORE INTO board_members(board_id,user_id) VALUES(?,?)", [board.id, users[0].id]);
    res.status(201).json({ id: users[0].id, email: users[0].email, role: "member" });
  } catch (error) { next(error); }
});

router.delete("/:boardId/share/:userId", auth, async (req, res, next) => {
  try {
    const board = await getBoardAccess(Number(req.params.boardId), req.user.id);
    if (!board) return res.status(404).json({ error: "Không tìm thấy board." });
    if (board.role !== "owner") return res.status(403).json({ error: "Chỉ chủ board được xóa thành viên." });
    await sql.query("DELETE FROM board_members WHERE board_id=? AND user_id=?", [board.id, Number(req.params.userId)]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

module.exports = router;
