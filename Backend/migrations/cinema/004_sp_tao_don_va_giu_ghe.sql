CREATE OR ALTER PROCEDURE dbo.sp_tao_don_va_giu_ghe
 @id_khach_hang INT,@id_suat_chieu INT,@danh_sach_ghe dbo.DanhSachGhe READONLY,
 @idempotency_key VARCHAR(128),@request_hash CHAR(64),@so_phut_giu INT=7
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @id INT,@hash CHAR(64),@count INT,@found INT,@available INT,@now DATETIME2(3),@exp DATETIME2(3),@total DECIMAL(18,2),@lock INT;
 DECLARE @showtime_resource NVARCHAR(255)=CONCAT('cinema:hold-showtime:',@id_suat_chieu);
 DECLARE @resource NVARCHAR(255)=CONCAT('cinema:hold:',@id_khach_hang,':',CONVERT(VARCHAR(64),HASHBYTES('SHA2_256',@idempotency_key),2));
 IF @so_phut_giu NOT BETWEEN 5 AND 10 OR LEN(@idempotency_key)=0 OR LEN(@request_hash)<>64 THROW 51000,N'Invalid hold request',1;
 SELECT @count=COUNT(*) FROM @danh_sach_ghe;
 IF @count=0 THROW 51000,N'At least one seat is required',1;
 BEGIN TRY
  BEGIN TRAN;
  EXEC @lock=sys.sp_getapplock @Resource=@showtime_resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
  IF @lock<0 THROW 51002,N'Showtime booking flow is busy; retry using the same key',1;
  EXEC @lock=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
  IF @lock<0 THROW 51002,N'Booking request is busy; retry using the same key',1;
  SELECT @id=id,@hash=request_hash FROM dbo.DON_HANG WITH(UPDLOCK,HOLDLOCK) WHERE id_khach_hang=@id_khach_hang AND idempotency_key=@idempotency_key;
  IF @id IS NOT NULL BEGIN
   IF @hash<>@request_hash THROW 51002,N'Idempotency key was used with a different request',1;
   COMMIT; SELECT *,CAST(1 AS BIT) AS replayed FROM dbo.DON_HANG WHERE id=@id; RETURN;
  END;
  IF NOT EXISTS(SELECT 1 FROM dbo.KHACH_HANG WHERE id=@id_khach_hang AND dang_hoat_dong=1) THROW 51001,N'Customer not found',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.SUAT_CHIEU WHERE id=@id_suat_chieu AND trang_thai='MO_BAN') THROW 51001,N'Open showtime not found',1;
  SELECT @found=COUNT(*) FROM dbo.GHE_SUAT_CHIEU gs WITH(UPDLOCK,HOLDLOCK) JOIN @danh_sach_ghe ds ON ds.id_ghe=gs.id_ghe WHERE gs.id_suat_chieu=@id_suat_chieu;
  SET @now=SYSUTCDATETIME();
  IF NOT EXISTS(SELECT 1 FROM dbo.SUAT_CHIEU WHERE id=@id_suat_chieu AND bat_dau_luc>@now) THROW 51002,N'Showtime has already started',1;
  IF @found<>@count THROW 51000,N'Seat does not belong to this showtime',1;
  SELECT @available=COUNT(*) FROM dbo.GHE_SUAT_CHIEU gs JOIN @danh_sach_ghe ds ON ds.id_ghe=gs.id_ghe
   WHERE gs.id_suat_chieu=@id_suat_chieu AND (gs.trang_thai='TRONG' OR(gs.trang_thai='DANG_GIU' AND gs.het_han_luc<=@now));
  IF @available<>@count THROW 51002,N'One or more seats are unavailable',1;
  SET @exp=DATEADD(MINUTE,@so_phut_giu,@now);
  SELECT @total=SUM(sc.gia_co_ban+g.phu_thu) FROM @danh_sach_ghe ds JOIN dbo.GHE g ON g.id=ds.id_ghe CROSS JOIN dbo.SUAT_CHIEU sc WHERE sc.id=@id_suat_chieu;
  INSERT dbo.DON_HANG(id_khach_hang,id_suat_chieu,ma_don,idempotency_key,request_hash,tong_tien,het_han_luc)
   VALUES(@id_khach_hang,@id_suat_chieu,'DH-'+REPLACE(CONVERT(VARCHAR(36),NEWID()),'-',''),@idempotency_key,@request_hash,@total,@exp);
  SET @id=CONVERT(INT,SCOPE_IDENTITY());
  UPDATE gs SET trang_thai='DANG_GIU',id_don_hang=@id,het_han_luc=@exp FROM dbo.GHE_SUAT_CHIEU gs JOIN @danh_sach_ghe ds ON ds.id_ghe=gs.id_ghe WHERE gs.id_suat_chieu=@id_suat_chieu;
  INSERT dbo.CHI_TIET_DON_HANG(id_don_hang,id_suat_chieu,id_ghe,gia_ve)
   SELECT @id,@id_suat_chieu,g.id,sc.gia_co_ban+g.phu_thu FROM @danh_sach_ghe ds JOIN dbo.GHE g ON g.id=ds.id_ghe CROSS JOIN dbo.SUAT_CHIEU sc WHERE sc.id=@id_suat_chieu;
  INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,trang_thai,thong_diep) VALUES(@id,'GIU_GHE','THANH_CONG',N'Atomic seat reservation');
  COMMIT; SELECT *,CAST(0 AS BIT) AS replayed FROM dbo.DON_HANG WHERE id=@id;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH
END;
