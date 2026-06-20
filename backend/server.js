const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/api/health", (req, res) => res.json({ ok: true }));

// routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/board", require("./routes/board"));
app.use("/api/list", require("./routes/list"));
app.use("/api/card", require("./routes/card"));

// socket
require("./sockets/socket")(io);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Lỗi máy chủ." });
});

const port = Number(process.env.PORT) || 3000;
require("./migrate")()
  .then(() => {
    server.listen(port, () => console.log(`Server running http://localhost:${port}`));
  })
  .catch((error) => {
    console.error("Không thể kết nối hoặc cập nhật database:", error.message);
    process.exitCode = 1;
  });
