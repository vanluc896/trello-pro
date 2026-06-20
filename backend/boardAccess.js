const db = require("./db");

async function getBoardAccess(boardId, userId) {
  const [rows] = await db.promise().query(
    `SELECT b.id, b.title, b.user_id,
            CASE WHEN b.user_id=? THEN 'owner' ELSE 'member' END AS role
     FROM boards b
     LEFT JOIN board_members bm ON bm.board_id=b.id AND bm.user_id=?
     WHERE b.id=? AND (b.user_id=? OR bm.user_id=?)
     LIMIT 1`,
    [userId, userId, boardId, userId, userId]
  );
  return rows[0] || null;
}

async function getListAccess(listId, userId) {
  const [rows] = await db.promise().query(
    `SELECT l.id, l.board_id, l.title,
            CASE WHEN b.user_id=? THEN 'owner' ELSE 'member' END AS role
     FROM lists l
     JOIN boards b ON b.id=l.board_id
     LEFT JOIN board_members bm ON bm.board_id=b.id AND bm.user_id=?
     WHERE l.id=? AND (b.user_id=? OR bm.user_id=?)
     LIMIT 1`,
    [userId, userId, listId, userId, userId]
  );
  return rows[0] || null;
}

async function getCardAccess(cardId, userId) {
  const [rows] = await db.promise().query(
    `SELECT c.id, c.board_id, c.list_id,
            CASE WHEN b.user_id=? THEN 'owner' ELSE 'member' END AS role
     FROM cards c
     JOIN boards b ON b.id=c.board_id
     LEFT JOIN board_members bm ON bm.board_id=b.id AND bm.user_id=?
     WHERE c.id=? AND (b.user_id=? OR bm.user_id=?)
     LIMIT 1`,
    [userId, userId, cardId, userId, userId]
  );
  return rows[0] || null;
}

module.exports = { getBoardAccess, getListAccess, getCardAccess };
