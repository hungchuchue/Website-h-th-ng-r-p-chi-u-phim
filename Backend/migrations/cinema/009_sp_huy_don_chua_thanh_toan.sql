CREATE OR ALTER PROCEDURE dbo.sp_huy_don_chua_thanh_toan @id_don_hang INT,@id_khach_hang INT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @state VARCHAR(24);
 BEGIN TRY
  BEGIN TRAN;
  SELECT @state=trang_thai FROM dbo.DON_HANG WITH(UPDLOCK,HOLDLOCK) WHERE id=@id_don_hang AND id_khach_hang=@id_khach_hang;
  IF @state IS NULL THROW 51001,N'Booking not found',1;
  IF @state='DA_HUY' BEGIN COMMIT; RETURN; END;
  IF @state<>'CHO_THANH_TOAN' THROW 51002,N'Only unpaid pending bookings can be cancelled',1;
  UPDATE dbo.GHE_SUAT_CHIEU SET trang_thai='TRONG',id_don_hang=NULL,het_han_luc=NULL WHERE id_don_hang=@id_don_hang AND trang_thai='DANG_GIU';
  UPDATE dbo.DON_HANG SET trang_thai='DA_HUY',ly_do_that_bai=N'Khách hàng hủy đơn' WHERE id=@id_don_hang;
  INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,hanh_dong,trang_thai,thong_diep) VALUES(@id_don_hang,'GIU_GHE','BU_TRU','THANH_CONG',N'Khách hàng hủy đơn chưa thanh toán');
  COMMIT;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH
END;
