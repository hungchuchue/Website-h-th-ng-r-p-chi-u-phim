CREATE OR ALTER PROCEDURE dbo.sp_bat_dau_thanh_toan
 @id_don_hang INT,@id_khach_hang INT,@idempotency_key VARCHAR(128),@provider VARCHAR(32)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @state VARCHAR(24),@expiry DATETIME2(3),@amount DECIMAL(18,2),@id INT,@old_provider VARCHAR(32);
 BEGIN TRY
  BEGIN TRAN;
  SELECT @state=trang_thai,@expiry=het_han_luc,@amount=tong_tien FROM dbo.DON_HANG WITH(UPDLOCK,HOLDLOCK) WHERE id=@id_don_hang AND id_khach_hang=@id_khach_hang;
  IF @state IS NULL THROW 51001,N'Booking not found',1;
  SELECT @id=id,@old_provider=provider FROM dbo.THANH_TOAN WITH(UPDLOCK,HOLDLOCK) WHERE id_don_hang=@id_don_hang AND idempotency_key=@idempotency_key;
  IF @id IS NOT NULL BEGIN
   IF @old_provider<>@provider THROW 51002,N'Idempotency key belongs to another payment provider',1;
   COMMIT; SELECT * FROM dbo.THANH_TOAN WHERE id=@id; RETURN;
  END;
  IF @state<>'CHO_THANH_TOAN' OR @expiry<=SYSUTCDATETIME() THROW 51002,N'Booking is not payable',1;
  IF EXISTS(SELECT 1 FROM dbo.THANH_TOAN WHERE id_don_hang=@id_don_hang AND trang_thai='CHO') THROW 51002,N'Another payment is already pending',1;
  INSERT dbo.THANH_TOAN(id_don_hang,ma_yeu_cau,idempotency_key,provider,so_tien) VALUES(@id_don_hang,CONVERT(VARCHAR(36),NEWID()),@idempotency_key,@provider,@amount);
  SET @id=CONVERT(INT,SCOPE_IDENTITY());
  INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,trang_thai,thong_diep) VALUES(@id_don_hang,'THANH_TOAN','CHO',N'Payment initiated; awaiting verified provider result');
  COMMIT; SELECT * FROM dbo.THANH_TOAN WHERE id=@id;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH
END;
