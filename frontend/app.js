const API = "/api";
let token = localStorage.getItem("token");
let socket = null;
let currentBoard = null;
let sortableInstances = [];

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    logout();
    throw new Error("Phiên đăng nhập đã hết hạn.");
  }
  if (!response.ok) throw new Error(data.error || "Có lỗi xảy ra, vui lòng thử lại.");
  return data;
}

function setMessage(elementId, text = "") {
  const element = document.getElementById(elementId);
  if (element) element.textContent = text;
}

function logout() {
  localStorage.removeItem("token");
  token = null;
  const authView = document.getElementById("auth-view");
  if (authView) {
    authView.classList.remove("hidden");
    document.getElementById("boards-view")?.classList.add("hidden");
  } else location.href = "index.html";
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  setMessage("auth-message");
  form.querySelector("button").disabled = true;
  try {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: form.email.value.trim(), password: form.password.value })
    });
    token = data.token;
    localStorage.setItem("token", token);
    showBoardsView();
    await loadBoards();
  } catch (error) { setMessage("auth-message", error.message); }
  finally { form.querySelector("button").disabled = false; }
}

async function register(event) {
  event.preventDefault();
  const form = event.currentTarget;
  setMessage("auth-message");
  if (form.password.value !== form.confirmPassword.value) {
    return setMessage("auth-message", "Mật khẩu nhập lại không khớp.");
  }
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: form.email.value.trim(), password: form.password.value })
    });
    const email = form.email.value.trim();
    form.reset();
    showLoginForm();
    document.getElementById("email").value = email;
    setMessage("auth-message", "Đăng ký thành công. Bạn có thể đăng nhập ngay.");
  } catch (error) { setMessage("auth-message", error.message); }
  finally { button.disabled = false; }
}

function showRegisterForm() {
  setMessage("auth-message");
  document.getElementById("login-form").classList.add("hidden");
  document.querySelector("#login-form + .auth-switch").classList.add("hidden");
  document.getElementById("register-form").classList.remove("hidden");
  document.getElementById("register-email").focus();
}

function showLoginForm() {
  setMessage("auth-message");
  document.getElementById("register-form").classList.add("hidden");
  document.getElementById("login-form").classList.remove("hidden");
  document.querySelector("#login-form + .auth-switch").classList.remove("hidden");
  document.getElementById("email").focus();
}

function showBoardsView() {
  document.getElementById("auth-view")?.classList.add("hidden");
  document.getElementById("boards-view")?.classList.remove("hidden");
}

function actionButton(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

async function loadBoards() {
  try {
    const boards = await apiFetch("/board");
    const container = document.getElementById("boards");
    container.replaceChildren();
    if (!boards.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Bạn chưa có board nào. Hãy tạo board đầu tiên nhé.";
      return container.append(empty);
    }
    boards.forEach((board) => {
      const item = document.createElement("article");
      item.className = "board-item";
      const link = document.createElement("a");
      link.className = "board-tile";
      link.href = `board.html?id=${encodeURIComponent(board.id)}`;
      link.textContent = board.title;
      item.append(link);
      if (board.role === "owner") {
        const actions = document.createElement("div");
        actions.className = "tile-actions";
        actions.append(
          actionButton("Sửa", "mini-button", () => renameBoard(board)),
          actionButton("Xóa", "mini-button danger", () => deleteBoard(board.id))
        );
        item.append(actions);
      } else {
        const badge = document.createElement("span");
        badge.className = "shared-badge";
        badge.textContent = "Được chia sẻ";
        item.append(badge);
      }
      container.append(item);
    });
  } catch (error) { setMessage("boards-message", error.message); }
}

async function createBoard(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await apiFetch("/board", { method: "POST", body: JSON.stringify({ title: form.title.value.trim() }) });
    form.reset();
    await loadBoards();
  } catch (error) { setMessage("boards-message", error.message); }
}

async function renameBoard(board = currentBoard) {
  const title = prompt("Tên mới của board:", board.title);
  if (!title?.trim()) return;
  try {
    await apiFetch(`/board/${board.id}`, { method: "PUT", body: JSON.stringify({ title: title.trim() }) });
    if (currentBoard?.id === board.id) await loadBoard(board.id);
    else await loadBoards();
  } catch (error) { setMessage(currentBoard ? "board-message" : "boards-message", error.message); }
}

