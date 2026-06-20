import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  get,
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  set,
  update
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAunFqFXWVdD82R3-teYb_m_D21-ykM9o0",
  authDomain: "trello-pro-896.firebaseapp.com",
  databaseURL: "https://trello-pro-896-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "trello-pro-896",
  storageBucket: "trello-pro-896.firebasestorage.app",
  messagingSenderId: "1021949830954",
  appId: "1:1021949830954:web:fdd37fc450da2b49dc2053"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const database = getDatabase(firebaseApp);

let currentUser = null;
let currentBoard = null;
let currentBoardId = null;
let boardLists = [];
let boardCards = [];
let sortableInstances = [];
let unsubscribeBoards = null;
let boardUnsubscribers = [];

function setMessage(elementId, text = "") {
  const element = document.getElementById(elementId);
  if (element) element.textContent = text;
}

function closeDialog(backdrop, value, resolve) {
  backdrop.remove();
  resolve(value);
}

function askDialog({ title, message, defaultValue = "", confirmText = "OK", danger = false, textInput = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "dialog-backdrop";

    const dialog = document.createElement("section");
    dialog.className = "dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.tabIndex = -1;

    const heading = document.createElement("h2");
    heading.textContent = title;
    const copy = document.createElement("p");
    copy.textContent = message;
    dialog.append(heading, copy);

    let input = null;
    if (textInput) {
      input = document.createElement("input");
      input.type = "text";
      input.maxLength = 255;
      input.value = defaultValue;
      dialog.append(input);
    }

    const actions = document.createElement("div");
    actions.className = "dialog-actions";
    const cancel = actionButton("Hủy", "secondary", () => closeDialog(backdrop, null, resolve));
    const confirm = actionButton(confirmText, danger ? "danger" : "", () => {
      closeDialog(backdrop, textInput ? input.value.trim() : true, resolve);
    });
    actions.append(cancel, confirm);
    dialog.append(actions);
    backdrop.append(dialog);
    document.body.append(backdrop);

    const onKeyDown = (event) => {
      if (event.key === "Escape") closeDialog(backdrop, null, resolve);
      if (event.key === "Enter" && textInput && document.activeElement === input) {
        event.preventDefault();
        closeDialog(backdrop, input.value.trim(), resolve);
      }
    };
    backdrop.addEventListener("keydown", onKeyDown);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeDialog(backdrop, null, resolve);
    });
    (input || confirm).focus();
    if (input) input.select();
  });
}

function askText(title, message, defaultValue = "") {
  return askDialog({ title, message, defaultValue, confirmText: "Lưu", textInput: true });
}

function askConfirm(title, message, confirmText = "Xóa") {
  return askDialog({ title, message, confirmText, danger: true });
}

function firebaseError(error) {
  const messages = {
    "auth/email-already-in-use": "Email này đã được đăng ký.",
    "auth/invalid-email": "Email không hợp lệ.",
    "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
    "auth/missing-password": "Vui lòng nhập mật khẩu.",
    "auth/weak-password": "Mật khẩu phải có ít nhất 6 ký tự.",
    "auth/too-many-requests": "Bạn thử quá nhiều lần. Vui lòng chờ một lúc.",
    "auth/network-request-failed": "Không thể kết nối Firebase. Hãy kiểm tra mạng."
  };
  return messages[error?.code] || error?.message || "Có lỗi xảy ra, vui lòng thử lại.";
}

function emailKey(email) {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function collection(snapshot) {
  const value = snapshot.val() || {};
  return Object.entries(value)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

function actionButton(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  setMessage("auth-message");
  button.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
  } catch (error) {
    setMessage("auth-message", firebaseError(error));
  } finally {
    button.disabled = false;
  }
}

async function register(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.email.value.trim().toLowerCase();
  setMessage("auth-message");
  if (form.password.value !== form.confirmPassword.value) {
    return setMessage("auth-message", "Mật khẩu nhập lại không khớp.");
  }

  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, form.password.value);
    const uid = credential.user.uid;
    await update(ref(database), {
      [`users/${uid}`]: { email },
      [`emailDirectory/${emailKey(email)}`]: { uid, email }
    });
    await signOut(auth);
    form.reset();
    showLoginForm();
    document.getElementById("email").value = email;
    setMessage("auth-message", "Đăng ký thành công. Bạn có thể đăng nhập ngay.");
  } catch (error) {
    setMessage("auth-message", firebaseError(error));
  } finally {
    button.disabled = false;
  }
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

