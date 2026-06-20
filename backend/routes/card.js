const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");
const { getBoardAccess, getCardAccess } = require("../boardAccess");

const router = express.Router();
const sql = db.promise();
const validId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

router.post("/move", auth, async (req, res, next) => {
  const boardId = Number(req.body.boardId);
  const lists = req.body.lists;
  if (!validId(boardId) || !Array.isArray(lists)) return res.status(400).json({ error: "Thứ tự card không hợp lệ." });

  const listIds = lists.map((list) => Number(list.id));
  const cardIds = lists.flatMap((list) => Array.isArray(list.cardIds) ? list.cardIds.map(Number) : [NaN]);
  if (listIds.some((id) => !validId(id)) || cardIds.some((id) => !validId(id)) ||
      new Set(listIds).size !== listIds.length || new Set(cardIds).size !== cardIds.length) {
    return res.status(400).json({ error: "Danh sách cột hoặc card không hợp lệ." });
  }

  try {
    const board = await getBoardAccess(boardId, req.user.id);
    if (!board) return res.status(404).json({ error: "Không tìm thấy board." });

    const [ownedLists] = await sql.query("SELECT id FROM lists WHERE board_id=?", [boardId]);
    const [ownedCards] = await sql.query("SELECT id FROM cards WHERE board_id=?", [boardId]);
    const sameIds = (actual, requested) => {
      const a = actual.map(({ id }) => Number(id)).sort((x, y) => x - y);
      const b = [...requested].sort((x, y) => x - y);
      return a.length === b.length && a.every((id, index) => id === b[index]);
    };
    if (!sameIds(ownedLists, listIds) || !sameIds(ownedCards, cardIds)) {
      return res.status(400).json({ error: "Thứ tự không chứa đầy đủ cột và card của board." });
    }

    const connection = await db.promise().getConnection();
    try {
      await connection.beginTransaction();
      for (let listPosition = 0; listPosition < lists.length; listPosition += 1) {
        const list = lists[listPosition];
        await connection.query("UPDATE lists SET position=? WHERE id=? AND board_id=?", [listPosition, list.id, boardId]);
        for (let cardPosition = 0; cardPosition < list.cardIds.length; cardPosition += 1) {
          await connection.query(
            "UPDATE cards SET list_id=?, position=? WHERE id=? AND board_id=?",
            [list.id, cardPosition, list.cardIds[cardPosition], boardId]
          );
        }
      }
      await connection.commit();
      res.json({ ok: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  } catch (error) { next(error); }
});

router.get("/:boardId", auth, async (req, res, next) => {
  try {
    const board = await getBoardAccess(Number(req.params.boardId), req.user.id);
    if (!board) return res.status(404).json({ error: "Không tìm thấy board." });
    const [cards] = await sql.query(
      "SELECT id, list_id AS listId, title, position FROM cards WHERE board_id=? ORDER BY position,id",
      [board.id]
    );
    res.json(cards);
  } catch (error) { next(error); }
});

router.post("/:boardId", auth, async (req, res, next) => {
  const boardId = Number(req.params.boardId);
  const listId = Number(req.body.listId);
  const title = String(req.body.title || "").trim();
  if (!validId(boardId) || !validId(listId) || !title || title.length > 255) {
    return res.status(400).json({ error: "Nội dung card không hợp lệ." });
  }
  try {
    const board = await getBoardAccess(boardId, req.user.id);
    if (!board) return res.status(404).json({ error: "Không tìm thấy board." });
    const [lists] = await sql.query("SELECT id FROM lists WHERE id=? AND board_id=?", [listId, boardId]);
    if (!lists.length) return res.status(400).json({ error: "Cột không thuộc board này." });
    const [positions] = await sql.query("SELECT COALESCE(MAX(position),-1)+1 AS position FROM cards WHERE list_id=?", [listId]);
    const position = positions[0].position;
    const [result] = await sql.query(
      "INSERT INTO cards(board_id,list_id,title,position) VALUES(?,?,?,?)",
      [boardId, listId, title, position]
    );
    res.status(201).json({ id: result.insertId, listId, title, position });
  } catch (error) { next(error); }
});

router.put("/:cardId", auth, async (req, res, next) => {
  const title = String(req.body.title || "").trim();
  if (!title || title.length > 255) return res.status(400).json({ error: "Nội dung card không hợp lệ." });
  try {
    const card = await getCardAccess(Number(req.params.cardId), req.user.id);
    if (!card) return res.status(404).json({ error: "Không tìm thấy card." });
    await sql.query("UPDATE cards SET title=? WHERE id=?", [title, card.id]);
    res.json({ id: card.id, title });
  } catch (error) { next(error); }
});

router.delete("/:cardId", auth, async (req, res, next) => {
  try {
    const card = await getCardAccess(Number(req.params.cardId), req.user.id);
    if (!card) return res.status(404).json({ error: "Không tìm thấy card." });
    await sql.query("DELETE FROM cards WHERE id=?", [card.id]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

module.exports = router;
