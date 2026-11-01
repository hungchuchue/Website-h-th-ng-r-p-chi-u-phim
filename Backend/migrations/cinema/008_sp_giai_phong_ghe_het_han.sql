CREATE OR ALTER PROCEDURE dbo.sp_giai_phong_ghe_het_han
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @now DATETIME2(3)=SYSUTCDATETIME();
 DECLARE @expired TABLE(id INT NOT NULL PRIMARY KEY);
 BEGIN TRY
  BEGIN TRAN;
  UPDATE dbo.DON_HANG WITH(UPDLOCK,ROWLOCK) SET trang_thai='HET_HAN',ly_do_that_bai=N'Hết thời gian giữ ghế'
   OUTPUT inserted.id INTO @expired WHERE trang_thai='CHO_THANH_TOAN' AND het_han_luc<=@now;
  UPDATE gs SET trang_thai='TRONG',id_don_hang=NULL,het_han_luc=NULL FROM dbo.GHE_SUAT_CHIEU gs JOIN @expired e ON e.id=gs.id_don_hang WHERE gs.trang_thai='DANG_GIU';
  INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,hanh_dong,trang_thai,thong_diep) SELECT id,'GIU_GHE','BU_TRU','THANH_CONG',N'Worker hoàn tác ghế hết hạn' FROM @expired;
  COMMIT;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH
END;
