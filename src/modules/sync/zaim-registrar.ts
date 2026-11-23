import type { Page } from "playwright";
import { logger } from "../logger.js";
import type { Zaim } from "../zaim/client.js";
import type { RegisterIncomeJournalEntryParam } from "../zaim/types.js";

/**
 * 収入登録のオプション
 */
export interface RegisterIncomeOptions {
  /** true の場合、登録の直前までの処理を行い、Zaim への登録は行わない */
  dryRun?: boolean;
}

/**
 * Zaim に収入を登録するコンポーネントのインターフェース
 */
export interface ZaimRegistrar {
  /**
   * 収入を登録する（ドライランの場合は、登録の直前までの処理を行う）
   *
   * @param params 登録内容
   * @param options 登録のオプション
   */
  registerIncome(
    params: RegisterIncomeJournalEntryParam,
    options?: RegisterIncomeOptions,
  ): Promise<void>;

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

  async registerIncome(
    params: RegisterIncomeJournalEntryParam,
    { dryRun = false }: RegisterIncomeOptions = {},
  ): Promise<void> {
    if (dryRun) {
      logger.info("ドライランのため Zaim API への登録は行いません。");
      return;
    }
    await this.zaimClient.registerIncomeJournalEntry(params);
  }

  async close(): Promise<void> {}
}
