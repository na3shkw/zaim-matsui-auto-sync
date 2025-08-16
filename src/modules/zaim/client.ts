import { ZaimAuth } from "./auth.js";
import { Endpoint } from "./endpoints.js";
import { sendRequest } from "./request.js";
import type { Account, AccountListResponse } from "./types.js";

export class Zaim {
  private oauth: ZaimAuth;

  constructor(authenticate = false) {
    this.oauth = new ZaimAuth(authenticate);
  }

  /**
   * 認証情報付きHTTPSリクエストを送信する
   *
   * @param url URL
   * @param method HTTPメソッド
   * @param query クエリパラメータのオブジェクト
   * @param body リクエストボディ
   * @returns レスポンス
   */
  private async sendAuthenticatedRequest(
    url: string,
    method: string = "GET",
    query: Record<string, string> = {},
    body?: string
  ): Promise<Record<string, any>> {
    // クエリパラメータをURLに追加する
    if (query) {
      url = `${url}?${new URLSearchParams(query).toString()}`;
    }

    const authHeader = this.oauth.generateAuthHeader(method, url, query);

    const jsonString = await sendRequest(
      url,
      method,
      {
        Authorization: authHeader,
      },
      body
    );
    return JSON.parse(jsonString);
  }

  async getAccount(name?: string, activeOnly = true): Promise<Account[]> {
    const url = Endpoint.account;
    const res = (await this.sendAuthenticatedRequest(url, "GET", {
      mapping: "1",
    })) as AccountListResponse;
    const accounts: Account[] = res.accounts;
    return accounts
      .filter((account) => {
        const conds = [];
        // active = 1のもの
        if (activeOnly) {
          conds.push(account.active === 1);
        }
        // 名前が部分一致するもの
        if (name) {
          conds.push(account.name.indexOf(name) !== -1);
        }
        return conds.every((c) => c);
      })
      .sort((a, b) => a.sort - b.sort);
  }
}
