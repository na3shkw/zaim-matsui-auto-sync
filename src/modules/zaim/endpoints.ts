import { joinUrl } from "../utils.js";

/**
 * Zaim APIおよび認証エンドポイントのURL
 */
export class Endpoint {
  private static readonly ZAIM_API_BASE_URL = "https://api.zaim.net";
  private static readonly ZAIM_AUTH_BASE_URL = "https://auth.zaim.net";

  /**
   * ユーザー認可のための認証画面URL
   */
  static get authorize(): string {
    return joinUrl(this.ZAIM_AUTH_BASE_URL, "/users/auth");
  }

  /**
   * リクエストトークン取得のためのAPIエンドポイントURL (`/v2/auth/request`)
   */
  static get requestToken(): string {
    return joinUrl(this.ZAIM_API_BASE_URL, "/v2/auth/request");
  }

  /**
   * アクセストークン取得のためのAPIエンドポイントURL (`/v2/auth/access`)
   */
  static get accessToken(): string {
    return joinUrl(this.ZAIM_API_BASE_URL, "/v2/auth/access");
  }

  /**
   * 口座リスト取得のためのAPIエンドポイントURL (`/v2/home/account`)
   */
  static get account(): string {
    return joinUrl(this.ZAIM_API_BASE_URL, "/v2/home/account");
  }

  /**
   * 入出金・振替の履歴データ取得のためのAPIエンドポイントURL (`/v2/home/money`)
   */
  static get money(): string {
    return joinUrl(this.ZAIM_API_BASE_URL, "/v2/home/money");
  }

  /**
   * 入金データ登録のためのAPIエンドポイントURL (`/v2/home/money/income`)
   */
  static get moneyIncome(): string {
    return joinUrl(this.ZAIM_API_BASE_URL, "/v2/home/money/income");
  }

  /**
   * カテゴリリスト取得のためのAPIエンドポイントURL (`/v2/home/category`)
   */
  static get category(): string {
    return joinUrl(this.ZAIM_API_BASE_URL, "/v2/home/category");
  }
}
