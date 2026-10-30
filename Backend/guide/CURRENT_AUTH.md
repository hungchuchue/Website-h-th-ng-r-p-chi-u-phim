# Chạy Backend hiện tại

Backend hiện chỉ mount API đăng nhập admin lấy token, health và Swagger. Đăng nhập đọc cấu hình từ `.env`, không tạo tài khoản hoặc phiên trong database.

```bash
nvm use
npm ci
npm run build
npm run dev
```

Lệnh chạy được từ thư mục gốc hoặc `Backend`. Ưu tiên đọc `Backend/.env`; nếu chưa có, đọc `.env` tại thư mục gốc. Biến shell được ưu tiên. Không ghi đè `.env` hiện có.

Các biến bắt buộc: `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`. Server vẫn kiểm tra kết nối PostgreSQL khi khởi động. `ADMIN_EMAIL` có thể là email hoặc tên định danh admin. `ADMIN_PASSWORD` hỗ trợ `pbkdf2_sha256$iterations$salt$hash` với digest SHA-256 dạng base64url và hash hex cũ của `hashPassword`; không chấp nhận mật khẩu plaintext. `ADMIN_JWT_EXPIRES_IN` mặc định `15m`; `PORT` mặc định `3000`.

`POST /api/v1/auth/login` nhận `{ "email": "admin", "password": "mật khẩu của bạn" }`. Gửi mật khẩu gốc, không gửi hash. Email được trim và chuyển về chữ thường; mật khẩu giữ nguyên. Đăng nhập đúng trả HTTP 200 với `{ code, message, data: { token, expiresIn } }`; sai thông tin trả 401; thiếu email hoặc password trả 400.

Swagger ở `http://localhost:<PORT>/api-docs/`: mở **Auth → POST /auth/login → Try it out**, nhập email và mật khẩu thật rồi bấm **Execute**. Giá trị `admin` và `string` trong mẫu chỉ là ví dụ. Dùng giá trị `data.token` làm Bearer JWT khi tích hợp API sau này.

`/health` kiểm tra HTTP. Build sinh Swagger và sao chép tài liệu vào `dist/config`. `TRUST_PROXY=false` khi chạy trực tiếp; đặt đúng số hop nếu triển khai qua proxy. Server đóng HTTP và pool PostgreSQL khi nhận SIGINT/SIGTERM.

`npm run auth:create-admin` nhập mật khẩu ẩn và in cấu hình đã hash để bạn tự cập nhật `.env`; lệnh không sửa file hay tạo tài khoản DB. Không cần chạy migration để đăng nhập admin. Sau khi thay `.env`, khởi động lại server.
