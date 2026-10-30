# Backend base auth

> Tài liệu này mô tả bản auth PostgreSQL trước đó. Backend hiện dùng auth admin từ `.env` theo code hiện có; xem [hướng dẫn hiện tại](CURRENT_AUTH.md).

Base dùng Node.js 24.14.0, Express 5, TypeScript và PostgreSQL. API đang hoạt động chỉ gồm auth, health, readiness và Swagger. Các file nghiệp vụ cũ vẫn giữ tại chỗ nhưng chưa được mount hoặc đưa vào build.


## 2. Cấu trúc thư mục dự án

Backend/
├── migrations/
│   ├── 001_initial_schema.sql
│   └── 002_crashlytics_issues.sql              # 🆕
│
├── src/
│   ├── index.ts                                # ✏️ start/stop crash poll job
│   ├── app.ts
│   │
│   ├── config/
│   │   ├── database.ts
│   │   ├── swagger.ts
│   │   ├── index.ts                            # ✏️ Crashlytics env
│   │   └── crashlytics.ts                      # 🆕 optional typed config
│   │
│   ├── jobs/
│   │   └── crashlyticsPoll.job.ts              # 🆕 Cron mỗi 5 phút
│   │
│   ├── lib/
│   │   ├── admbob.ts
│   │   ├── byteplus.ts
│   │   ├── firebase.ts
│   │   ├── r2.ts
│   │   ├── firebaseCrashlytics.ts               # 🆕 REST API
│   │   └── discordWebhook.ts                    # 🆕 Discord
│   │
│   ├── middleware/
│   │   ├── deviceAuth.ts
│   │   ├── requireAuth.ts
│   │   ├── rateLimiter.ts
│   │   └── errorHandler.ts
│   │
│   ├── repositories/
│   │   ├── ads.repository.ts
│   │   ├── category.repository.ts
│   │   ├── checkin.repository.ts
│   │   ├── giftCode.repository.ts
│   │   ├── template.repository.ts
│   │   └── crashlytics.repository.ts            # 🆕 DB + dedupe
│   │
│   ├── routes/
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   └── ...
│   │
│   ├── services/
│   │   ├── auth.services.ts
│   │   └── crashlytics.service.ts               # 🆕 business logic
│   │
│   ├── types/
│   │   ├── auth.types.ts
│   │   ├── database.ts
│   │   ├── requests.ts
│   │   ├── responses.ts
│   │   └── crashlytics.types.ts                 # 🆕
│   │
│   └── utils/
│       ├── cache.ts
│       ├── logger.ts
│       ├── validation.ts
│       └── crashlyticsEmbed.ts                  # 🆕
│
├── guide/
│   └── crashlytics-discord-guide.md             # 🆕 optional
│
├── package.json                                 # ✏️
├── package-lock.json                            # ✏️ if dependency changes
├── tsconfig.json
├── .env
├── .env.example                                 # ✏️
└── .gitignore
## Cài đặt và chạy

Chạy tại thư mục gốc `crash-mobile-tool`:

```bash
nvm use
npm ci
# Chỉ tạo .env mẫu khi chưa có .env; không ghi đè file hiện tại.
[ -f .env ] || cp Backend/.env.example .env
npm run db:migrate
npm run auth:create-admin
npm run dev
```

Ứng dụng luôn đọc `.env` tại thư mục gốc, kể cả khi chạy lệnh từ `Backend`. Biến môi trường shell được ưu tiên. Node và npm đã được cài trên máy hiện tại. `npm ci` dùng lockfile; `npm install` dùng khi chủ động thay đổi dependency.

`DATABASE_URL` phải trỏ tới PostgreSQL đang chạy. Tài khoản DB cần quyền tạo schema và bảng. Migration chỉ tạo schema `auth_base` với `users`, `sessions`, `refresh_tokens`, `schema_migrations`; không thay đổi các bảng ứng dụng cũ. Chạy migration nhiều lần không áp dụng lại SQL đã chạy; không sửa migration đã áp dụng, hãy thêm file SQL mới. Server không tự chạy migration.

Lệnh tạo admin yêu cầu terminal tương tác, nhập email, mật khẩu ẩn và xác nhận mật khẩu. Mật khẩu dài 12–128 ký tự, giữ nguyên khoảng trắng. Email được chuẩn hóa chữ thường. Lệnh không nâng role hoặc ghi đè tài khoản đã tồn tại. `ADMIN_EMAIL` cũ chỉ gợi ý email; `ADMIN_PASSWORD` cũ không còn được dùng để đăng nhập. Đăng nhập mới dùng tài khoản PostgreSQL.

Để bootstrap tự động với `ADMIN_EMAIL` hiện có, dùng `npm run auth:create-admin -- --generate`. Lệnh tạo mật khẩu ngẫu nhiên và lưu vào `Backend/.admin-credentials.json` với quyền `0600`, được bỏ qua Git; không in mật khẩu ra log. Lệnh từ chối ghi đè file này hoặc tài khoản đã tồn tại. Chuyển mật khẩu vào kho lưu trữ phù hợp rồi xóa file khi không cần nữa.

Có thể chỉ định email mà không thay đổi `.env`: `npm run auth:create-admin -- --generate --email admin@example.com`. Nếu `ADMIN_EMAIL` cũ là tên đăng nhập thay vì email hợp lệ, bắt buộc nhập email mới.

API mặc định ở `http://localhost:3002`; các giá trị `HOST` và `PORT` trong `.env` được giữ. Swagger tại `/api-docs`, OpenAPI JSON tại `/api-docs.json`.

