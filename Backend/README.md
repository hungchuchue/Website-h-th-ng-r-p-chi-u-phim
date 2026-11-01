# AI Photo Collage Backend

Dự án này là Backend API được phát triển bằng **Express** và **TypeScript** phục vụ cho ứng dụng AI Photo/Collage Generation. Hệ thống hỗ trợ xử lý tác vụ tạo ảnh bằng AI (như Flux Schnell, BytePlus, Face Swap), quản lý templates, điểm danh hàng ngày (check-in), tích hợp quảng cáo (AdMob), và lưu trữ đám mây (Cloudflare R2/AWS S3).

---

## 📁 Cấu trúc Thư mục Dự án

Dưới đây là sơ đồ cấu trúc thư mục của dự án và giải thích chi tiết ý nghĩa của từng phần:

```text
ai-photo-collage-backend/
├── migrations/                  # Các file SQL thiết lập và cập nhật cấu trúc cơ sở dữ liệu
│   ├── 001_initial_schema.sql   # Thiết lập schema ban đầu
│   
│
│
├── src/                         # Thư mục chứa mã nguồn chính của ứng dụng
│   ├── index.ts                 # Điểm khởi chạy ứng dụng (Entry Point)
│   ├── app.ts                   # Cấu hình Express app, middleware chung và định tuyến chính
│   │
│   ├── config/                  # Cấu hình hệ thống và các kết nối bên thứ ba
│   │   ├── database.ts          # Cấu hình kết nối cơ sở dữ liệu (PostgreSQL)
│   │   ├── swagger.ts           # Cấu hình sinh tài liệu API (Swagger Autogen)
│   │   └── index.ts             # Các biến môi trường và thiết lập chung
│   │
│ 
│   │
│   ├── lib/                     # Tích hợp SDK hoặc APIs của bên thứ ba
│   │   ├── firebase.ts          # Firebase Admin SDK (xác thực, thông báo)
│

│   │
│   ├── middleware/              # Các bộ lọc trung gian xử lý Request & Response
│   │   ├── deviceAuth.ts        # Xác thực định danh thiết bị
│   │   ├── requireAuth.ts       # Xác thực token người dùng
│   │   ├── rateLimiter.ts       # Giới hạn tần suất gửi yêu cầu (Rate Limit)
│   │   └── errorHandler.ts      # Xử lý và chuẩn hóa lỗi tập trung
│   │
│   ├── repositories/            # Lớp truy vấn trực tiếp với Cơ sở dữ liệu (Data Access Layer)
│   │   ├── ads.repository.ts
│   │   ├── category.repository.ts
│   │   ├── checkin.repository.ts
│   │   ├── giftCode.repository.ts
│   │   └── template.repository.ts
│   │
│   ├── routes/                  # Định nghĩa các Endpoint API (Routes)
│   │   ├── index.ts             # Quản lý và gộp các router con
│   │   ├── ads.routes.ts        # Route cấu hình/quản lý quảng cáo
│   │   ├── auth.routes.ts       # Route xác thực người dùng/thiết bị
│ 
│   │   └── ...                  # Các router khác (checkin, translate, v.v.)
│   │
│   ├── services/                # Lớp xử lý Logic nghiệp vụ (Business Logic Layer)
│   │   ├── auth.services.ts     # Xử lý đăng nhập, cấp token
│   │
│   │   ├── image.service.ts     # Logic xử lý và nén ảnh
│   │   └── ...                  # Các dịch vụ nghiệp vụ khác
│   │
│   ├── types/                   # Định nghĩa các Type/Interface cho TypeScript
│   │   ├── auth.types.ts
│   │   ├── database.ts          # Kiểu dữ liệu tương ứng với bảng trong DB
│   │   ├── requests.ts          # Định nghĩa kiểu dữ liệu cho Body/Query requests
│   │   └── responses.ts         # Định nghĩa kiểu dữ liệu phản hồi từ API
│   │
│   └── utils/                   # Các hàm tiện ích dùng chung
│       ├── cache.ts             # Quản lý bộ nhớ đệm (Node Cache)
│       ├── logger.ts            # Ghi log hệ thống
│       └── validation.ts        # Xác thực tính hợp lệ của dữ liệu đầu vào
│
├
├── docker-compose.yml           # Khởi chạy ứng dụng và DB PostgreSQL thông qua Docker Compose
├── package.json                 # Quản lý dependencies và các script chạy dự án
├── tsconfig.json                # Cấu hình trình biên dịch TypeScript
└── .env.example                 # File mẫu cấu hình các biến môi trường
```

---

## 🛠️ Hướng dẫn Khởi chạy Dự án

### 1. Yêu cầu hệ thống
- **Node.js** (Phiên bản v18 trở lên)
- **PostgreSQL** (Hoặc khởi chạy thông qua Docker)

### 2. Cài đặt Dependencies
Cài đặt toàn bộ các gói thư viện cần thiết:
```bash
npm install
```

### 3. Cấu hình biến môi trường
Sao chép file cấu hình mẫu `.env.example` thành `.env` và điền đầy đủ các thông tin:
```bash
cp .env.example .env
```
*Lưu ý: Bạn cần cấu hình các khóa API bên thứ ba như Firebase, Cloudflare R2, và BytePlus để các tính năng AI hoạt động.*

### 4. Tạo tài liệu API (Swagger)
Sinh file Swagger để hỗ trợ tài liệu API chi tiết:
```bash
npm run swagger
```

### 5. Chạy dự án ở chế độ Development
Sử dụng `tsx` để theo dõi và chạy mã nguồn trực tiếp mà không cần compile trước:
```bash
npm run dev
```

### 6. Build và chạy Production
Biên dịch dự án sang JavaScript và khởi chạy:
```bash
npm run build
npm start
```