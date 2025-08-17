import { logger } from "../logger.js";
import { ZaimAuth } from "./auth.js";
import { Endpoint } from "./endpoints.js";
import { sendRequest } from "./request.js";
import type {
  Account,
  AccountListResponse,
  Category,
  CategoryListResponse,
  GetJournalEntryParam,
  JournalEntry,
  JournalEntryListResponse,
} from "./types.js";

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
    query?: Record<string, string>,
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

  async getJournalEntry({
    mode,
    startDate,
    endDate,
    limit,
    toAccountId,
    page = 1,
    activeOnly = true,
  }: GetJournalEntryParam): Promise<JournalEntry[]> {
    const url = Endpoint.money;
    const param: Record<string, string> = {
      mapping: "1",
      // APIリクエストでpageを未指定にすると全件取得になる模様
      page: String(Math.max(page, 1)),
    };
    if (mode) {
      param["mode"] = mode;
    }
    if (startDate) {
      param["start_date"] = startDate.format("YYYY-MM-DD");
    }
    if (endDate) {
      param["end_date"] = endDate.format("YYYY-MM-DD");
    }
    if (limit) {
      if (limit > 100) {
        logger.warn("limitに指定できる最大値は100です。100に切り下げて実行します。");
      }
      param["limit"] = String(Math.min(limit, 100));
    }
    const res = (await this.sendAuthenticatedRequest(
      url,
      "GET",
      param
    )) as JournalEntryListResponse;
    const journalEntries: JournalEntry[] = res.money;
    return journalEntries.filter((journalEntry) => {
      const conds = [];
      // active = 1のもの
      if (activeOnly) {
        conds.push(journalEntry.active === 1);
      }
      // to_account_idが一致するもの
      if (toAccountId) {
        conds.push(journalEntry.to_account_id === toAccountId);
      }
      return conds.every((c) => c);
    });
  }

  async getCategory(mode?: string, activeOnly = true): Promise<Category[]> {
    const url = Endpoint.category;
    const res = (await this.sendAuthenticatedRequest(url, "GET", {
      mapping: "1",
    })) as CategoryListResponse;
    const categories: Category[] = res.categories;
    return categories.filter((category) => {
      const conds = [];
      // active = 1のもの
      if (activeOnly) {
        conds.push(category.active === 1);
      }
      // modeが一致するもの
      if (mode) {
        conds.push(category.mode === mode);
      }
      return conds.every((c) => c);
    });
  }
}