## Cấu hình

Xem `Backend/.env.example`. `JWT_SECRET` cần tối thiểu 32 ký tự ngẫu nhiên; khi chưa có, base đọc `ADMIN_JWT_SECRET` hiện tại. `ACCESS_TOKEN_TTL_SECONDS` mặc định lấy `ADMIN_JWT_EXPIRES_IN` hoặc 900 giây. `REFRESH_TOKEN_TTL_SECONDS` mặc định 2.592.000 giây (30 ngày).

Tạo secret mới bằng:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

`DB_REQUIRE_SSL=true` bật kiểm tra chứng chỉ TLS của PostgreSQL; mặc định bật trong production. Tham số TLS trong `DATABASE_URL` cũng có thể ảnh hưởng cấu hình của driver `pg`. Cấu hình CA phù hợp với nhà cung cấp DB khi cần; không tắt kiểm tra chứng chỉ để xử lý lỗi tùy tiện.

`TRUST_PROXY=false` khi chạy trực tiếp. Khi triển khai qua proxy, đặt đúng số hop tin cậy, ví dụ `1`. Rate limit đăng ký, đăng nhập và refresh là 30 yêu cầu/phút/IP, dùng chung một bộ đếm trong process. Base dùng một process; triển khai nhiều instance cần bổ sung shared rate-limit store.

`CORS_ORIGINS` rỗng cho phép mọi origin và không dùng cookie. Có thể giới hạn bằng danh sách origin cách nhau bởi dấu phẩy. Dùng HTTPS khi triển khai. `.env`, dependency và build artifact được bỏ qua Git.

## API auth

Mọi phản hồi có `{ code, message, data }`, trong đó `code` khớp HTTP status. Các lỗi không trả chi tiết nội bộ. Tất cả endpoint auth ở `/api/v1/auth`.

| Method | Đường dẫn | Body / header | Kết quả |
| --- | --- | --- | --- |
| POST | `/register` | `email`, `password`, `displayName` tùy chọn | 201, tạo user và đăng nhập |
| POST | `/login` | `email`, `password` | 200, đăng nhập user/admin |
| GET | `/me` | `Authorization: Bearer <accessToken>` | 200, thông tin tài khoản |
| POST | `/refresh` | `refreshToken` | 200, bộ token mới |
| POST | `/logout` | `refreshToken` | 200, thu hồi phiên hiện tại |

Đăng ký, đăng nhập và refresh trả:

```json
{
  "code": 200,
  "message": "Login successful.",
  "data": {
    "accessToken": "JWT_ACCESS_TOKEN",
    "refreshToken": "64-hex-characters",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "displayName": null,
      "role": "user",
      "createdAt": "2026-10-01T00:00:00.000Z"
    }
  }
}
```

Chỉ endpoint register có status/code 201. Trường `role` và trường không được khai báo trong body sẽ bị từ chối. Không có endpoint `/api/v1/admin/auth/login` cũ.

Ví dụ tạo user và đăng nhập:

```bash
curl -X POST http://localhost:3002/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"ExamplePassword123!","displayName":"User"}'

curl -X POST http://localhost:3002/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"ExamplePassword123!"}'

curl http://localhost:3002/api/v1/auth/me \
  -H 'Authorization: Bearer <accessToken>'

curl -X POST http://localhost:3002/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'

curl -X POST http://localhost:3002/api/v1/auth/logout \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```

Refresh token chỉ lưu hash SHA-256 trong DB, mật khẩu dùng Argon2id với salt ngẫu nhiên. Mỗi đăng nhập tạo một phiên riêng; refresh không kéo dài thời hạn tuyệt đối của phiên. Client phải lưu bộ token mới sau refresh và chỉ thực hiện một refresh tại một thời điểm. Token cũ bị dùng lại, kể cả do hai request refresh đồng thời, sẽ thu hồi cả phiên. Logout thu hồi access token ngay và không ảnh hưởng phiên khác. Logout lặp lại hoặc token đúng định dạng nhưng không tồn tại vẫn trả 200.

Mobile nên lưu refresh token trong kho bảo mật của hệ điều hành. Token được trao đổi qua JSON; base chưa dùng cookie. `X-Device-ID` chỉ là định danh, không thay thế Bearer token.

## Phân quyền và mở rộng

Để bảo vệ route mới, nối `requireAuth` rồi `requireRole('admin')`, hoặc dùng `requireAuthAdmin` tương thích. Middleware đọc trạng thái phiên, tài khoản và role hiện tại từ DB. Người dùng bị vô hiệu hóa không thể đăng nhập, refresh hoặc dùng access token cũ.

Các file chat, lockscreen, nội dung, AdMob, BytePlus và service admin cũ được giữ để tham khảo. Chúng có import thiếu và chưa thuộc base chạy. Khi phục hồi tính năng, bổ sung phụ thuộc, mount router chủ động và thêm entrypoint vào phạm vi typecheck nếu cần. Không đưa tất cả file cũ vào build trước khi sửa xong.

Base v1 chưa gồm Firebase, OTP, quên mật khẩu, xác minh email hoặc đăng nhập mạng xã hội. Lịch sử refresh token được giữ để phát hiện reuse; có thể bổ sung tác vụ dọn phiên hết hạn khi triển khai lâu dài.

## Kiểm thử và chạy bản build

```bash
npm run typecheck
npm run build
npm test
npm start
```

