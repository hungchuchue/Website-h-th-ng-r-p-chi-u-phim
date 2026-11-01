CREATE OR ALTER PROCEDURE dbo.sp_xu_ly_ket_qua_thanh_toan
 @ma_yeu_cau VARCHAR(64),@thanh_cong BIT,@ma_giao_dich_cong VARCHAR(128),@so_tien_gateway DECIMAL(18,2),@provider VARCHAR(32)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @id_don INT,@id_tt INT,@tt_status VARCHAR(24),@don_status VARCHAR(24),@exp DATETIME2(3),@now DATETIME2(3),@so_tien DECIMAL(18,2),@expected INT,@changed INT,@locked INT,@old_tx VARCHAR(128),@old_amount DECIMAL(18,2);
 SELECT @id_don=id_don_hang FROM dbo.THANH_TOAN WHERE ma_yeu_cau=@ma_yeu_cau AND provider=@provider;
 IF @id_don IS NULL THROW 51001,N'Payment request not found',1;
 IF LEN(@ma_giao_dich_cong)=0 OR @so_tien_gateway<0 THROW 51000,N'Invalid verified payment result',1;
 BEGIN TRY
  BEGIN TRAN;
  SELECT @don_status=trang_thai,@exp=het_han_luc FROM dbo.DON_HANG WITH(UPDLOCK,HOLDLOCK) WHERE id=@id_don;
  SELECT @id_tt=id,@tt_status=trang_thai,@so_tien=so_tien,@old_tx=ma_giao_dich_cong,@old_amount=so_tien_gateway
   FROM dbo.THANH_TOAN WITH(UPDLOCK,HOLDLOCK) WHERE ma_yeu_cau=@ma_yeu_cau AND provider=@provider;
  SELECT @locked=COUNT(*) FROM dbo.GHE_SUAT_CHIEU WITH(UPDLOCK,HOLDLOCK) WHERE id_don_hang=@id_don;
  -- Check the deadline only AFTER acquiring booking, payment and seat locks.
  SET @now=SYSUTCDATETIME();
  IF @tt_status IN('THANH_CONG','CHO_HOAN_TIEN','DA_HOAN_TIEN') BEGIN
   IF @thanh_cong=0 OR @old_tx<>@ma_giao_dich_cong OR @old_amount<>@so_tien_gateway
    INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,trang_thai,thong_diep) VALUES(@id_don,'THANH_TOAN','THAT_BAI',N'Contradictory verified callback: manual reconciliation required; settled result preserved');
   COMMIT; SELECT trang_thai FROM dbo.THANH_TOAN WHERE id=@id_tt; RETURN;
  END;
  IF EXISTS(SELECT 1 FROM dbo.THANH_TOAN WITH(UPDLOCK,HOLDLOCK) WHERE provider=@provider AND ma_giao_dich_cong=@ma_giao_dich_cong AND id<>@id_tt) BEGIN
   INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,trang_thai,thong_diep) VALUES(@id_don,'THANH_TOAN','THAT_BAI',N'Provider transaction is linked to another payment: reconciliation required');
   COMMIT; SELECT trang_thai FROM dbo.THANH_TOAN WHERE id=@id_tt; RETURN;
  END;
  IF @thanh_cong=0 BEGIN
   IF @tt_status='THAT_BAI' BEGIN COMMIT; SELECT trang_thai FROM dbo.THANH_TOAN WHERE id=@id_tt; RETURN; END;
   IF @so_tien_gateway<>@so_tien BEGIN
    INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,trang_thai,thong_diep) VALUES(@id_don,'THANH_TOAN','CHO',N'Failure callback amount mismatch: reconciliation required');
    COMMIT; SELECT trang_thai FROM dbo.THANH_TOAN WHERE id=@id_tt; RETURN;
   END;
   UPDATE dbo.THANH_TOAN SET trang_thai='THAT_BAI',ma_giao_dich_cong=@ma_giao_dich_cong,so_tien_gateway=@so_tien_gateway,thoi_gian_cap_nhat=@now WHERE id=@id_tt;
   IF @don_status='CHO_THANH_TOAN' BEGIN
    UPDATE dbo.GHE_SUAT_CHIEU SET trang_thai='TRONG',id_don_hang=NULL,het_han_luc=NULL WHERE id_don_hang=@id_don AND trang_thai='DANG_GIU';
    UPDATE dbo.DON_HANG SET trang_thai='THAT_BAI',ly_do_that_bai=N'Thanh toán thất bại' WHERE id=@id_don;
    INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,hanh_dong,trang_thai,thong_diep) VALUES(@id_don,'GIU_GHE','BU_TRU','THANH_CONG',N'Giải phóng ghế sau lỗi thanh toán');
   END;
   INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,trang_thai,thong_diep) VALUES(@id_don,'THANH_TOAN','THAT_BAI',N'Gateway từ chối thanh toán');
   COMMIT; SELECT trang_thai FROM dbo.THANH_TOAN WHERE id=@id_tt; RETURN;
  END;
  IF @tt_status='CHO' AND @don_status='CHO_THANH_TOAN' AND @exp>@now AND @so_tien_gateway=@so_tien BEGIN
   SELECT @expected=COUNT(*) FROM dbo.CHI_TIET_DON_HANG WHERE id_don_hang=@id_don;
   IF @expected=0 THROW 51302,N'Đơn không có ghế',1;
   UPDATE dbo.GHE_SUAT_CHIEU SET trang_thai='DA_BAN',het_han_luc=NULL WHERE id_don_hang=@id_don AND trang_thai='DANG_GIU' AND het_han_luc>@now;
   SET @changed=@@ROWCOUNT;
   IF @changed<>@expected THROW 51303,N'Trạng thái ghế không nhất quán; cần đối soát',1;
   UPDATE dbo.THANH_TOAN SET trang_thai='THANH_CONG',ma_giao_dich_cong=@ma_giao_dich_cong,so_tien_gateway=@so_tien_gateway,thoi_gian_cap_nhat=@now WHERE id=@id_tt;
   UPDATE dbo.DON_HANG SET trang_thai='DA_THANH_TOAN' WHERE id=@id_don;
   INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,trang_thai,thong_diep) VALUES(@id_don,'THANH_TOAN','THANH_CONG',N'Đã xác nhận tiền; giữ ghế ở DA_BAN');
   IF NOT EXISTS(SELECT 1 FROM dbo.OUTBOX_SU_KIEN WHERE event_key=CONCAT('ISSUE:',@id_don))
    INSERT dbo.OUTBOX_SU_KIEN(event_key,id_don_hang,loai_su_kien) VALUES(CONCAT('ISSUE:',@id_don),@id_don,'PHAT_HANH_VE');
  END ELSE BEGIN
   -- Includes THAT_BAI -> verified SUCCESS: refund without restoring any seats.
   UPDATE dbo.THANH_TOAN SET trang_thai='CHO_HOAN_TIEN',ma_giao_dich_cong=@ma_giao_dich_cong,so_tien_gateway=@so_tien_gateway,thoi_gian_cap_nhat=@now WHERE id=@id_tt;
   IF @don_status='CHO_THANH_TOAN' BEGIN
    UPDATE dbo.GHE_SUAT_CHIEU SET trang_thai='TRONG',id_don_hang=NULL,het_han_luc=NULL WHERE id_don_hang=@id_don AND trang_thai='DANG_GIU';
    INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,hanh_dong,trang_thai,thong_diep) VALUES(@id_don,'GIU_GHE','BU_TRU','THANH_CONG',N'Giải phóng vì thanh toán đến trễ hoặc sai số tiền');
   END;
   IF @don_status NOT IN('DA_THANH_TOAN','HOAN_TAT') UPDATE dbo.DON_HANG SET trang_thai='CHO_HOAN_TIEN',ly_do_that_bai=N'Cổng xác nhận thành công khi đơn không còn hợp lệ' WHERE id=@id_don;
   INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,trang_thai,thong_diep) VALUES(@id_don,'THANH_TOAN','THAT_BAI',N'Thanh toán thành công nhưng đơn không hợp lệ: yêu cầu hoàn tiền');
   IF NOT EXISTS(SELECT 1 FROM dbo.OUTBOX_SU_KIEN WHERE event_key=CONCAT('REFUND:',@id_tt))
    INSERT dbo.OUTBOX_SU_KIEN(event_key,id_don_hang,id_thanh_toan,loai_su_kien) VALUES(CONCAT('REFUND:',@id_tt),@id_don,@id_tt,'HOAN_TIEN');
  END;
  COMMIT; SELECT trang_thai FROM dbo.THANH_TOAN WHERE id=@id_tt;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH
END;
