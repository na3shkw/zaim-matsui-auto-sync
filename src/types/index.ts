import type { Dayjs } from "dayjs";

export interface MatsuiAuthenticationCode {
  authenticationCode: number; // 認証コード
  timestamp: Dayjs; // 認証コードを受信したタイムスタンプ
}