Kiểm thử tích hợp bắt buộc dùng PostgreSQL trong `DATABASE_URL`. Mỗi lần chạy tạo một schema `auth_test_<uuid>` riêng, áp dụng migration, kiểm thử rồi xóa đúng schema đó. Không tạo tài khoản test trong `auth_base`. Nếu process bị dừng cưỡng bức, schema test có thể còn lại; xác minh tên trước khi tự dọn. Lỗi DB hoặc thiếu quyền tạo schema sẽ làm test thất bại, không tự bỏ qua.

Build sinh Swagger và sao chép tài liệu vào `dist/config`. `/health` xác nhận process HTTP hoạt động; `/ready` kiểm tra kết nối DB. Process đóng HTTP server và connection pool khi nhận SIGINT/SIGTERM, với timeout 10 giây.

Nếu startup thất bại, kiểm tra cấu hình, quyền DB và migration. Log không in mật khẩu, token hoặc chuỗi kết nối. Với lỗi cài native dependency, `argon2` có binary macOS ARM64; xác minh Node và hệ điều hành tương thích trước khi biên dịch từ source.


# Crash Mobile Tool — auth base

Backend Express/TypeScript/PostgreSQL chạy auth admin hiện có, health và Swagger. Các điểm tích hợp nghiệp vụ được giữ tại chỗ.

Xem [hướng dẫn Backend hiện tại](Backend/guide/CURRENT_AUTH.md) để cấu hình, gọi API và kiểm thử.

```bash
nvm use
npm ci
npm run db:migrate
npm run auth:create-admin
npm run dev
```

Giữ `.env` hiện có; ưu tiên `Backend/.env`, sau đó `.env` ở thư mục gốc. Swagger dùng port đã cấu hình, tại đường dẫn `/api-docs`.


# Hướng dẫn triển khai: Crashlytics → Discord (Backend TypeScript)

Tài liệu này dùng để **giao việc cho AI lập trình (Claude Code, Cursor, v.v.) hoặc cho đồng nghiệp** theo từng phần nhỏ. Mỗi phần có một **prompt** sao chép dán được, kèm **tiêu chí nghiệm thu**. Đặt file này trong `Backend/guide/`.

---

## 1. Mục tiêu

Khi mobile app có **crash mới** (hoặc crash cũ tái phát), backend tự gửi cảnh báo vào **kênh Discord**, không gửi trùng.

Phạm vi: chạy **trong Node.js backend hiện có**, lấy dữ liệu từ **Crashlytics REST API**, chống trùng bằng **PostgreSQL**, chạy định kỳ **1–5 phút**.

Ngoài phạm vi: thay đổi code mobile app; thống kê/biểu đồ crash; báo từng lần user crash (hệ thống báo theo **issue**, tức nhóm lỗi).

## 2. Luồng chạy

```
Mobile App bị crash
       ↓
Firebase Crashlytics
       ↓
Crashlytics REST API
       ↓
Node.js Backend
       ↓
Cron 1–5 phút
       ↓
Lọc FATAL / crash mới
       ↓
PostgreSQL: kiểm tra + chống trùng
       ↓
Discord Webhook
       ↓
Discord Channel
```

## 3. Bản đồ vào cấu trúc repo hiện có

Cấu trúc hiện tại của `Backend/` (theo ảnh chụp): `guide`, `migrations`, `src/{config, lib, middleware, repositories, routes, services, types, utils}`, `src/app.ts`, `src/index.ts`, `.env.example`, `package.json`, `tsconfig.json`.

| Thư mục | File mới / sửa | Trách nhiệm (chỉ làm đúng việc này) |
|---|---|---|
| `migrations/` | 1 migration mới | Tạo bảng `crashlytics_issues`, `crashlytics_poller_state` |
| `src/config/` | `crashlytics.ts` | Đọc và kiểm tra biến môi trường, xuất object cấu hình có kiểu |
| `src/types/` | `crashlytics.ts` | Kiểu dữ liệu: issue từ API, alert, dòng DB |
| `src/lib/` | `crashlyticsClient.ts` | Lấy token Google, gọi REST API `topIssues` (phân trang, timeout) |
| `src/lib/` | `discordClient.ts` | Gửi webhook, chia lô 10 embed, xử lý 429 |
| `src/utils/` | `crashlyticsEmbed.ts` | Hàm thuần: cắt chuỗi, dựng embed Discord từ alert |
| `src/repositories/` | `crashlyticsRepository.ts` | Mọi câu SQL: khoá, tra issue đã biết, ghi (upsert), trạng thái lần chạy |
| `src/services/` | `crashlyticsAlertService.ts` | Logic nghiệp vụ: lọc, chống trùng, gửi, ghi DB |
| `src/jobs/` (thư mục mới, trừ khi repo đã có chỗ chạy định kỳ) | `crashlyticsJob.ts` | Hẹn giờ, chống chạy chồng trong tiến trình, dừng êm |
| `src/routes/` (tuỳ chọn) | `crashlyticsAdmin.ts` | Endpoint nội bộ: chạy thủ công, gửi tin thử |
| `src/index.ts` / `src/app.ts` | sửa nhỏ | Khởi động job khi boot, dừng khi tắt server |
| gốc `Backend/` | `.env.example` | Thêm biến mới |

Nguyên tắc tầng: **routes → services → repositories / lib**. `services` không viết SQL; `repositories` không gọi HTTP; `lib` không biết nghiệp vụ.

