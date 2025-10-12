import type { Page } from "playwright";
import type { UsStockAsset } from "../../../types/matsui.js";
import { logger } from "../../logger.js";
import { parseNumber } from "../../utils.js";
import { getAuthenticationCode } from "../auth.js";
import { backupCookies } from "../browser.js";
import { MatsuiPage } from "../page.js";
import type { AssetScrapingStrategy } from "./strategy-interface.js";

const { CHROMIUM_USER_DATA_DIR_MATSUI, MATSUI_LOGIN_ID, MATSUI_PASSWORD } = process.env;

/**
 * 米国株の資産データをスクレイピングする戦略
 */
export class UsStockStrategy implements AssetScrapingStrategy<UsStockAsset> {
  async isSessionValid(page: Page): Promise<boolean> {
    try {
      await page.goto(MatsuiPage.usStockMemberHome, { timeout: 10000 });
      // ログインページにリダイレクトされていないかチェック
      const url = page.url();
      // TODO: メンテナンスページにリダイレクトされた場合の処理を実装
      return !url.includes("/login");
    } catch (error) {
      logger.error(error, "セッション有効性チェック中にエラーが発生しました。");
      return false;
    }
  }

  async login(page: Page): Promise<void> {
    if (!MATSUI_LOGIN_ID || !MATSUI_PASSWORD) {
      throw new Error("環境変数 MATSUI_LOGIN_ID または MATSUI_PASSWORD が設定されていません。");
    }

    // ログインページに移動
    await page.goto(MatsuiPage.usStockLogin);
    await page.waitForLoadState("networkidle");

    // ログイン情報を入力
    await page.fill("#login-id", MATSUI_LOGIN_ID);
    await page.fill("#login-password", MATSUI_PASSWORD);
    logger.info("ログイン情報を入力しました。");

    // ログインボタンをクリック
    const loginButton = page.locator("button").filter({ hasText: "ログイン" });
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
      page.waitForURL(MatsuiPage.usStockMemberHome, { timeout: 10000 }),
      authButton.click(),
    ]);
    logger.info("認証ボタンをクリックしました。");

    // ログイン成功後にCookieを保存
    await backupCookies(page, CHROMIUM_USER_DATA_DIR_MATSUI!);
  }

  async prepareTargetPage(page: Page): Promise<Page> {
    // 米国株ページを表示
    const usStockPageLink = page.locator('[data-page="us-stock-trade-top"]');
    await usStockPageLink.click();
    logger.info("米国株ページリンクをクリックしました。");

    // 起動ボタンが表示されるまで待機
    const launchButton = page.locator(".us-stock-trade > div").first();
    await launchButton.waitFor({ state: "visible", timeout: 10000 });

    // 起動ボタンをクリックして新しいタブが開くのを待つ
    const [newPage] = await Promise.all([
      page.context().waitForEvent("page"),
      launchButton.click(),
    ]);
    logger.info("米国株用サイトの起動ボタンをクリックしました。");

    await newPage.waitForLoadState("networkidle");
    logger.info("米国株用サイトが起動しました。");

    // お客様へのご連絡表示が出た場合は「あとで確認」ボタンをクリック
    const currentUrl = newPage.url();
    if (currentUrl.includes("/notify")) {
      const laterButton = newPage.locator("div.btn").filter({ hasText: "あとで確認" });
      await laterButton.click();
      logger.info("「あとで確認」ボタンをクリックしました。");
      await newPage.waitForURL(MatsuiPage.usStockHome, { timeout: 10000 });
    }

    // 米国株の評価額を表示するページに遷移
    await newPage.goto(MatsuiPage.usStockPosition);
    await newPage.waitForLoadState("networkidle");
    logger.info("米国株の評価額ページに遷移しました。");

    // total-summaryコンテナが表示されるまで待機
    const totalSummary = newPage.locator(".total-summary");
    await totalSummary.waitFor({ state: "visible", timeout: 30000 });

    // 円表示に切り替え
    const controlRow = newPage.locator(".control-row").filter({ hasText: "円" });
    const yenButton = controlRow.locator("button.btn").filter({ hasText: "円" });
    await yenButton.click();
    logger.info("円表示に切り替えました。");

    // 円表示に切り替わるまで待機（.total-priceに「円」が含まれることを確認）
    await totalSummary
      .locator(".total-price")
      .filter({ hasText: "円" })
      .first()
      .waitFor({ state: "visible", timeout: 10000 });

    return newPage;
  }

  async scrapeAssets(page: Page): Promise<UsStockAsset> {
    // 各サマリーアイテムを取得
    const totalSummary = page.locator(".total-summary");
    const summaryItems = totalSummary.locator(".total-summary-item");
    const itemCount = await summaryItems.count();

    let totalProfit: number | undefined;
    let totalProfitRate: number | undefined;
    let totalAmount: number | undefined;
    let dailyChange: number | undefined;

    // 各アイテムを処理
    for (let i = 0; i < itemCount; i++) {
      const item = summaryItems.nth(i);
      const titleDiv = item.locator(".title > div").first();
      const titleText = await titleDiv.innerText();

      // 株式評価損益合計と評価損益率
      if (titleText.includes("株式評価損益合計")) {
        const prices = item.locator(".price-cell .total-price");
        const priceCount = await prices.count();
        if (priceCount >= 2) {
          const profitText = await prices.nth(0).innerText();
          const profitRateText = await prices.nth(1).innerText();
          // 単位（円、%）を除去してから数値化
          totalProfit = parseNumber(profitText.replace(/円/g, ""));
          totalProfitRate = parseNumber(profitRateText.replace(/%/g, ""));
        }
      }
      // 株式時価総額合計と前日比合計
      else if (titleText.includes("株式時価総額合計")) {
        const prices = item.locator(".price-cell .total-price");
        const priceCount = await prices.count();
        if (priceCount >= 2) {
          const amountText = await prices.nth(0).innerText();
          const changeText = await prices.nth(1).innerText();
          // 単位（円）を除去してから数値化
          totalAmount = parseNumber(amountText.replace(/円/g, ""));
          dailyChange = parseNumber(changeText.replace(/円/g, ""));
        }
      }
    }

    // 必要な値が取得できたかチェック
    if (
      totalProfit === undefined ||
      totalProfitRate === undefined ||
      totalAmount === undefined ||
      dailyChange === undefined
    ) {
      throw new Error("米国株の評価額データを取得できませんでした。");
    }

    return {
      totalProfit,
      totalProfitRate,
      totalAmount,
      dailyChange,
    };
  }
}
