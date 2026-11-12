import type { Page } from "playwright";
import type { Zaim } from "../zaim/client.js";
import type { RegisterIncomeJournalEntryParam } from "../zaim/types.js";

/**
 * Zaim への収入登録方式
 */
export type ZaimRegisterMethod = "api" | "web";

/**
 * Zaim に収入を登録するコンポーネントのインターフェース
 */
export interface ZaimRegistrar {
  /**
   * 収入を登録する
   *
   * @param params 登録内容
   */
  registerIncome(params: RegisterIncomeJournalEntryParam): Promise<void>;

  /**
   * 使用中のリソース（ブラウザ等）を解放する
   */
  close(): Promise<void>;

  /**
   * エラー発生時に記録するページ（ブラウザを使用しない場合は null）
   */
  readonly activePage: Page | null;
}

/**
 * Zaim API を使用して収入を登録する
 */
export class ZaimApiRegistrar implements ZaimRegistrar {
  readonly activePage = null;

  constructor(private zaimClient: Zaim) {}

  async registerIncome(params: RegisterIncomeJournalEntryParam): Promise<void> {
    await this.zaimClient.registerIncomeJournalEntry(params);
  }

  async close(): Promise<void> {}
}