## 4. Biến môi trường mới

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `CRASHLYTICS_ENABLED` | Không | `false` | Bật/tắt toàn bộ tính năng (tránh gửi nhầm ở môi trường dev) |
| `CRASHLYTICS_PROJECT` | Khi bật | | Project number (khuyên dùng) hoặc project id |
| `CRASHLYTICS_APP_ID` | Khi bật | | App ID dạng `1:123456789:android:abcdef` |
| `CRASHLYTICS_DISCORD_WEBHOOK_URL` | Khi bật | | URL webhook của kênh Discord |
| `CRASHLYTICS_POLL_INTERVAL_MIN` | Không | `5` | Chu kỳ chạy (1–5 phút) |
| `CRASHLYTICS_LOOKBACK_MIN` | Không | `30` | Mỗi lần quét lại bao nhiêu phút gần nhất (nên gấp vài lần chu kỳ) |
| `CRASHLYTICS_ERROR_TYPES` | Không | `FATAL` | `FATAL`, `NON_FATAL`, `ANR`, cách nhau bằng dấu phẩy |
| `CRASHLYTICS_ACCESS_TOKEN` | Không | | Token thủ công, **chỉ để thử**, hết hạn sau khoảng 1 giờ |
| `GOOGLE_APPLICATION_CREDENTIALS` | Không | | Biến chuẩn của Google, trỏ tới file service account |

Kết nối PostgreSQL: **dùng cấu hình DB sẵn có của backend**, không thêm biến mới.

## 5. Dữ liệu API và quy tắc nghiệp vụ

### 5.1 Gọi API

- Phương thức và đường dẫn: `GET https://firebasecrashlytics.googleapis.com/v1alpha/projects/{project}/apps/{appId}/reports/topIssues`
- Header: `Authorization: Bearer <token>`, `x-goog-user-project: <project>`
- Tham số: `pageSize=50`, `pageToken` (nếu có), `filter.interval.startTime`, `filter.interval.endTime` (ISO 8601), `filter.issue.states=OPEN`, `filter.issue.errorTypes` (lặp lại cho mỗi loại)
- Phản hồi: `groups[]`, mỗi group có `issue` (và số liệu `metrics`), cùng `nextPageToken`. Lấy tối đa 5 trang.

Các field của `issue` dùng đến: `id`, `title`, `subtitle`, `errorType`, `firstSeenTime`, `firstSeenVersion`, `lastSeenVersion`, `signals[].signal`, `uri`.

> **Chưa xác nhận với API thật:** tên field số liệu (dự kiến `metrics[0].eventsCount` và `metrics[0].impactedUsersCount`) và scope OAuth cần dùng. Code phải **chịu lỗi**: thiếu field thì hiển thị `0` hoặc `-`, không được làm sập job. Xác nhận bằng một lần gọi thật rồi sửa kiểu cho khớp.

### 5.2 Quy tắc chống trùng

| Tình huống | Hành động |
|---|---|
| Lần chạy đầu tiên (chưa có dòng trong `crashlytics_poller_state`) | Chỉ ghi nhớ issue đang có, **không gửi** |
| Issue chưa có trong DB **và** `firstSeenTime` ≥ (lần chạy trước − 1 phút) | Gửi cảnh báo **mới**, đặt `notified_new_at` |
| Issue có tín hiệu `SIGNAL_REGRESSED` và `notified_regression_at` còn trống | Gửi cảnh báo **tái phát**, đặt `notified_regression_at` |
| Issue đã báo | Không gửi lại |
| Gửi Discord lỗi | **Không ghi DB**, lần chạy sau tự thử lại |
| Có lần chạy khác đang giữ khoá | Bỏ qua lần này |

Thứ tự mỗi lần chạy: xin khoá → đọc trạng thái → gọi API → tra DB → tính danh sách cảnh báo → gửi Discord → ghi DB trong **một transaction** → nhả khoá.

### 5.3 Lược đồ dữ liệu

`crashlytics_issues` (khoá chính `app_id` + `issue_id`): `app_id text`, `issue_id text`, `title text`, `subtitle text`, `error_type text`, `first_seen_time timestamptz`, `last_seen_version text`, `notified_new_at timestamptz`, `notified_regression_at timestamptz`, `created_at timestamptz mặc định now()`, `last_seen_at timestamptz mặc định now()`.

`crashlytics_poller_state`: `app_id text` (khoá chính), `last_run timestamptz không null`.

## 6. Quy tắc chung (dán kèm mọi prompt)

```text
QUY TẮC CHUNG:
- Đọc code hiện có trước, bám đúng quy ước của repo (đặt tên, cách viết repository/service,
  xử lý lỗi, logger, kiểu import, ESM hay CommonJS theo tsconfig.json).
- TypeScript strict, không dùng any. Không thêm thư viện mới nếu chưa hỏi tôi.
- Không ghi log URL webhook, token hay mật khẩu.
- Chỉ sửa những file cần cho phần này; không refactor code không liên quan.
- Không commit file .env. Mọi biến mới phải thêm vào .env.example kèm chú thích.
- Cuối cùng: chạy typecheck/lint/build theo script có sẵn trong package.json và báo kết quả,
  liệt kê file đã tạo/sửa. Điều gì chưa chắc thì nói rõ, không tự suy diễn.
```

## 7. Các prompt theo từng phần

Thứ tự thực hiện: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (tuỳ chọn) → 9 → 10**. Làm xong và nghiệm thu từng phần rồi mới sang phần sau.

### Prompt 0. Khảo sát repo (chỉ đọc, chưa sửa gì)

