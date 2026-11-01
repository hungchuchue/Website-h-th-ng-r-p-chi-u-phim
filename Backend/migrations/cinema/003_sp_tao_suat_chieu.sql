CREATE OR ALTER PROCEDURE dbo.sp_tao_suat_chieu
 @id_phim INT,@id_phong_chieu INT,@bat_dau_luc DATETIME2(3),@gia_co_ban DECIMAL(18,2)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @duration INT,@finish DATETIME2(3),@id INT,@lock INT,@resource NVARCHAR(255)=CONCAT('cinema:room:',@id_phong_chieu);
 BEGIN TRY
  BEGIN TRAN;
  EXEC @lock=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
  IF @lock<0 THROW 51002,N'Room is busy; retry with the same request',1;
  SELECT @duration=thoi_luong FROM dbo.PHIM WITH(HOLDLOCK) WHERE id=@id_phim AND trang_thai='DANG_CHIEU';
  IF @duration IS NULL OR NOT EXISTS(SELECT 1 FROM dbo.PHONG_CHIEU p JOIN dbo.CUM_RAP c ON c.id=p.id_cum_rap WHERE p.id=@id_phong_chieu AND p.dang_hoat_dong=1 AND c.dang_hoat_dong=1)
   THROW 51001,N'Movie or active screening room not found',1;
  IF @bat_dau_luc<=SYSUTCDATETIME() OR @gia_co_ban<0 THROW 51000,N'Invalid showtime or price',1;
  SET @finish=DATEADD(MINUTE,@duration,@bat_dau_luc);
  IF EXISTS(SELECT 1 FROM dbo.SUAT_CHIEU WITH(UPDLOCK,HOLDLOCK) WHERE id_phong_chieu=@id_phong_chieu AND bat_dau_luc<@finish AND ket_thuc_luc>@bat_dau_luc)
   THROW 51002,N'Overlapping showtimes in this room',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.GHE WHERE id_phong_chieu=@id_phong_chieu AND dang_hoat_dong=1) THROW 51000,N'Room has no seats',1;
  INSERT dbo.SUAT_CHIEU(id_phim,id_phong_chieu,bat_dau_luc,ket_thuc_luc,gia_co_ban) VALUES(@id_phim,@id_phong_chieu,@bat_dau_luc,@finish,@gia_co_ban);
  SET @id=CONVERT(INT,SCOPE_IDENTITY());
  INSERT dbo.GHE_SUAT_CHIEU(id_suat_chieu,id_ghe,id_phong_chieu) SELECT @id,id,@id_phong_chieu FROM dbo.GHE WHERE id_phong_chieu=@id_phong_chieu AND dang_hoat_dong=1;
  COMMIT; SELECT * FROM dbo.SUAT_CHIEU WHERE id=@id;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH
END;
