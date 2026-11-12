import type { Dayjs } from "dayjs";
import type { BrowserContext, Dialog, Locator, Page } from "playwright";
import { logger } from "../logger.js";
import { getStorageStatePath, openBrowser, saveStorageState } from "../matsui/browser.js";
import type { ZaimRegistrar } from "../sync/zaim-registrar.js";
import type { RegisterIncomeJournalEntryParam } from "../zaim/types.js";
import { isZaimSessionValid, loginToZaim } from "./login.js";
import { ZaimWebPage } from "./page.js";
import {
  INCOME_REGISTERED_MESSAGE,
  IncomeFormFieldTitle,
  IncomeFormSelector,
} from "./selectors.js";

const { CHROMIUM_USER_DATA_DIR_ZAIM, HEADLESS } = process.env;

/**
 * 金額欄の表示値（例: "1,234"、"-311"）を数値の文字列に正規化する
 *
 * @param displayValue 金額欄の表示値
 * @returns 桁区切り等を除いた文字列
 */
export function normalizeAmountDisplay(displayValue: string): string {
  return displayValue.replace(/[^-\d.]/g, "");
}

/**
 * 日付欄の表示値（例: "2026年11月11日(水)"）が指定日と一致するかを判定する
 *
 * @param displayValue 日付欄の表示値
 * @param date 比較する日付
 * @returns 一致すれば true
 */
export function isSameDateDisplay(displayValue: string, date: Dayjs): boolean {
  return displayValue.startsWith(date.format("YYYY年M月D日"));
}

/**
 * Zaim のウェブ画面を操作して収入を登録する
 *
 * ブラウザは初回の登録時に起動し、ログインセッションはユーザーデータディレクトリと
 * storage-state.json に保存して次回以降も再利用する。
 */
export class ZaimWebRegistrar implements ZaimRegistrar {
  private browserContext: BrowserContext | null = null;
  private page: Page | null = null;

  /**
   * @param options.submit false の場合、フォームの入力と検証までを行い「入力する」ボタンは押さない（動作確認用）
   */
  constructor(private options: { submit?: boolean } = {}) {}

  get activePage(): Page | null {
    return this.page && !this.page.isClosed() ? this.page : null;
  }

  /**
   * ブラウザを起動し、セッションが無効であればログインしてセッションを保存する
   */
  async login(): Promise<void> {
    await this.ensureLoggedIn();
  }

  /**
   * ブラウザを起動し、必要に応じてログインする
   *
   * @returns 操作対象のページ
   */
  private async ensureLoggedIn(): Promise<Page> {
    if (this.page) return this.page;

    if (!CHROMIUM_USER_DATA_DIR_ZAIM) {
      throw new Error("環境変数 CHROMIUM_USER_DATA_DIR_ZAIM が設定されていません。");
    }

    const { browserContext, page } = await openBrowser(
      CHROMIUM_USER_DATA_DIR_ZAIM,
      HEADLESS === "true",
      getStorageStatePath(CHROMIUM_USER_DATA_DIR_ZAIM),
    );
    this.browserContext = browserContext;
    this.page = page;

    logger.info("Zaim のセッションの有効性をチェックします。");
    if (await isZaimSessionValid(page)) {
      logger.info("Zaim の既存のセッションを使用します。");
    } else {
      logger.info("Zaim のセッションが無効なため、ログインを実行します。");
      await loginToZaim(page);
      await saveStorageState(browserContext, CHROMIUM_USER_DATA_DIR_ZAIM);
    }
    return page;
  }

  /**
   * 項目名から入力画面の select 要素を取得する
   *
   * @param form フォームのロケーター
   * @param title 項目名
   * @returns select 要素のロケーター
   */
  private getSelectByTitle(form: Locator, title: string): Locator {
    return form
      .locator(IncomeFormSelector.field)
      .filter({ has: form.page().locator(IncomeFormSelector.fieldTitle, { hasText: title }) })
      .locator("select");
  }

  /**
   * select 要素で指定した値を選択する（選択肢が存在しない場合はエラー）
   *
   * @param select select 要素のロケーター
   * @param value 選択する値
   * @param label エラーメッセージ用の項目名
   */
  private async selectById(select: Locator, value: number, label: string): Promise<void> {
    const values = await select.locator("option").evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
    if (!values.includes(String(value))) {
      throw new Error(`Zaim の入力画面の「${label}」に ID ${value} の選択肢がありません。`);
    }
    await select.selectOption(String(value));
  }