```text
Hãy khảo sát thư mục Backend/ và KHÔNG sửa bất kỳ file nào. Báo cáo ngắn gọn:
1. Phiên bản Node (engines / .nvmrc), tsconfig.json dùng module ESM hay CommonJS, có sẵn fetch toàn cục không.
2. Thư viện truy cập PostgreSQL đang dùng (pg, knex, prisma, drizzle, typeorm...) và cách lấy kết nối/pool.
3. Công cụ migration trong thư mục migrations/ (tên file, cách viết up/down, cách chạy).
4. Một repository mẫu trong src/repositories/ và một service mẫu trong src/services/: cách đặt tên, cách export, cách xử lý lỗi.
5. Cách đọc cấu hình trong src/config/ (có dùng zod/envalid không, cách xuất object).
6. Thư viện logger đang dùng (nếu có) và cách gọi.
7. Cách đăng ký route trong src/app.ts và middleware xác thực có sẵn trong src/middleware/.
8. Repo đã có chỗ nào chạy tác vụ định kỳ (cron, node-cron, bull, setInterval) chưa?
9. Framework test hiện có (jest, vitest, mocha...) và vị trí file test; nếu chưa có thì nói rõ.
10. Cách khởi động và tắt server trong src/index.ts (có xử lý SIGTERM/SIGINT không).
Kết thúc bằng danh sách các điểm nào ảnh hưởng đến kế hoạch gồm: migration, config, lib, repository, service, job, route, test.

Nghiệm thu: có báo cáo đủ 10 mục, không có file nào bị thay đổi.
```

### Prompt 1. Migration tạo hai bảng

```text
[Dán QUY TẮC CHUNG ở mục 6]

Dựa trên báo cáo ở Prompt 0, tạo MỘT migration mới theo đúng công cụ và quy ước đặt tên trong migrations/.

Tạo hai bảng PostgreSQL:
1. crashlytics_issues
   - app_id text không null
   - issue_id text không null
   - title text, subtitle text, error_type text
   - first_seen_time timestamptz
   - last_seen_version text
   - notified_new_at timestamptz
   - notified_regression_at timestamptz
   - created_at timestamptz không null, mặc định now()
   - last_seen_at timestamptz không null, mặc định now()
   - khoá chính (app_id, issue_id)
2. crashlytics_poller_state
   - app_id text khoá chính
   - last_run timestamptz không null

Yêu cầu: có phần down (xoá cả hai bảng) nếu công cụ hỗ trợ; dùng IF NOT EXISTS khi phù hợp.

Nghiệm thu:
- Chạy migration thành công trên DB cục bộ, chạy lại không lỗi.
- Rollback (nếu có) xoá sạch hai bảng.
- Liệt kê lệnh bạn đã dùng để kiểm tra.
```

### Prompt 2. Cấu hình, kiểu dữ liệu, .env.example

```text
[Dán QUY TẮC CHUNG]

1. Tạo src/config/crashlytics.ts: đọc các biến môi trường sau theo đúng cách các file trong src/config/ đang làm:
   CRASHLYTICS_ENABLED (mặc định false), CRASHLYTICS_PROJECT, CRASHLYTICS_APP_ID,
   CRASHLYTICS_DISCORD_WEBHOOK_URL, CRASHLYTICS_POLL_INTERVAL_MIN (mặc định 5, giới hạn 1..60),
   CRASHLYTICS_LOOKBACK_MIN (mặc định 30), CRASHLYTICS_ERROR_TYPES (mặc định FATAL; chỉ nhận FATAL, NON_FATAL, ANR;
   tách bằng dấu phẩy), CRASHLYTICS_ACCESS_TOKEN (tuỳ chọn).
   Khi CRASHLYTICS_ENABLED=true mà thiếu project, app id hoặc webhook thì ném lỗi rõ ràng lúc khởi động
   (không để lỗi mơ hồ lúc chạy job). Khi false thì không bắt buộc biến nào.
2. Tạo src/types/crashlytics.ts với các kiểu:
   - CrashlyticsIssue: id, title?, subtitle?, errorType?, firstSeenTime?, firstSeenVersion?, lastSeenVersion?, signals?: {signal: string}[], uri?
   - CrashlyticsGroup: issue?: CrashlyticsIssue, metrics có thể là mảng hoặc object (chưa xác nhận), mọi field đều tuỳ chọn
   - TopIssuesResponse: groups?: CrashlyticsGroup[], nextPageToken?: string
   - AlertKind = "new" | "regression"; Alert: kind, issue, events: number, users: number
   - IssueRow: dòng đọc từ crashlytics_issues (dùng cho phần tra cứu)
3. Cập nhật .env.example: thêm tất cả biến trên kèm chú thích tiếng Việt ngắn; ghi rõ CRASHLYTICS_ACCESS_TOKEN chỉ để thử.

Nghiệm thu: typecheck/build pass; thử đặt ENABLED=true thiếu webhook thì app báo lỗi rõ khi khởi động; ENABLED=false thì app chạy bình thường không cần biến nào.
```

### Prompt 3. Discord client