async function deleteBoard(boardId) {
  if (!confirm("Xóa board này và toàn bộ cột/card bên trong?")) return;
  try {
    await apiFetch(`/board/${boardId}`, { method: "DELETE" });
    if (currentBoard) location.href = "index.html";
    else await loadBoards();
  } catch (error) { setMessage(currentBoard ? "board-message" : "boards-message", error.message); }
}

function renderMembers() {
  const container = document.getElementById("members");
  container.replaceChildren();
  currentBoard.members.forEach((member) => {
    const row = document.createElement("div");
    row.className = "member-row";
    const label = document.createElement("span");
    label.textContent = `${member.email} · ${member.role === "owner" ? "Chủ board" : "Thành viên"}`;
    row.append(label);
    if (currentBoard.role === "owner" && member.role !== "owner") {
      row.append(actionButton("Gỡ", "mini-button danger", () => removeMember(member.id)));
    }
    container.append(row);
  });
}

async function shareBoard(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await apiFetch(`/board/${currentBoard.id}/share`, {
      method: "POST", body: JSON.stringify({ email: form.email.value.trim() })
    });
    form.reset();
    await loadBoard(currentBoard.id);
  } catch (error) { setMessage("board-message", error.message); }
}

async function removeMember(userId) {
  if (!confirm("Gỡ thành viên này khỏi board?")) return;
  try {
    await apiFetch(`/board/${currentBoard.id}/share/${userId}`, { method: "DELETE" });
    await loadBoard(currentBoard.id);
  } catch (error) { setMessage("board-message", error.message); }
}

function renderCard(card) {
  const element = document.createElement("article");
  element.className = "card";
  element.dataset.id = card.id;
  const title = document.createElement("span");
  title.textContent = card.title;
  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.append(
    actionButton("Sửa", "icon-button", () => editCard(card)),
    actionButton("Xóa", "icon-button danger-text", () => deleteCard(card.id))
  );
  element.append(title, actions);
  return element;
}

function renderLists(lists, cards) {
  sortableInstances.forEach((instance) => instance.destroy());
  sortableInstances = [];
  const board = document.getElementById("board");
  board.replaceChildren();
  lists.forEach((list) => {
    const column = document.createElement("article");
    column.className = "list";
    column.dataset.id = list.id;
    const header = document.createElement("header");
    header.className = "list-header";
    const heading = document.createElement("h2");
    heading.textContent = list.title;
    const actions = document.createElement("div");
    actions.append(
      actionButton("Sửa", "icon-button", () => editList(list)),
      actionButton("Xóa", "icon-button danger-text", () => deleteList(list.id))
    );
    header.append(heading, actions);

    const cardList = document.createElement("div");
    cardList.className = "cards";
    cards.filter((card) => Number(card.listId) === Number(list.id)).forEach((card) => cardList.append(renderCard(card)));

    const form = document.createElement("form");
    form.className = "add-card-form";
    const input = document.createElement("input");
    input.name = "title";
    input.maxLength = 255;
    input.placeholder = "Thêm card...";
    input.required = true;
    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "Thêm";
    form.append(input, button);
    form.addEventListener("submit", (event) => createCard(event, list.id));
    column.append(header, cardList, form);
    board.append(column);
  });
  enableDrag();
}

async function loadBoard(boardId) {
  try {
    const [board, lists, cards] = await Promise.all([
      apiFetch(`/board/${boardId}`), apiFetch(`/list/board/${boardId}`), apiFetch(`/card/${boardId}`)
    ]);
    currentBoard = board;
    document.getElementById("current-board-title").textContent = board.title;
    document.title = `${board.title} · Trello Pro`;
    ["share-toggle", "edit-board-button", "delete-board-button"].forEach((id) => {
      document.getElementById(id).classList.toggle("hidden", board.role !== "owner");
    });
    renderMembers();
    renderLists(lists, cards);
  } catch (error) { setMessage("board-message", error.message); }
}

async function createList(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await apiFetch(`/list/board/${currentBoard.id}`, { method: "POST", body: JSON.stringify({ title: form.title.value.trim() }) });
    form.reset();
    await changed();
  } catch (error) { setMessage("board-message", error.message); }
}