  /**
   * 金額欄に金額を入力する
   *
   * 金額欄は読み取り専用の電卓入力のため、画面が備える貼り付け処理を利用して入力する。
   * 貼り付け処理はマイナスの金額にも対応している。
   *
   * @param amountInput 金額欄のロケーター
   * @param amount 金額
   */
  private async fillAmount(amountInput: Locator, amount: number): Promise<void> {
    await amountInput.evaluate((input, text) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text", text);
      input.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
      );
    }, String(amount));

    const displayValue = await amountInput.inputValue();
    if (normalizeAmountDisplay(displayValue) !== String(amount)) {
      throw new Error(
        `Zaim の入力画面の金額欄に正しく入力できませんでした（期待値: ${amount}、表示値: ${displayValue}）。`,
      );
    }
  }

  async registerIncome(params: RegisterIncomeJournalEntryParam): Promise<void> {
    const page = await this.ensureLoggedIn();
    await page.goto(ZaimWebPage.moneyNewIncome);

    const form = page.locator(IncomeFormSelector.form);
    const amountInput = form.locator(IncomeFormSelector.amount);
    await amountInput.waitFor({ state: "visible" });

    // 日付は当日が初期値で、日付選択の操作には対応していない
    const dateDisplay = await form.locator(IncomeFormSelector.date).inputValue();
    if (!isSameDateDisplay(dateDisplay, params.date)) {
      throw new Error(
        `ウェブ画面からの登録は当日の日付のみ対応しています（指定日: ${params.date.format("YYYY-MM-DD")}、画面の日付: ${dateDisplay}）。`,
      );
    }

    await this.fillAmount(amountInput, params.amount);
    await this.selectById(
      this.getSelectByTitle(form, IncomeFormFieldTitle.category),
      params.categoryId,
      IncomeFormFieldTitle.category,
    );
    if (params.toAccountId !== undefined) {
      await this.selectById(
        this.getSelectByTitle(form, IncomeFormFieldTitle.account),
        params.toAccountId,
        IncomeFormFieldTitle.account,
      );
    }
    if (params.comment !== undefined) {
      await form.locator(IncomeFormSelector.comment).fill(params.comment);
    }
    logger.info("Zaim の入力画面に収入の内容を入力しました。");

    if (this.options.submit === false) {
      logger.info("送信しない設定のため、「入力する」ボタンは押さずに終了します。");
      return;
    }

    // 入力値の検証エラーは alert ダイアログで通知され、ページは遷移しない
    let onDialog: ((dialog: Dialog) => Promise<void>) | undefined;
    const dialogMessage = new Promise<string>((resolve) => {
      onDialog = async (dialog) => {
        resolve(dialog.message());
        await dialog.dismiss();
      };
      page.once("dialog", onDialog);
    });

    const successAlert = page.locator(IncomeFormSelector.successAlert, {
      hasText: INCOME_REGISTERED_MESSAGE,
    });
    const errorAlert = page.locator(IncomeFormSelector.errorAlert);
    try {
      await form.locator(IncomeFormSelector.submit).click();

      // 待機の失敗（タイムアウト）は値として受け取り、レース後に未処理の reject が残らないようにする
      const alertShown = successAlert
        .or(errorAlert)
        .first()
        .waitFor({ state: "visible", timeout: 30000 })
        .then(
          () => ({ type: "alert" }) as const,
          (error: unknown) => ({ type: "timeout", error }) as const,
        );
      const result = await Promise.race([
        alertShown,
        dialogMessage.then((message) => ({ type: "dialog", message }) as const),
      ]);
      if (result.type === "dialog") {
        throw new Error(`Zaim の入力画面で入力エラーが発生しました: ${result.message}`);
      }
      if (result.type === "timeout") {
        throw result.error;
      }
    } finally {
      if (onDialog) page.off("dialog", onDialog);
    }
    if (!(await successAlert.isVisible())) {
      const message = (await errorAlert.first().textContent())?.trim() ?? "";
      throw new Error(`Zaim の入力画面で登録に失敗しました: ${message}`);
    }
    logger.info("Zaim のウェブ画面から収入を登録しました。");
  }

  async close(): Promise<void> {
    if (this.browserContext) {
      await this.browserContext.close();
    }
    this.browserContext = null;
    this.page = null;
  }
}