```text
[Dán QUY TẮC CHUNG]

Tạo src/lib/discordClient.ts và src/utils/crashlyticsEmbed.ts.

discordClient.ts:
- Hàm sendEmbeds(webhookUrl: string, embeds: DiscordEmbed[], username?: string): Promise<void>.
- Discord chỉ cho tối đa 10 embed mỗi tin: chia lô 10 embed, gửi tuần tự.
- Dùng fetch toàn cục, timeout 10 giây (AbortSignal.timeout).
- Nếu HTTP 429: đọc retry_after (giây) từ body JSON, chờ rồi thử lại đúng 1 lần. Lỗi khác hoặc 429 lần hai: ném Error có mã trạng thái, KHÔNG đưa URL webhook vào thông báo lỗi.
- Hàm sendTestMessage(webhookUrl) gửi một embed xanh "Test kết nối Crashlytics → Discord".

crashlyticsEmbed.ts (hàm thuần, dễ test):
- truncate(text, max): cắt và thêm "…" khi vượt max; trả "-" khi rỗng.
- buildEmbed(alert: Alert): tiêu đề (≤256 ký tự) theo loại: "🚨 Crash mới" (FATAL), "⚠️ Non-fatal mới", "🧊 ANR mới", "🔁 Issue tái phát"; url = issue.uri nếu có;
  description = subtitle (≤500 ký tự); màu đỏ cho FATAL, vàng cho loại khác, tím cho tái phát;
  fields: Version ("firstSeenVersion – lastSeenVersion", dùng "?" nếu thiếu), Events, Users;
  footer: "Issue <id>".

Nghiệm thu: có test đơn vị (hoặc ít nhất script thử) cho truncate, buildEmbed, chia lô 11 embed thành 2 tin, và nhánh 429; tin thử gửi thành công vào kênh Discord thật khi tôi cung cấp webhook.
```

### Prompt 4. Crashlytics client

```text
[Dán QUY TẮC CHUNG]

Tạo src/lib/crashlyticsClient.ts.

Chức năng:
- getAccessToken(): ưu tiên CRASHLYTICS_ACCESS_TOKEN nếu có; nếu không dùng thư viện google-auth-library (Application Default Credentials).
  Nếu google-auth-library chưa có trong package.json thì HỎI TÔI trước khi thêm.
  Scope mặc định: https://www.googleapis.com/auth/cloud-platform (chưa xác nhận; nếu gặp lỗi thiếu scope hãy báo để thử scope firebase).
  Token phải được làm mới tự động (không cache thủ công vô thời hạn).
- fetchTopIssues({ lookbackMin, errorTypes }): Promise<CrashlyticsGroup[]>
  Gọi GET https://firebasecrashlytics.googleapis.com/v1alpha/projects/{project}/apps/{appId}/reports/topIssues
  Header: Authorization: Bearer <token>, x-goog-user-project: <project>.
  Query: pageSize=50; filter.interval.startTime = now - lookbackMin phút, filter.interval.endTime = now (ISO 8601);
  filter.issue.states=OPEN; filter.issue.errorTypes lặp lại cho mỗi loại; pageToken nếu có.
  Lấy tối đa 5 trang rồi gộp groups.
  Timeout mỗi request 15 giây.
- Lỗi HTTP: ném Error có mã và phần đầu nội dung phản hồi (không lộ token). Với 404 "Method not found" hãy thêm gợi ý trong thông báo:
  "Có báo cáo lỗi 404 khi dùng service account; thử Application Default Credentials bằng tài khoản người dùng (gcloud auth application-default login)".
  Với 403 gợi ý: bật Firebase Crashlytics API và kiểm tra quyền.
- Hàm tiện ích extractMetrics(group): đọc events và users một cách chịu lỗi (metrics là mảng hoặc object, thiếu thì 0).

Nghiệm thu: test với fetch giả (mock) cho phân trang, tham số query đúng, lỗi 404/403; chạy thử thật bằng một script hoặc endpoint tạm in JSON gốc (xoá sau khi dùng) rồi báo lại cấu trúc thực tế, đặc biệt tên field số events/users.
```

### Prompt 5. Repository (toàn bộ SQL)

```text
[Dán QUY TẮC CHUNG]

Tạo src/repositories/crashlyticsRepository.ts theo đúng phong cách các repository hiện có. Toàn bộ SQL nằm ở đây, dùng tham số hoá (không nối chuỗi).

Yêu cầu quan trọng về khoá: pg_try_advisory_lock là khoá THEO KẾT NỐI. Phải lấy MỘT kết nối riêng từ pool cho toàn bộ một lần chạy
(xin khoá, đọc, ghi, nhả khoá đều trên kết nối đó). Nếu thư viện DB hiện tại không cho giữ một kết nối riêng,
hãy dừng lại và đề xuất phương án khác (ví dụ bảng khoá có hạn) rồi hỏi tôi trước khi làm.

Các hàm:
- withRunLock(appKey, fn): thử khoá advisory (hằng số khoá cố định, ví dụ 74210531). Không lấy được khoá thì trả về null mà không gọi fn.
  Lấy được thì chạy fn(tx) rồi LUÔN nhả khoá (finally), kể cả khi fn ném lỗi.
- getLastRun(tx, appId): trả Date | null từ crashlytics_poller_state.
- findKnownIssues(tx, appId, issueIds): SELECT issue_id, notified_regression_at FROM crashlytics_issues
  WHERE app_id = $1 AND issue_id = ANY($2::text[]); trả Map theo issue_id.
- persistRun(tx, appId, items, nowIso): trong MỘT transaction (BEGIN ... COMMIT, lỗi thì ROLLBACK rồi ném lại):
  với mỗi item, upsert vào crashlytics_issues với ON CONFLICT (app_id, issue_id) DO UPDATE:
    title, subtitle, last_seen_version lấy giá trị mới; last_seen_at = now();
    notified_new_at = COALESCE(giá trị cũ, giá trị mới); notified_regression_at = COALESCE(giá trị cũ, giá trị mới).
  Sau đó upsert crashlytics_poller_state (last_run = nowIso).
  COALESCE đảm bảo không bao giờ ghi đè thời điểm đã báo lần đầu.
- Nếu lỗi PostgreSQL mã 42P01 (bảng chưa tồn tại) thì ném lỗi có thông báo "Chưa chạy migration cho Crashlytics".

Nghiệm thu: test tích hợp trên DB thử (hoặc DB cục bộ) cho: upsert hai lần không đè notified_*;
gọi withRunLock lồng nhau thì lần thứ hai trả null; lỗi giữa chừng thì ROLLBACK và khoá vẫn được nhả; findKnownIssues với mảng rỗng không lỗi.
```

