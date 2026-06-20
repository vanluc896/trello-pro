# Trello Pro

## Kiến trúc hiện tại

- `frontend/` là ứng dụng người dùng đang dùng **Firebase Authentication** và **Firebase Realtime Database**.
- `backend/` là ứng dụng **Express + MySQL + JWT** dùng cho mục đích **test**.

> Hiện tại frontend và backend chưa được tích hợp với nhau.
> Frontend vẫn hoạt động độc lập với Firebase, còn backend là API thử nghiệm riêng.

## Chạy backend test

1. Cài dependencies:
   ```bash
   npm install
   ```
2. Thiết lập biến môi trường MySQL và JWT nếu cần, ví dụ:
   ```powershell
   $env:DB_HOST = "localhost"
   $env:DB_NAME = "trello_pro"
   $env:DB_USER = "root"
   $env:DB_PASSWORD = ""
   $env:JWT_SECRET = "your-secret"
   ```
3. Khởi động backend:
   ```bash
   npm run start:backend
   ```

Backend sẽ chạy ở `http://localhost:3000` và hiện có các route API tại `/api/auth`, `/api/board`, `/api/list`, `/api/card`.

## Chạy frontend Firebase

Frontend không cần backend để hoạt động. Mở trực tiếp `frontend/index.html` hoặc host thư mục `frontend/` bằng một static server.

## Scripts hữu ích

- `npm run start` hoặc `npm run start:backend` — khởi backend test.
- `npm test` — kiểm tra cú pháp cho backend và `frontend/app.js`.

## Ghi chú

- Nếu bạn muốn tích hợp frontend với backend MySQL, cần chuyển `frontend/app.js` sang gọi các API backend thay vì Firebase.
- Nếu bạn muốn giữ frontend Firebase, backend hiện tại chỉ dùng để test riêng và không ảnh hưởng đến phần UI.
