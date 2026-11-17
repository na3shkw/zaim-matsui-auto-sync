import { joinUrl } from "../utils.js";

/**
 * Zaim ウェブサイトおよびくふうアカウントの各ページのURL
 */
export class ZaimWebPage {
  /** Zaim のオリジン */
  static readonly zaimOrigin = "https://zaim.net";
  /** くふうアカウントのオリジン */
  static readonly kufuIdOrigin = "https://id.kufu.jp";

  /**
   * Zaim のホームページURL（未ログイン時はくふうアカウントのログインページへリダイレクトされる）
   */
  static get home(): string {
    return joinUrl(this.zaimOrigin, "/home");
  }

  /**
   * Zaim のログイン開始URL（くふうアカウントのログインページへリダイレクトされる）
   */
  static get login(): string {
    return joinUrl(this.zaimOrigin, "/user_session/new");
  }

  /**
   * Zaim の収入入力ページURL
   */
  static get moneyNewIncome(): string {
    return joinUrl(this.zaimOrigin, "/money/new?toggle=income");
  }

  /**
   * くふうアカウントの2段階認証ページのパス
   */
  static get kufuTotpPath(): string {
    return "/signin/totp";
  }
}