async function logout() {
  await signOut(auth);
  if (!document.getElementById("auth-view")) location.href = "index.html";
}

function showBoardsView() {
  document.getElementById("auth-view")?.classList.add("hidden");
  document.getElementById("boards-view")?.classList.remove("hidden");
}

function showAuthView() {
  document.getElementById("auth-view")?.classList.remove("hidden");
  document.getElementById("boards-view")?.classList.add("hidden");
}

function loadBoards() {
  unsubscribeBoards?.();
  unsubscribeBoards = onValue(ref(database, `userBoards/${currentUser.uid}`), async (snapshot) => {
    const access = snapshot.val() || {};
    const boardEntries = await Promise.all(Object.keys(access).map(async (id) => {
      const boardSnapshot = await get(ref(database, `boards/${id}`));
      return boardSnapshot.exists() ? { id, ...boardSnapshot.val(), role: access[id].role } : null;
    }));
    renderBoards(boardEntries.filter(Boolean).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  }, (error) => setMessage("boards-message", firebaseError(error)));
}

function renderBoards(boards) {
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
        actionButton("Xóa", "mini-button danger", () => deleteBoard(board.id, board))
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
}

async function createBoard(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const title = form.title.value.trim();
  if (!title) return;
  try {
    const boardId = push(ref(database, "boards")).key;
    const listId = push(ref(database, `lists/${boardId}`)).key;
    const createdAt = Date.now();
    await set(ref(database, `boards/${boardId}`), {
      title,
      ownerId: currentUser.uid,
      ownerEmail: currentUser.email,
      createdAt
    });
    await update(ref(database), {
      [`userBoards/${currentUser.uid}/${boardId}`]: { role: "owner", createdAt },
      [`lists/${boardId}/${listId}`]: { title: "Công việc", position: 0 }
    });
    form.reset();
  } catch (error) {
    setMessage("boards-message", firebaseError(error));
  }
}

async function renameBoard(board = currentBoard) {
  const title = await askText("Đổi tên board", "Nhập tên mới cho board này.", board.title);
  if (!title) return;
  try {
    await set(ref(database, `boards/${board.id}/title`), title);
  } catch (error) {
    setMessage(currentBoard ? "board-message" : "boards-message", firebaseError(error));
  }
}

async function deleteBoard(boardId, board = currentBoard) {
  if (!await askConfirm("Xóa board", "Xóa board này và toàn bộ cột/card bên trong?")) return;
  try {
    const changes = {
      [`boards/${boardId}`]: null,
      [`lists/${boardId}`]: null,
      [`cards/${boardId}`]: null,
      [`userBoards/${board.ownerId}/${boardId}`]: null
    };
    Object.keys(board.members || {}).forEach((uid) => { changes[`userBoards/${uid}/${boardId}`] = null; });
    await update(ref(database), changes);
    if (currentBoard) location.href = "index.html";
  } catch (error) {
    setMessage(currentBoard ? "board-message" : "boards-message", firebaseError(error));
  }
}

function clearBoardListeners() {
  boardUnsubscribers.forEach((unsubscribe) => unsubscribe());
  boardUnsubscribers = [];
}

function loadBoard(boardId) {
  currentBoardId = boardId;
  clearBoardListeners();
  boardUnsubscribers.push(onValue(ref(database, `boards/${boardId}`), (snapshot) => {
    if (!snapshot.exists()) {
      setMessage("board-message", "Không tìm thấy board hoặc bạn không có quyền truy cập.");
      return;
    }
    currentBoard = { id: boardId, ...snapshot.val() };
    currentBoard.role = currentBoard.ownerId === currentUser.uid ? "owner" : "member";
    document.getElementById("current-board-title").textContent = currentBoard.title;
    document.title = `${currentBoard.title} · Trello Pro`;
    ["share-toggle", "edit-board-button", "delete-board-button"].forEach((id) => {
      document.getElementById(id).classList.toggle("hidden", currentBoard.role !== "owner");
    });
    renderMembers();
  }, () => setMessage("board-message", "Bạn không có quyền truy cập board này.")));

  boardUnsubscribers.push(onValue(ref(database, `lists/${boardId}`), (snapshot) => {
    boardLists = collection(snapshot);
    renderLists();
  }));
  boardUnsubscribers.push(onValue(ref(database, `cards/${boardId}`), (snapshot) => {
    boardCards = collection(snapshot);
    renderLists();
  }));
}

function renderMembers() {
  if (!currentBoard) return;
  const container = document.getElementById("members");
  container.replaceChildren();
  const members = [
    { id: currentBoard.ownerId, email: currentBoard.ownerEmail, role: "owner" },
    ...Object.entries(currentBoard.members || {}).map(([id, member]) => ({ id, ...member, role: "member" }))
  ];
  members.forEach((member) => {
    const row = document.createElement("div");
    row.className = "member-row";
    const label = document.createElement("span");
    label.textContent = `${member.email} · ${member.role === "owner" ? "Chủ board" : "Thành viên"}`;
    row.append(label);
    if (currentBoard.role === "owner" && member.role === "member") {
      row.append(actionButton("Gỡ", "mini-button danger", () => removeMember(member.id)));
    }
    container.append(row);
  });
}

async function shareBoard(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.email.value.trim().toLowerCase();
  try {
    const directory = await get(ref(database, `emailDirectory/${emailKey(email)}`));
    if (!directory.exists()) throw new Error("Email này chưa đăng ký tài khoản.");
    const member = directory.val();
    if (member.uid === currentBoard.ownerId) throw new Error("Bạn đã là chủ board.");
    await update(ref(database), {
      [`boards/${currentBoard.id}/members/${member.uid}`]: { email: member.email },
      [`userBoards/${member.uid}/${currentBoard.id}`]: { role: "member", createdAt: Date.now() }
    });
    form.reset();
  } catch (error) {
    setMessage("board-message", firebaseError(error));
  }
}

async function removeMember(uid) {
  if (!await askConfirm("Gỡ thành viên", "Gỡ thành viên này khỏi board?", "Gỡ")) return;
  try {
    await update(ref(database), {
      [`boards/${currentBoard.id}/members/${uid}`]: null,
      [`userBoards/${uid}/${currentBoard.id}`]: null
    });
  } catch (error) {
    setMessage("board-message", firebaseError(error));
  }
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

function renderLists() {
  const board = document.getElementById("board");
  if (!board) return;
  sortableInstances.forEach((instance) => instance.destroy());
  sortableInstances = [];
  board.replaceChildren();
  boardLists.forEach((list) => {
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
    boardCards.filter((card) => card.listId === list.id).forEach((card) => cardList.append(renderCard(card)));

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

async function createList(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const listId = push(ref(database, `lists/${currentBoardId}`)).key;
  try {
    await set(ref(database, `lists/${currentBoardId}/${listId}`), {
      title: form.title.value.trim(),
      position: boardLists.length
    });
    form.reset();
  } catch (error) { setMessage("board-message", firebaseError(error)); }
}

async function editList(list) {
  const title = await askText("Đổi tên cột", "Nhập tên mới cho cột này.", list.title);
  if (!title) return;
  try { await set(ref(database, `lists/${currentBoardId}/${list.id}/title`), title); }
  catch (error) { setMessage("board-message", firebaseError(error)); }
}

async function deleteList(listId) {
  if (boardLists.length <= 1) return setMessage("board-message", "Board phải có ít nhất một cột.");
  if (!await askConfirm("Xóa cột", "Xóa cột này và toàn bộ card bên trong?")) return;
  const changes = { [`lists/${currentBoardId}/${listId}`]: null };
  boardCards.filter((card) => card.listId === listId).forEach((card) => {
    changes[`cards/${currentBoardId}/${card.id}`] = null;
  });
  try { await update(ref(database), changes); }
  catch (error) { setMessage("board-message", firebaseError(error)); }
}

async function createCard(event, listId) {
  event.preventDefault();
  const form = event.currentTarget;
  const cardId = push(ref(database, `cards/${currentBoardId}`)).key;
  try {
    await set(ref(database, `cards/${currentBoardId}/${cardId}`), {
      listId,
      title: form.title.value.trim(),
      position: boardCards.filter((card) => card.listId === listId).length
    });
    form.reset();
  } catch (error) { setMessage("board-message", firebaseError(error)); }
}

async function editCard(card) {
  const title = await askText("Sửa card", "Nhập nội dung mới cho card này.", card.title);
  if (!title) return;
  try { await set(ref(database, `cards/${currentBoardId}/${card.id}/title`), title); }
  catch (error) { setMessage("board-message", firebaseError(error)); }
}

async function deleteCard(cardId) {
  if (!await askConfirm("Xóa card", "Xóa card này?")) return;
  try { await remove(ref(database, `cards/${currentBoardId}/${cardId}`)); }
  catch (error) { setMessage("board-message", firebaseError(error)); }
}

function enableDrag() {
  if (!window.Sortable) return;
  const board = document.getElementById("board");
  sortableInstances.push(new Sortable(board, {
    animation: 180,
    direction: "vertical",
    draggable: ".list",
    handle: ".list-header",
    onEnd: saveBoardOrder
  }));
  board.querySelectorAll(".cards").forEach((container) => {
    sortableInstances.push(new Sortable(container, {
      group: "cards",
      animation: 180,
      direction: "vertical",
      draggable: ".card",
      filter: "button,input",
      onEnd: saveBoardOrder
    }));
  });
}

async function saveBoardOrder() {
  const changes = {};
  [...document.querySelectorAll("#board > .list")].forEach((list, listPosition) => {
    changes[`lists/${currentBoardId}/${list.dataset.id}/position`] = listPosition;
    [...list.querySelectorAll(".cards > .card")].forEach((card, cardPosition) => {
      changes[`cards/${currentBoardId}/${card.dataset.id}/listId`] = list.dataset.id;
      changes[`cards/${currentBoardId}/${card.dataset.id}/position`] = cardPosition;
    });
  });
  try { await update(ref(database), changes); }
  catch (error) { setMessage("board-message", firebaseError(error)); }
}

function initIndex() {
  if (!document.getElementById("auth-view")) return;
  document.getElementById("login-form").addEventListener("submit", login);
  document.getElementById("register-form").addEventListener("submit", register);
  document.getElementById("show-register").addEventListener("click", showRegisterForm);
  document.getElementById("show-login").addEventListener("click", showLoginForm);
  document.getElementById("board-form").addEventListener("submit", createBoard);
  document.getElementById("logout-button").addEventListener("click", logout);
}

function initBoard() {
  if (!document.getElementById("board")) return;
  document.getElementById("logout-button").addEventListener("click", logout);
  document.getElementById("list-form").addEventListener("submit", createList);
  document.getElementById("share-form").addEventListener("submit", shareBoard);
  document.getElementById("share-toggle").addEventListener("click", () => document.getElementById("share-panel").classList.toggle("hidden"));
  document.getElementById("edit-board-button").addEventListener("click", () => renameBoard());
  document.getElementById("delete-board-button").addEventListener("click", () => deleteBoard(currentBoard.id));
}

initIndex();
initBoard();

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (document.getElementById("auth-view")) {
    if (user) {
      showBoardsView();
      loadBoards();
    } else {
      unsubscribeBoards?.();
      showAuthView();
    }
    return;
  }

  if (!user) {
    location.href = "index.html";
    return;
  }
  const boardId = new URLSearchParams(location.search).get("id");
  if (!boardId || !/^[A-Za-z0-9_-]+$/.test(boardId)) {
    setMessage("board-message", "Board không hợp lệ.");
    return;
  }
  loadBoard(boardId);
});
