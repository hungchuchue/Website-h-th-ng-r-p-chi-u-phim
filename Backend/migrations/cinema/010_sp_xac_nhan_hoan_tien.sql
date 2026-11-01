CREATE OR ALTER PROCEDURE dbo.sp_xac_nhan_hoan_tien @id_thanh_toan INT,@ma_hoan_tien VARCHAR(128),@so_tien_hoan DECIMAL(18,2)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @id_don INT,@state VARCHAR(24),@amount DECIMAL(18,2),@locked INT;
 SELECT @id_don=id_don_hang FROM dbo.THANH_TOAN WHERE id=@id_thanh_toan;
 IF @id_don IS NULL THROW 51001,N'Payment not found',1;
 BEGIN TRY
  BEGIN TRAN;
  SELECT @locked=id FROM dbo.DON_HANG WITH(UPDLOCK,HOLDLOCK) WHERE id=@id_don;
  SELECT @state=trang_thai,@amount=COALESCE(so_tien_gateway,so_tien) FROM dbo.THANH_TOAN WITH(UPDLOCK,HOLDLOCK) WHERE id=@id_thanh_toan;
  IF @state='DA_HOAN_TIEN' BEGIN COMMIT; RETURN; END;
  IF @state<>'CHO_HOAN_TIEN' OR @so_tien_hoan<>@amount OR LEN(@ma_hoan_tien)=0 THROW 51002,N'Refund result does not match pending payment',1;
  UPDATE dbo.THANH_TOAN SET trang_thai='DA_HOAN_TIEN',ma_hoan_tien=@ma_hoan_tien,thoi_gian_cap_nhat=SYSUTCDATETIME() WHERE id=@id_thanh_toan;
  IF NOT EXISTS(SELECT 1 FROM dbo.THANH_TOAN WHERE id_don_hang=@id_don AND trang_thai='CHO_HOAN_TIEN')
   UPDATE dbo.DON_HANG SET trang_thai='DA_HOAN_TIEN' WHERE id=@id_don AND trang_thai='CHO_HOAN_TIEN';
  UPDATE dbo.OUTBOX_SU_KIEN SET trang_thai='HOAN_TAT',lock_token=NULL,locked_until=NULL,thong_diep_loi=NULL,cap_nhat_luc=SYSUTCDATETIME() WHERE event_key=CONCAT('REFUND:',@id_thanh_toan);
  INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,hanh_dong,trang_thai,thong_diep) VALUES(@id_don,'HOAN_TIEN','BU_TRU','THANH_CONG',N'Đã xác minh hoàn tiền');
  COMMIT;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH
END;
