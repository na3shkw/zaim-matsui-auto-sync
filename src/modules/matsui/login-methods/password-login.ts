import type { Page } from "playwright";
import { logger } from "../../logger.js";
import { getAuthenticationCode } from "../auth.js";
import { saveStorageState } from "../browser.js";
import { MatsuiPage } from "../page.js";
import type { MatsuiLoginMethod } from "./login-method.js";

const { CHROMIUM_USER_DATA_DIR_MATSUI, MATSUI_LOGIN_ID, MATSUI_PASSWORD } = process.env;

/**
 * パスワード認証によるログイン実装
 */
export class PasswordLoginMethod implements MatsuiLoginMethod {
  async isSessionValid(page: Page): Promise<boolean> {
    try {
      await this.navigateToHome(page);
      return !page.url().includes("/login");
    } catch (error) {
      if (error instanceof Error && error.message.includes("メンテナンス")) {
        throw error;
      }
      logger.error(error, "セッション有効性チェック中にエラーが発生しました。");
      return false;
    }
  }

  private async navigateToHome(page: Page): Promise<void> {
    await page.goto(MatsuiPage.tradeMemberHome, { timeout: 10000 });
    if (page.url().includes(MatsuiPage.tradeMente)) {
      throw new Error("メンテナンス中のため同期を実行できません。");
    }
  }

  async login(page: Page): Promise<void> {
    if (!MATSUI_LOGIN_ID || !MATSUI_PASSWORD) {
      throw new Error("環境変数 MATSUI_LOGIN_ID または MATSUI_PASSWORD が設定されていません。");
    }

    // ログインページに移動
    await page.goto(MatsuiPage.tradeLogin);
    await page.locator("#login-id").waitFor({ state: "visible" });

    // ログイン情報を入力
    await page.fill("#login-id", MATSUI_LOGIN_ID);
    await page.fill("#login-password", MATSUI_PASSWORD);
    logger.info("ログイン情報を入力しました。");

    // ログインボタンをクリック
    const loginButton = page.locator('#login-id-area button[type="submit"]');
    await Promise.all([page.waitForURL("**", { timeout: 10000 }), loginButton.click()]);
    logger.info("ログインボタンをクリックしました。");

    // メンテナンスページにリダイレクトされた場合
    const currentUrl = page.url();
    if (currentUrl.includes(MatsuiPage.tradeMente)) {
      throw new Error("メンテナンス中のため同期を実行できません。");
    }

    // 認証コードを入力
    const { authenticationCode } = await getAuthenticationCode();
    await page.fill('input[name="auth-number"]', authenticationCode);
    logger.info("認証コードを入力しました。");

    // 認証ボタンをクリック
    const authButton = page.locator("#auth-btn");
    await Promise.all([
      page.waitForURL(MatsuiPage.tradeMemberHome, { timeout: 10000 }),
      authButton.click(),
    ]);
    logger.info("認証ボタンをクリックしました。");

    // ログイン成功後にストレージ状態を保存
    await saveStorageState(page.context(), CHROMIUM_USER_DATA_DIR_MATSUI!);
  }
}
