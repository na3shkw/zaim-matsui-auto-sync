import { joinUrl } from "../utils.js";

/**
 * Zaim ウェブサイトおよびくふうアカウントの各ページのURL
 */
export class ZaimWebPage {
  private static readonly ZAIM_BASE_URL = "https://zaim.net";
  private static readonly KUFU_ID_BASE_URL = "https://id.kufu.jp";

  /**
   * Zaim のオリジン
   */
  static get zaimOrigin(): string {
    return this.ZAIM_BASE_URL;
  }

  /**
   * くふうアカウントのオリジン
   */
  static get kufuIdOrigin(): string {
    return this.KUFU_ID_BASE_URL;
  }

  /**
   * Zaim のホームページURL（未ログイン時はくふうアカウントのログインページへリダイレクトされる）
   */
  static get home(): string {
    return joinUrl(this.ZAIM_BASE_URL, "/home");
  }

  /**
   * Zaim のログイン開始URL（くふうアカウントのログインページへリダイレクトされる）
   */
  static get login(): string {
    return joinUrl(this.ZAIM_BASE_URL, "/user_session/new");
  }

  /**
   * Zaim の収入入力ページURL
   */
  static get moneyNewIncome(): string {
    return joinUrl(this.ZAIM_BASE_URL, "/money/new?toggle=income");
  }

  /**
   * くふうアカウントの2段階認証ページのパス
   */
  static get kufuTotpPath(): string {
    return "/signin/totp";
  }
}
