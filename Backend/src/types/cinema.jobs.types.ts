export type OutboxStatus = 'CHO' | 'THAT_BAI' | 'HOAN_TAT';
export type OutboxType = 'PHAT_HANH_VE' | 'HOAN_TIEN';
interface OutboxEventFields {
    id: string;
    event_key: string;
    id_don_hang: number;
    trang_thai: OutboxStatus;
    so_lan_thu: number;
    so_lan_xu_ly: number;
    xu_ly_sau: Date;
    lock_token: string | null;
    locked_until: Date | null;
    thong_diep_loi: string | null;
}
export type OutboxEvent = OutboxEventFields &
    (
        | {
              loai_su_kien: 'PHAT_HANH_VE';
              id_thanh_toan: null;
          }
        | {
              loai_su_kien: 'HOAN_TIEN';
              id_thanh_toan: number;
          }
    );
