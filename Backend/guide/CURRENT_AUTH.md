# Chạy Backend hiện tại

Backend hiện chỉ mount API đăng nhập admin lấy token, health và Swagger. Đăng nhập đọc cấu hình từ `.env`, không tạo tài khoản hoặc phiên trong database.

```bash
cd Backend
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

Chạy các lệnh npm trong thư mục `Backend`, dùng Node.js 24.14.0 trở lên. `npm run dev` chạy trực tiếp `src/index.ts` và tự khởi động lại khi mã nguồn thay đổi; `npm start` chạy bản đã build tại `dist/src/index.js`. Cả hai đọc `Backend/.env`. Biến shell được ưu tiên. Không ghi đè `.env` hiện có. Nếu cổng đã được ứng dụng khác sử dụng, dừng đúng ứng dụng đó trước khi chạy lại.

Các biến bắt buộc: `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`. Server vẫn kiểm tra kết nối PostgreSQL khi khởi động. `ADMIN_EMAIL` có thể là email hoặc tên định danh admin. `ADMIN_PASSWORD` hỗ trợ `pbkdf2_sha256$iterations$salt$hash` với digest SHA-256 dạng base64url và hash hex cũ của `hashPassword`; không chấp nhận mật khẩu plaintext. `ADMIN_JWT_EXPIRES_IN` mặc định `15m`; `PORT` mặc định `3002` và có thể thay đổi trong `.env`.

`POST /api/v1/auth/login` nhận `{ "email": "admin", "password": "mật khẩu của bạn" }`. Gửi mật khẩu gốc, không gửi hash. Email được trim và chuyển về chữ thường; mật khẩu giữ nguyên. Đăng nhập đúng trả HTTP 200 với `{ code, message, data: { accessToken, tokenType, expiresIn } }`; sai thông tin trả 401; thiếu hoặc sai kiểu email/password trả 400.

Swagger ở `http://localhost:<PORT>/api-docs/`: mở **Auth → POST /auth/login → Try it out**, nhập email và mật khẩu thật rồi bấm **Execute**. Giá trị trong mẫu chỉ là ví dụ. Dùng giá trị `data.accessToken` làm Bearer JWT khi tích hợp API sau này. Trong development, Swagger dùng cổng hiện tại của server.

`/health` kiểm tra HTTP. Build sinh Swagger và sao chép tài liệu vào `dist/src/config`. Server đóng HTTP và pool PostgreSQL khi nhận SIGINT/SIGTERM.

Không cần chạy migration hoặc tạo tài khoản DB để đăng nhập admin. Tài khoản đăng nhập lấy từ các biến `ADMIN_*` trong `.env`. Sau khi thay `.env`, khởi động lại server. Thư viện BytePlus chỉ cần `BYTEPLUS_BASE_URL` và `BYTEPLUS_API_KEY` khi gọi `submitByteplusTask`; thiếu hai biến này sẽ báo lỗi cấu hình rõ ràng.

`npm test` dùng tài khoản giả trong process kiểm thử và mock khóa AdMob, không kết nối database hay gọi AdMob/BytePlus thật.
