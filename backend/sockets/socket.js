module.exports = (io) => {
  io.on("connection", (socket) => {

    socket.on("join-board", (boardId) => {
      socket.join("board-" + boardId);
    });

    socket.on("card-changed", (data) => {
      if (!/^\d+$/.test(String(data?.boardId))) return;
      io.to("board-" + data.boardId).emit("card-updated", data);
    });

  });
};
