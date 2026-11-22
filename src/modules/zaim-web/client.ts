import type { Dayjs } from "dayjs";
import type { Dialog, Locator, Page } from "playwright";
import { PersistentBrowser } from "../browser.js";
import { logger } from "../logger.js";
import {
  type RegisterIncomeOptions,
  RegistrationUnconfirmedError,
  type ZaimRegistrar,
} from "../sync/zaim-registrar.js";
import type { RegisterIncomeJournalEntryParam } from "../zaim/types.js";
import { isZaimSessionValid, loginToZaim } from "./login.js";
import { ZaimWebPage } from "./page.js";
import {
  INCOME_REGISTERED_MESSAGE,
  IncomeFormFieldTitle,
  IncomeFormSelector,
} from "./selectors.js";

const { CHROMIUM_USER_DATA_DIR_ZAIM, HEADLESS } = process.env;

/** 「入力する」ボタン押下後に、登録結果の表示を待つ最大時間（ミリ秒） */
const SUBMIT_RESULT_TIMEOUT_MS = 30000;
/** 登録結果の表示待ちで、ダイアログの確認を挟む間隔（ミリ秒） */
const SUBMIT_RESULT_POLL_MS = 1000;

/**
 * 送信後に、登録されなかったこと（入力エラーのダイアログ・エラー表示）を確認できたことを表すエラー
 */
class RegistrationRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistrationRejectedError";
  }
}

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
  private browser: PersistentBrowser | null = null;
  private page: Page | null = null;
  private loggedIn = false;

  get activePage(): Page | null {
    return this.page && !this.page.isClosed() ? this.page : null;
  }

  /**
   * ブラウザを起動し、指定したページを開く（セッションが無効であればログインしてセッションを保存する）
   *
   * ログイン済みの場合は、セッションの確認を兼ねて指定したページを開く。
   * ログインに失敗した場合は、次回の呼び出しで再度ログインを試みる。
   *
   * @param landingUrl 開くページのURL（既定: Zaim のホーム）
   * @returns 操作対象のページ（landingUrl を開いた状態）
   */
  async login(landingUrl: string = ZaimWebPage.home): Promise<Page> {
    if (this.page && this.loggedIn) {
      await this.page.goto(landingUrl);
      return this.page;
    }

    if (!this.browser || !this.page) {
      if (!CHROMIUM_USER_DATA_DIR_ZAIM) {
        throw new Error("環境変数 CHROMIUM_USER_DATA_DIR_ZAIM が設定されていません。");
      }
      this.browser = new PersistentBrowser(CHROMIUM_USER_DATA_DIR_ZAIM, {
        headless: HEADLESS === "true",
        restoreStorageState: true,
      });
      ({ page: this.page } = await this.browser.open());
    }

    logger.info("Zaim のセッションの有効性をチェックします。");
    if (await isZaimSessionValid(this.page, landingUrl)) {
      logger.info("Zaim の既存のセッションを使用します。");
    } else {
      logger.info("Zaim のセッションが無効なため、ログインを実行します。");
      await loginToZaim(this.page);
      await this.browser.saveState();
      await this.page.goto(landingUrl);
    }
    this.loggedIn = true;
    return this.page;
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
    const values = await select
      .locator("option")
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
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

  async registerIncome(
    params: RegisterIncomeJournalEntryParam,
    { dryRun = false }: RegisterIncomeOptions = {},
  ): Promise<void> {
    const page = await this.login(ZaimWebPage.moneyNewIncome);

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

    if (dryRun) {
      logger.info("ドライランのため「入力する」ボタンは押さず、Zaim への登録は行いません。");
      return;
    }

    // 入力値の検証エラーは alert ダイアログで通知され、ページは遷移しない
    let dialogMessage: string | undefined;
    const onDialog = async (dialog: Dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    };
    page.once("dialog", onDialog);

    const successAlert = page.locator(IncomeFormSelector.successAlert, {
      hasText: INCOME_REGISTERED_MESSAGE,
    });
    const errorAlert = page.locator(IncomeFormSelector.errorAlert);
    try {
      // Playwright の click() は、操作可能になるのを待つ段階で失敗した場合はクリックしないため、
      // ここでの失敗は送信前の失敗として扱う
      await form.locator(IncomeFormSelector.submit).click();

      // 送信後は、登録されなかったことを確認できた場合（ダイアログ・エラー表示）を除き、
      // 結果を確認できなければ登録済みの可能性があるものとして RegistrationUnconfirmedError とする
      let succeeded: boolean;
      try {
        succeeded = await this.waitForSubmitResult(successAlert, errorAlert, () => dialogMessage);
      } catch (error) {
        if (error instanceof RegistrationRejectedError) throw error;
        throw new RegistrationUnconfirmedError(
          `Zaim への登録を送信しましたが、結果を確認できませんでした: ${(error as Error).message}`,
          { cause: error },
        );
      }
      if (!succeeded) {
        const message = (await errorAlert.first().textContent())?.trim() ?? "";
        throw new RegistrationRejectedError(`Zaim の入力画面で登録に失敗しました: ${message}`);
      }
    } finally {
      page.off("dialog", onDialog);
    }
    logger.info("Zaim のウェブ画面から収入を登録しました。");
  }

  /**
   * 「入力する」ボタン押下後の登録結果を待つ
   *
   * 結果の表示を短い間隔で待ち、その間にダイアログが表示されていないかを確認する
   * （待機を打ち切れないため、1 回の待機を短くして残留させない）。
   *
   * @param successAlert 登録成功時のメッセージのロケーター
   * @param errorAlert 登録失敗時のメッセージのロケーター
   * @param getDialogMessage 表示されたダイアログのメッセージを返す関数
   * @returns 成功のメッセージが表示されれば true、失敗のメッセージが表示されれば false
   * @throws RegistrationRejectedError 入力エラーのダイアログが表示された場合
   * @throws Error 結果が表示されないままタイムアウトした場合
   */
  private async waitForSubmitResult(
    successAlert: Locator,
    errorAlert: Locator,
    getDialogMessage: () => string | undefined,
  ): Promise<boolean> {
    const resultAlert = successAlert.or(errorAlert).first();
    const deadline = Date.now() + SUBMIT_RESULT_TIMEOUT_MS;
    for (;;) {
      const dialogMessage = getDialogMessage();
      if (dialogMessage !== undefined) {
        throw new RegistrationRejectedError(
          `Zaim の入力画面で入力エラーが発生しました: ${dialogMessage}`,
        );
      }
      if (Date.now() >= deadline) {
        throw new Error("Zaim の登録結果が表示されるまでにタイムアウトしました。");
      }
      const shown = await resultAlert
        .waitFor({ state: "visible", timeout: SUBMIT_RESULT_POLL_MS })
        .then(
          () => true,
          () => false,
        );
      if (shown) return successAlert.isVisible();
    }
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
    this.page = null;
    this.loggedIn = false;
  }
}