async function editList(list) {
  const title = prompt("Tên mới của cột:", list.title);
  if (!title?.trim()) return;
  try {
    await apiFetch(`/list/${list.id}`, { method: "PUT", body: JSON.stringify({ title: title.trim() }) });
    await changed();
  } catch (error) { setMessage("board-message", error.message); }
}

async function deleteList(listId) {
  if (!confirm("Xóa cột này và toàn bộ card bên trong?")) return;
  try {
    await apiFetch(`/list/${listId}`, { method: "DELETE" });
    await changed();
  } catch (error) { setMessage("board-message", error.message); }
}

async function createCard(event, listId) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await apiFetch(`/card/${currentBoard.id}`, {
      method: "POST", body: JSON.stringify({ listId, title: form.title.value.trim() })
    });
    form.reset();
    await changed();
  } catch (error) { setMessage("board-message", error.message); }
}

async function editCard(card) {
  const title = prompt("Nội dung mới của card:", card.title);
  if (!title?.trim()) return;
  try {
    await apiFetch(`/card/${card.id}`, { method: "PUT", body: JSON.stringify({ title: title.trim() }) });
    await changed();
  } catch (error) { setMessage("board-message", error.message); }
}

async function deleteCard(cardId) {
  if (!confirm("Xóa card này?")) return;
  try {
    await apiFetch(`/card/${cardId}`, { method: "DELETE" });
    await changed();
  } catch (error) { setMessage("board-message", error.message); }
}

async function changed() {
  socket?.emit("card-changed", { boardId: currentBoard.id });
  await loadBoard(currentBoard.id);
}

function enableDrag() {
  if (!window.Sortable) return;
  const board = document.getElementById("board");
  sortableInstances.push(new Sortable(board, {
    animation: 180, direction: "vertical", draggable: ".list", handle: ".list-header", onEnd: saveBoardOrder
  }));
  board.querySelectorAll(".cards").forEach((container) => {
    sortableInstances.push(new Sortable(container, {
      group: "cards", animation: 180, direction: "vertical", draggable: ".card", filter: "button", onEnd: saveBoardOrder
    }));
  });
}

async function saveBoardOrder() {
  const lists = [...document.querySelectorAll("#board > .list")].map((list) => ({
    id: Number(list.dataset.id),
    cardIds: [...list.querySelectorAll(".cards > .card")].map((card) => Number(card.dataset.id))
  }));
  try {
    await apiFetch("/card/move", { method: "POST", body: JSON.stringify({ boardId: currentBoard.id, lists }) });
    socket?.emit("card-changed", { boardId: currentBoard.id });
  } catch (error) {
    setMessage("board-message", error.message);
    await loadBoard(currentBoard.id);
  }
}

function initIndex() {
  if (!document.getElementById("auth-view")) return;
  document.getElementById("login-form").addEventListener("submit", login);
  document.getElementById("register-form").addEventListener("submit", register);
  document.getElementById("show-register").addEventListener("click", showRegisterForm);
  document.getElementById("show-login").addEventListener("click", showLoginForm);
  document.getElementById("board-form").addEventListener("submit", createBoard);
  document.getElementById("logout-button").addEventListener("click", logout);
  if (token) { showBoardsView(); loadBoards(); }
}

function initBoard() {
  if (!document.getElementById("board")) return;
  if (!token) return logout();
  const boardId = new URLSearchParams(location.search).get("id");
  if (!boardId || !/^\d+$/.test(boardId)) return setMessage("board-message", "Board không hợp lệ.");
  document.getElementById("logout-button").addEventListener("click", logout);
  document.getElementById("list-form").addEventListener("submit", createList);
  document.getElementById("share-form").addEventListener("submit", shareBoard);
  document.getElementById("share-toggle").addEventListener("click", () => document.getElementById("share-panel").classList.toggle("hidden"));
  document.getElementById("edit-board-button").addEventListener("click", () => renameBoard());
  document.getElementById("delete-board-button").addEventListener("click", () => deleteBoard(currentBoard.id));
  loadBoard(Number(boardId));
  if (window.io) {
    socket = io();
    socket.emit("join-board", boardId);
    socket.on("card-updated", () => loadBoard(Number(boardId)));
  }
}

initIndex();
initBoard();
