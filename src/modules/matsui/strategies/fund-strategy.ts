import type { Page } from "playwright";
import playwright from "playwright";
import type { Position } from "../../../types/matsui.js";
import { logger } from "../../logger.js";
import { parseNumber } from "../../utils.js";
import { getAuthenticationCode } from "../auth.js";
import { backupCookies } from "../browser.js";
import { MatsuiPage } from "../page.js";
import type { AssetScrapingStrategy } from "./strategy-interface.js";

const { CHROMIUM_USER_DATA_DIR_MATSUI, MATSUI_LOGIN_ID, MATSUI_PASSWORD } = process.env;

/**
 * 投資信託の資産データをスクレイピングする戦略
 */
export class FundStrategy implements AssetScrapingStrategy<Position> {
  async isSessionValid(page: Page): Promise<boolean> {
    try {
      await page.goto(MatsuiPage.tradeMemberHome, { timeout: 10000 });
      const url = page.url();

      // メンテナンスページにリダイレクトされた場合
      if (url.includes(MatsuiPage.tradeMente)) {
        throw new Error("メンテナンス中のため同期を実行できません。");
      }

      // ログインページにリダイレクトされていないかチェック
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
    await page.goto(MatsuiPage.tradeLogin);
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
      page.waitForURL(MatsuiPage.tradeMemberHome, { timeout: 10000 }),
      authButton.click(),
    ]);
    logger.info("認証ボタンをクリックしました。");

    // ログイン成功後にCookieを保存
    await backupCookies(page, CHROMIUM_USER_DATA_DIR_MATSUI!);
  }

  async prepareTargetPage(page: Page): Promise<Page> {
    // 投資信託メニューをクリック
    const mutualFundMenuLink = page
      .locator('#common-header [data-page="mutual-fund-top"]')
      .locator("visible=true")
      .first();
    await mutualFundMenuLink.click();
    logger.info("「投資信託」メニューをクリックしました。");

    // 起動ボタンをクリック（別画面に遷移）
    const activateButton = page.locator(
      '[data-page="activate-mutual-fund-screen"] .btn-menu-activate-mutual-fund-screen'
    );
    await activateButton.waitFor({ state: "visible", timeout: 10000 });
    await activateButton.click();
    logger.info("投資信託サイトの起動ボタンをクリックしました。");

    // 画面遷移の待機
    await page.waitForLoadState("networkidle");

    // iframe内の「起動する」画像をクリックして新しいタブが開くのを待つ
    const iframe = page.frameLocator("#net-stock-contents");
    logger.info("iframeの読み込みを待機中...");

    const ctFrame = iframe.frameLocator('frame[name="CT"]');
    logger.info("CTフレームを取得しました。");

    // frame内の起動ボタン (name="kidouButton"のimg要素の親a要素) を取得
    const launchButton = ctFrame.locator('a:has(img[name="kidouButton"])');
    await launchButton.waitFor({ state: "visible", timeout: 30000 });
    logger.info("起動ボタンが表示されました。");

    // 起動ボタンをクリックして新しいタブが開くのを待つ
    const [newPage] = await Promise.all([
      page.context().waitForEvent("page"),
      launchButton.click(),
    ]);
    logger.info("投資信託サイトの起動ボタンをクリックしました。");

    await newPage.waitForLoadState("networkidle");
    logger.info("投資信託サイトが起動しました。");

    // 既存の残高照会ページ遷移処理
    await newPage.goto(MatsuiPage.position);
    await newPage.waitForLoadState("networkidle");
    logger.info("残高照会ページに遷移しました。");

    // メインのコンテナが表示され、残高の読み込みが完了する（「※該当するデータがありません。」の要素が消える）まで待機する
    await newPage.locator("#currentPortfolioInquiry").waitFor({ state: "visible", timeout: 30000 });
    await newPage
      .locator("#currentPortfolioInquiry .noRecord")
      .waitFor({ state: "detached", timeout: 30000 });

    return newPage;
  }

  async scrapeAssets(page: Page): Promise<Position> {
    // テーブルデータのパース
    const trs = await page
      .locator("#currentPortfolioInquiry h4", { hasText: "全保有銘柄" })
      .locator("+ table tr")
      .all();
    const getRowData = async (tr: playwright.Locator) =>
      (await tr.allInnerTexts())
        // 同じセルに表示されている評価損益と損益率を分離するため、正規表現で括弧を削除してから分割する
        .map((text) => text.replace(/\s[(|)]\s/g, "\n"))
        .join("")
        .split(/\s+/);
    const [_, ...body] = await Promise.all(trs.map(getRowData));
    const totalRow = body[body.length - 1];
    if (!totalRow || totalRow[0] !== "合計") {
      throw new Error("合計行を取得できませんでした。");
    }

    const positionData: Position = {
      details: Object.fromEntries(
        body.slice(0, -1).map((row) => [
          row[0],
          {
            評価額: row[1] ? parseNumber(row[1]) : undefined,
            評価損益: row[2] ? parseNumber(row[2]) : undefined,
            損益率: row[3] ? parseNumber(row[3]) : undefined,
          },
        ])
      ),
      total: {
        評価額: totalRow[1] ? parseNumber(totalRow[1]) : undefined,
        評価損益: totalRow[2] ? parseNumber(totalRow[2]) : undefined,
        損益率: totalRow[3] ? parseNumber(totalRow[3]) : undefined,
      },
    };

    return positionData;
  }
}