### Prompt 6. Service (logic nghiệp vụ)

```text
[Dán QUY TẮC CHUNG]

Tạo src/services/crashlyticsAlertService.ts với hàm runCrashlyticsCheck(options?: { dryRun?: boolean }):
Promise<{ sent: number; skipped?: "locked" | "disabled"; firstRun: boolean }>.

Luồng (đúng thứ tự, không đổi):
1. Nếu CRASHLYTICS_ENABLED=false thì trả { skipped: "disabled" }.
2. repository.withRunLock: không lấy được khoá thì log "đang có lần chạy khác" và trả { skipped: "locked" }.
3. Trong khoá: lastRun = getLastRun. firstRun = (lastRun === null). now = new Date().
   since = firstRun ? now : lastRun - 1 phút.
4. groups = crashlyticsClient.fetchTopIssues(lookback, errorTypes). Bỏ group không có issue.id; mỗi issue.id chỉ xử lý một lần.
5. known = findKnownIssues(appId, danh sách id).
6. Với mỗi issue, regressed = signals có "SIGNAL_REGRESSED". Khi KHÔNG phải firstRun:
   - Chưa có trong known VÀ firstSeenTime tồn tại VÀ >= since  → alert "new".
   - Ngược lại, nếu regressed VÀ chưa có notified_regression_at → alert "regression".
   Mọi issue (kể cả không có alert) đều đưa vào danh sách ghi DB với: newAt = now nếu alert "new" else null; regAt = now nếu regressed else null.
7. dryRun: chỉ trả/ghi log các embed sẽ gửi, KHÔNG gửi, KHÔNG ghi DB.
8. Có alert thì gọi discordClient.sendEmbeds. Gửi lỗi => ném lỗi, KHÔNG ghi DB (để lần sau thử lại).
9. persistRun (một transaction). Trả { sent: số alert, firstRun }.
Ghi log (dùng logger của repo): số issue quét, số alert, firstRun; tuyệt đối không log webhook URL hay token.

Nghiệm thu (test đơn vị với repository, crashlyticsClient và discordClient giả):
- Lần đầu: gửi 0, ghi nhớ N issue.
- Issue mới (firstSeenTime sau since) → 1 alert "new"; chạy lại cùng dữ liệu → 0 alert.
- Issue cũ lần đầu thấy sau lần đầu chạy và không regressed → 0 alert, vẫn được ghi nhớ.
- Issue regressed chưa báo → alert "regression" một lần duy nhất.
- Discord lỗi → ném lỗi và persistRun không được gọi.
- Bị khoá → { skipped: "locked" }, không gọi API.
- dryRun → không gửi, không ghi.
```

### Prompt 7. Job chạy định kỳ và gắn vào server

```text
[Dán QUY TẮC CHUNG]

Dựa trên báo cáo Prompt 0 mục 8:
- Nếu repo đã có cơ chế chạy định kỳ: dùng đúng cơ chế đó.
- Nếu chưa có: tạo src/jobs/crashlyticsJob.ts dùng setInterval (không thêm thư viện).

Yêu cầu của job:
- startCrashlyticsJob() / stopCrashlyticsJob(). Chỉ chạy khi CRASHLYTICS_ENABLED=true.
- Chu kỳ = CRASHLYTICS_POLL_INTERVAL_MIN phút. Chạy lần đầu sau khoảng 10 giây kể từ khi server khởi động (không chạy ngay lập tức).
- Chống chạy chồng trong cùng tiến trình: nếu lần trước chưa xong thì bỏ qua lần này (cờ isRunning).
- Mọi lỗi được bắt và ghi log; job KHÔNG bao giờ làm sập tiến trình. Dùng unref() cho timer nếu phù hợp để không chặn việc tắt server.
- stopCrashlyticsJob() xoá timer; được gọi khi nhận SIGTERM/SIGINT hoặc theo cơ chế tắt êm hiện có trong src/index.ts.
- Khi backend chạy nhiều instance: việc chống trùng đã được đảm bảo bởi khoá PostgreSQL ở Prompt 5, không cần làm thêm.

Sửa src/index.ts (hoặc app.ts, theo quy ước repo) tối thiểu: gọi startCrashlyticsJob() sau khi server lắng nghe thành công.

Nghiệm thu: với ENABLED=false, server khởi động không có gì thay đổi; với ENABLED=true, log cho thấy job chạy theo chu kỳ; tắt server (Ctrl+C) thì timer được dọn; test với fake timers (nếu framework hỗ trợ) cho việc bỏ qua khi lần trước chưa xong.
```

### Prompt 8 (tuỳ chọn). Endpoint nội bộ

