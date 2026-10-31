Kiểm định CSDL CinemaBooking Core V2.1 theo đề bài và thiết kế TROOND Cinema 15 màn hình
Kết luận
CSDL đúng về mô hình dữ liệu và đủ các thực thể cốt lõi cho 15 giao diện. Chưa thể tuyên bố đạt 100% đề bài, vì tính sẵn sàng, 99,5% uptime, hiệu năng và chống bán trùng trong tải đồng thời chỉ có thể chứng minh bằng API/worker, tích hợp, giám sát và kiểm thử thực tế.

File CinemaBooking_Core_v2_1.sql có 14 bảng và 8 stored procedures, là bản DB demo độc lập mới, không cập nhật đè DB cũ. Chọn SQL Server 2019+ nhất quán từ file DB gốc. Nếu báo cáo/4+1 Views hiện ghi PostgreSQL, phải sửa thành SQL Server để không mâu thuẫn. Không thể thực thi SQL Server trực tiếp tại phiên kiểm tra này; đây là rà soát tĩnh.
1. Bảng / giao diện
Giao diện	Bảng cốt lõi	Đánh giá
C01 Đăng nhập/đăng ký	KHACH_HANG, QUAN_TRI_VIEN	Có dữ liệu tài khoản, hash mật khẩu; còn API auth & phân quyền
C02 Trang chủ	PHIM, SUAT_CHIEU	Đủ dữ liệu danh sách phim và lịch chiếu
C03 Chi tiết phim	PHIM, SUAT_CHIEU	Có mô tả, poster, trailer, thể loại, thời lượng
C04 Chọn cụm rạp/suất	CUM_RAP, PHONG_CHIEU, SUAT_CHIEU	FK rõ ràng; cần API lọc theo ngày và rạp
C05 Chọn/giữ ghế	GHE, GHE_SUAT_CHIEU, DON_HANG, CHI_TIET_DON_HANG	Trạng thái TRONG/DANG_GIU/DA_BAN; TTL 5–10 phút tại server
C06 Thanh toán	DON_HANG, THANH_TOAN	Có giao dịch theo lần thử; webhook bắt buộc backend xác thực
C07 Vé điện tử	VE, DON_HANG	Có mã vé, qr_token, trạng thái; worker cần render/gửi vé
C08 Lỗi/hết hạn	DON_HANG, BUOC_GIAO_DICH, THANH_TOAN, GHE_SUAT_CHIEU	Có hoàn tác ghế, refund outbox; cần worker & đối soát thật
C09 Lịch sử	DON_HANG, CHI_TIET_DON_HANG, THANH_TOAN, VE	Snapshot ghế/giá giúp hiển thị đơn lỗi và thành công
A10 Dashboard	DON_HANG, THANH_TOAN, VE, SUAT_CHIEU	Cần query/view tổng hợp KPI (chưa tạo sẵn)
A11 Quản lý phim	PHIM	CRUD tại API, DB có dữ liệu cần thiết
A12 Quản lý cụm rạp/phòng	CUM_RAP, PHONG_CHIEU, GHE	Cần khóa sửa sơ đồ ghế khi đã có suất đang mở bán
A13 Quản lý suất chiếu	SUAT_CHIEU, GHE_SUAT_CHIEU	Có procedure tạo mới và chống chồng lịch; CRUD còn lại ở backend
A14 Giám sát trạng thái ghế	GHE_SUAT_CHIEU, GHE, DON_HANG	Đủ dữ liệu hiển thị ghế trống/giữ/bán và TTL
A15 Quản lý giao dịch/vé	DON_HANG, THANH_TOAN, VE, BUOC_GIAO_DICH, OUTBOX_SU_KIEN	Có trace/retry, cần API quản trị và worker chạy thật


