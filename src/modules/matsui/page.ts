/**
 * 松井証券の各ページのURL
 */
export class MatsuiPage {
  private static readonly MATSUI_WWW_BASE_URL = "https://www.matsui.co.jp";
  private static readonly MATSUI_FUND_BASE_URL = "https://fund.matsui.co.jp";

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
   * 投資信託トップページのURL
   */
  static get home(): string {
    return this.getFullUrl(this.MATSUI_FUND_BASE_URL, "/ra/robo-advisor/page/main.html#!/home");
  }

  /**
   * 投資信託ログインURL
   */
  static get login(): string {
    return this.getFullUrl(this.MATSUI_FUND_BASE_URL, "/ra/robo-advisor/m_login/login.html");
  }

  /**
   * 投資信託残高照会のURL
   */
  static get position(): string {
    return this.getFullUrl(this.MATSUI_FUND_BASE_URL, "/ra/robo-advisor/page/main.html#!/position");
  }

  /**
   * 投資信託メンテナンス時にリダイレクトで遷移するURL
   */
  static get fundMente(): string {
    return this.getFullUrl(this.MATSUI_WWW_BASE_URL, "/utility/fund/mente/index.html#!/home");
  }
}
