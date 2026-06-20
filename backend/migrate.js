const db = require("./db");

async function migrate() {
  const sql = db.promise();

  await sql.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
  )`);

  await sql.query(`CREATE TABLE IF NOT EXISTS boards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await sql.query(`CREATE TABLE IF NOT EXISTS board_members (
    board_id INT NOT NULL,
    user_id INT NOT NULL,
    PRIMARY KEY (board_id, user_id),
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await sql.query(`CREATE TABLE IF NOT EXISTS lists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    INDEX idx_lists_board_position (board_id, position)
  )`);

  await sql.query(`CREATE TABLE IF NOT EXISTS cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT NOT NULL,
    list_id INT NULL,
    title VARCHAR(255) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
    INDEX idx_cards_board_position (board_id, position),
    INDEX idx_cards_list_position (list_id, position)
  )`);

  const [columns] = await sql.query("SHOW COLUMNS FROM cards LIKE 'list_id'");
  if (!columns.length) {
    await sql.query("ALTER TABLE cards ADD COLUMN list_id INT NULL AFTER board_id");
    await sql.query("CREATE INDEX idx_cards_list_position ON cards(list_id, position)");
  }

  await sql.query(`INSERT INTO lists(board_id, title, position)
    SELECT b.id, 'Công việc', 0
    FROM boards b
    WHERE NOT EXISTS (SELECT 1 FROM lists l WHERE l.board_id=b.id)`);

  await sql.query(`UPDATE cards c
    JOIN (SELECT board_id, MIN(id) AS list_id FROM lists GROUP BY board_id) l ON l.board_id=c.board_id
    SET c.list_id=l.list_id
    WHERE c.list_id IS NULL`);
}

module.exports = migrate;