2. Các điểm đã sửa từ Core V2 sang Core V2.1
1. Callback sau thời điểm hết hạn (race do chờ khóa): Core V2 lấy @now trước khi chờ UPDLOCK, khiến thời điểm đánh giá hết hạn có thể bị cũ. V2.1 lấy SYSUTCDATETIME() sau khi lấy đủ khóa đơn và thanh toán.
2. Gateway báo thất bại rồi sau đó báo thành công: Core V2 gặp THANH_TOAN.trang_thai <> 'CHO' thì thoát luôn; tiền đến thật nhưng không tạo quy trình hoàn tiền. V2.1 nhận callback đã xác thực sau trạng thái THAT_BAI, chuyển sang CHO_HOAN_TIEN, tạo outbox refund; không phục hồi ghế hay cấp vé.
3. Webhook mâu thuẫn sau khi đã hoàn tất: V2.1 tạo nhật ký BUOC_GIAO_DICH để đối soát; không ghi đè vé đã phát hành.
4. Thử nghiệm logic: Bổ sung các test FAILURE→SUCCESS, SUCCESS sau TTL nhưng worker chưa dọn, và trùng lịch trong một phòng. Test không thay thế chạy đồng thời thực sự hay tích hợp gateway.
3. Những phần chưa có (nằm ngoài SQL hoặc cần hoàn thiện khi lập trình)
- Backend & kiểm soát quyền: ASP.NET Core API cho auth, các màn CRUD, backend chuyển TRONG/DANG_GIU/DA_BAN thành FREE/HELD/SOLD cho UI. API không cấp quyền UPDATE ghế/đơn trực tiếp cho frontend.
- Worker: Dọn ghế hết hạn; claim các event outbox theo cơ chế độc quyền; phát hành và gửi QR; gọi hoàn tiền ở gateway bằng khóa idempotency; retry và cảnh báo quá số lần.
- Đối soát gateway: Chỉ xử lý callback đã xác minh chữ ký, số tiền, đơn vị tiền tệ và nguồn; có chính sách cho kết quả thanh toán chậm/không xác định. Một số webhook mâu thuẫn hoặc nhiều khoản thanh toán cho cùng một yêu cầu cần xử lý thủ công/quy trình đối soát ngoài mức demo.
- Kiểm thử concurrency: Dùng 2 kết nối/API thực sự đặt cùng ghế; phải chỉ một transaction thành công. Benchmark 5.000–10.000 giao dịch/ngày, truy vấn <1s, giữ ghế <2s, cấp vé <5s.
- Uptime ≥99,5%: Cần thiết kế hạ tầng, backup/restore, monitoring, health checks, vận hành và số liệu quan trắc; không thể xác nhận bằng DDL.
- Quản trị sơ đồ ghế: Chặn sửa/xóa ghế và thời gian suất chiếu khi đang có giữ ghế hoặc vé đã bán. sp_tao_suat_chieu giải quyết tạo mới, không đủ để đảm bảo mọi lệnh UPDATE SUAT_CHIEU hợp lệ nếu cho cập nhật SQL trực tiếp.
- Ghế đôi (DOI): DB lưu loại ghế nhưng không tự thực thi quy tắc giữ đồng thời 2 vị trí. Nếu không có ghế đôi trong 15 màn, có thể chỉ dùng THUONG/VIP cho demo.
- Quy trình vé đã thanh toán: V2.1 giữ DA_BAN khi phát hành vé lỗi, worker retry. Thời gian <5s chưa được chứng minh.
4. Cấu trúc cốt lõi đề xuất (giữ nguyên 14 bảng)
Tài khoản: KHACH_HANG, QUAN_TRI_VIEN.

Danh mục: CUM_RAP, PHONG_CHIEU, GHE, PHIM, SUAT_CHIEU.

Giao dịch: DON_HANG, CHI_TIET_DON_HANG, GHE_SUAT_CHIEU, THANH_TOAN, VE.

Truy vết / retry: BUOC_GIAO_DICH, OUTBOX_SU_KIEN.

Luồng quan trọng: SUAT_CHIEU + GHE → GHE_SUAT_CHIEU (ghế theo suất) → DON_HANG + CHI_TIET_DON_HANG (snapshot ghế/giá) → THANH_TOAN → VE, với BUOC_GIAO_DICH và OUTBOX_SU_KIEN giữ trace/retry.
5. Chạy bản V2.1
1. Trong SSMS, chạy CinemaBooking_Core_v2_1.sql trên instance SQL Server 2019+ có quyền tạo database. DB được tạo tên CinemaBooking_Core_v2_1.
2. Chạy CinemaBooking_Core_v2_1_demo_test.sql trong DB demo sạch, sau bước 1. Test dùng callback mô phỏng, không gọi cổng thanh toán thật.
3. Test riêng bằng hai cửa sổ SSMS/API song song: giữ ghế A1 trên cùng suất bằng hai khách khác nhau; kỳ vọng một thành công và một thất bại hoặc bị khóa.
4. Tạo worker ngoài SQL và tích hợp thanh toán sandbox; ghi log kết quả chạy, mức tải và độ trễ phục vụ báo cáo chất lượng.
Không chạy các file demo trên DB sản xuất. Các script CREATE TABLE không nhằm hỗ trợ chạy lặp nhiều lần trên cùng DB và chưa được thực thi trên máy chủ SQL Server trong cuộc trò chuyện này.