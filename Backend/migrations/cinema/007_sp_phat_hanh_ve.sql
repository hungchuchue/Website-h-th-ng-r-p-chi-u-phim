CREATE OR ALTER PROCEDURE dbo.sp_phat_hanh_ve @id_don_hang INT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @state VARCHAR(24),@expect INT,@sold INT,@issued INT;
 BEGIN TRY
  BEGIN TRAN;
  SELECT @state=trang_thai FROM dbo.DON_HANG WITH(UPDLOCK,HOLDLOCK) WHERE id=@id_don_hang;
  IF @state IS NULL THROW 51001,N'Booking not found',1;
  IF @state='HOAN_TAT' BEGIN COMMIT; RETURN; END;
  IF @state<>'DA_THANH_TOAN' THROW 51400,N'Đơn chưa được xác nhận thanh toán',1;
  SELECT @expect=COUNT(*) FROM dbo.CHI_TIET_DON_HANG WHERE id_don_hang=@id_don_hang;
  SELECT @sold=COUNT(*) FROM dbo.GHE_SUAT_CHIEU WHERE id_don_hang=@id_don_hang AND trang_thai='DA_BAN';
  IF @expect=0 OR @sold<>@expect THROW 51401,N'Số ghế đã bán không khớp chi tiết đơn hàng',1;
  INSERT dbo.VE(id_don_hang,id_suat_chieu,id_ghe,ma_ve,qr_token,gia_ve)
   SELECT ct.id_don_hang,ct.id_suat_chieu,ct.id_ghe,'VE-'+REPLACE(CONVERT(VARCHAR(36),NEWID()),'-',''),CONVERT(VARCHAR(64),CRYPT_GEN_RANDOM(32),2),ct.gia_ve
   FROM dbo.CHI_TIET_DON_HANG ct WHERE ct.id_don_hang=@id_don_hang AND NOT EXISTS(SELECT 1 FROM dbo.VE v WHERE v.id_suat_chieu=ct.id_suat_chieu AND v.id_ghe=ct.id_ghe);
  SELECT @issued=COUNT(*) FROM dbo.VE WHERE id_don_hang=@id_don_hang;
  IF @issued<>@expect THROW 51402,N'Phát hành vé chưa đầy đủ',1;
  UPDATE dbo.DON_HANG SET trang_thai='HOAN_TAT' WHERE id=@id_don_hang;
  UPDATE dbo.OUTBOX_SU_KIEN SET trang_thai='HOAN_TAT',thong_diep_loi=NULL,lock_token=NULL,locked_until=NULL,cap_nhat_luc=SYSUTCDATETIME() WHERE event_key=CONCAT('ISSUE:',@id_don_hang);
  INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,trang_thai,thong_diep) VALUES(@id_don_hang,'PHAT_HANH_VE','THANH_CONG',N'Đã sinh đủ vé điện tử');
  COMMIT;
 END TRY
 BEGIN CATCH
  DECLARE @error NVARCHAR(500)=LEFT(ERROR_MESSAGE(),500);
  IF XACT_STATE()<>0 ROLLBACK;
  BEGIN TRY
   BEGIN TRAN;
   IF EXISTS(SELECT 1 FROM dbo.DON_HANG WHERE id=@id_don_hang) BEGIN
    UPDATE dbo.OUTBOX_SU_KIEN SET trang_thai='THAT_BAI',so_lan_thu=so_lan_thu+1,xu_ly_sau=DATEADD(SECOND,30,SYSUTCDATETIME()),thong_diep_loi=@error
     WHERE event_key=CONCAT('ISSUE:',@id_don_hang) AND trang_thai<>'HOAN_TAT';
    INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,trang_thai,thong_diep) VALUES(@id_don_hang,'PHAT_HANH_VE','THAT_BAI',@error);
   END;
   COMMIT;
  END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; END CATCH;
  THROW;
 END CATCH
END;