```text
[Dán QUY TẮC CHUNG]

Tạo src/routes/crashlyticsAdmin.ts và đăng ký trong src/app.ts, BẮT BUỘC đặt sau middleware xác thực/ phân quyền admin có sẵn
(nếu repo chưa có cơ chế phân quyền admin, hãy dừng lại và hỏi tôi, KHÔNG mở endpoint công khai):
- POST /internal/crashlytics/test-discord → gọi sendTestMessage, trả { ok: true }.
- POST /internal/crashlytics/run?dryRun=true|false → gọi runCrashlyticsCheck, trả kết quả { sent, skipped, firstRun }.
Không trả về token, webhook hay nội dung nhạy cảm. Lỗi trả mã phù hợp theo cách xử lý lỗi hiện có.

Nghiệm thu: gọi không có quyền → bị từ chối; có quyền → test-discord hiện tin xanh trong Discord; run?dryRun=true không gửi gì.
```

### Prompt 9. Kiểm thử

```text
[Dán QUY TẮC CHUNG]

Rà soát và bổ sung kiểm thử cho toàn bộ tính năng, dùng framework test hiện có của repo
(nếu chưa có framework, đề xuất một cái nhỏ và hỏi tôi trước khi thêm).

Cần đủ các nhóm:
1. Đơn vị: truncate, buildEmbed, chia lô embed, nhánh 429 của discordClient, phân trang và lỗi 404/403 của crashlyticsClient, extractMetrics với dữ liệu thiếu.
2. Service: đủ các kịch bản ở Prompt 6.
3. Repository (cần DB thử): upsert không ghi đè notified_*, khoá advisory, ROLLBACK khi lỗi.
4. Job: bỏ qua khi đang chạy, dọn timer khi dừng.
Không gọi mạng thật trong test tự động. Báo cáo kết quả chạy toàn bộ test và độ phủ của các file mới (nếu có công cụ).

Nghiệm thu: toàn bộ test mới pass; test cũ của repo không bị hỏng.
```

### Prompt 10. Rà soát cuối và tài liệu

```text
[Dán QUY TẮC CHUNG]

Rà soát toàn bộ phần đã làm so với tài liệu Backend/guide/crashlytics-discord-guide.md:
1. Với từng mục trong "Định nghĩa hoàn thành" (mục 9), nói rõ ĐẠT / CHƯA ĐẠT và bằng chứng (file, lệnh, kết quả).
2. Tìm lỗi tiềm ẩn: rò rỉ webhook/token trong log, nuốt lỗi, quên nhả khoá, quên ROLLBACK, timer không dọn.
3. Kiểm tra .env.example đủ biến; npm run build (hoặc script tương đương) pass.
4. Cập nhật tài liệu này nếu thực tế khác dự kiến (đặc biệt tên field số events/users, scope OAuth, cách xác thực đã dùng).
Không tự sửa ngoài phạm vi; liệt kê đề xuất riêng cho tôi.
```

## 8. Thứ tự kiểm thử thủ công sau khi code xong

1. Chạy migration trên DB thử.
2. Đặt biến môi trường trong `.env` (`CRASHLYTICS_ENABLED=true`, project, app id, webhook).
3. Gọi test-discord (hoặc script) → có tin xanh trong Discord.
4. Chạy một lần với dữ liệu thật ở chế độ dry-run, kiểm tra tên field số events/users có đúng không.
5. Chạy thật lần đầu: chỉ ghi nhớ issue hiện có, **chưa gửi gì**.
6. Bật job theo chu kỳ, chờ một issue mới hoặc gây crash thử ở bản app thử nghiệm.
7. Kiểm tra: Discord có tin; chạy lại không gửi trùng; bảng `crashlytics_issues` có `notified_new_at`.

## 9. Định nghĩa hoàn thành

- [ ] Migration chạy được, hai bảng đúng lược đồ.
- [ ] `CRASHLYTICS_ENABLED=false` thì backend hoạt động y như cũ.
- [ ] Gọi được API Crashlytics bằng dữ liệu thật; đã xác nhận tên field số liệu và cách xác thực.
- [ ] Lần chạy đầu không gửi gì; sau đó chỉ gửi issue mới/tái phát; chạy lại không gửi trùng.
- [ ] Discord lỗi thì không ghi DB và lần sau tự gửi lại.
- [ ] Hai instance chạy cùng lúc không gửi trùng (khoá PostgreSQL).
- [ ] Không có token/URL webhook trong log.
- [ ] `.env.example` đủ biến; test mới pass; build pass.
- [ ] Đã thử end-to-end: một issue thật xuất hiện trong kênh Discord.

## 10. Rủi ro và điều chưa xác nhận

- API Crashlytics ở bản **v1alpha**, có thể thay đổi.
- Từng có báo cáo lỗi **404 khi dùng service account**; phương án dự phòng là Application Default Credentials bằng tài khoản người dùng.
- Tên field số liệu (events/users) và scope OAuth **chưa được xác nhận** với API thật.
- Chưa tra được giá hoặc hạn mức riêng của REST API; không dùng Cloud Functions nên không cần gói Blaze theo thiết kế.
- Hệ thống báo theo **issue**, không phải từng lần crash; độ trễ bằng chu kỳ cron cộng thời gian Crashlytics xử lý.
- Hiếm khi gửi Discord xong mà ghi DB lỗi: có thể báo lặp một lần.
- Chỉ xét issue ở trạng thái OPEN; issue bị Mute/Closed sẽ không được báo.

