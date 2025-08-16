/**
 * Zaim APIおよび認証エンドポイントのURL
 */
export class Endpoint {
  private static readonly ZAIM_API_BASE_URL = "https://api.zaim.net";
  private static readonly ZAIM_AUTH_BASE_URL = "https://auth.zaim.net";

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
   * ユーザー認可のための認証画面URL
   */
  static get authorize(): string {
    return this.getFullUrl(this.ZAIM_AUTH_BASE_URL, "/users/auth");
  }

  /**
   * リクエストトークン取得のためのAPIエンドポイントURL (`/v2/auth/request`)
   */
  static get requestToken(): string {
    return this.getFullUrl(this.ZAIM_API_BASE_URL, "/v2/auth/request");
  }

  /**
   * アクセストークン取得のためのAPIエンドポイントURL (`/v2/auth/access`)
   */
  static get accessToken(): string {
    return this.getFullUrl(this.ZAIM_API_BASE_URL, "/v2/auth/access");
  }

  /**
   * 口座リスト取得のためのAPIエンドポイントURL (`/v2/home/account`)
   */
  static get account(): string {
    return this.getFullUrl(this.ZAIM_API_BASE_URL, "/v2/home/account");
  }

  /**
   * 入出金・振替の履歴データ取得のためのAPIエンドポイントURL (`/v2/home/money`)
   */
  static get money(): string {
    return this.getFullUrl(this.ZAIM_API_BASE_URL, "/v2/home/money");
  }
}
