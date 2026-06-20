const jwt = require("jsonwebtoken");
const { secret } = require("../jwt");

module.exports = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Bạn chưa đăng nhập." });
  }

  try {
    const decoded = jwt.verify(header.slice(7), secret);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Phiên đăng nhập không hợp lệ." });
  }
};
