/**
 * Zaim ウェブサイトおよびくふうアカウントの各ページのURL
 */
export class ZaimWebPage {
  private static readonly ZAIM_BASE_URL = "https://zaim.net";
  private static readonly KUFU_ID_BASE_URL = "https://id.kufu.jp";

  /**
   * ベースURLとパスを結合し、正規化された完全なURLを返す。
   *
   * @param baseUrl - ベースとなるURL
   * @param path - URLパス
   * @returns 正規化された完全なURL
   */
  private static getFullUrl(baseUrl: string, path: string): string {
    const normalizedPath = path.startsWith("/") ? path.substring(1) : path;
    return `${baseUrl}/${normalizedPath}`;
  }

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
    return this.getFullUrl(this.ZAIM_BASE_URL, "/home");
  }

  /**
   * Zaim のログイン開始URL（くふうアカウントのログインページへリダイレクトされる）
   */
  static get login(): string {
    return this.getFullUrl(this.ZAIM_BASE_URL, "/user_session/new");
  }

  /**
   * Zaim の収入入力ページURL
   */
  static get moneyNewIncome(): string {
    return this.getFullUrl(this.ZAIM_BASE_URL, "/money/new?toggle=income");
  }

  /**
   * くふうアカウントの2段階認証ページのパス
   */
  static get kufuTotpPath(): string {
    return "/signin/totp";
  }
}
