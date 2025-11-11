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
      const response = await page.goto(MatsuiPage.home, { timeout: 10000 });
      const url = response?.url();

      // メンテナンス画面の場合
      if (url && MatsuiPage.fundMente.indexOf(url) !== -1) {
        throw new Error("メンテナンス中のため同期を実行できません。");
      }

      try {
        // モーダルが表示されるまで待機（最大10秒）
        await page.waitForSelector(".modal-container.dialog.error", {
          timeout: 10000,
          state: "visible",
        });
      } catch {
        return true;
      }
    } catch (error) {
      logger.error(error, "セッション有効性チェック中にエラーが発生しました。");
    }
    return false;
  }

  async login(page: Page): Promise<void> {
    if (!MATSUI_LOGIN_ID || !MATSUI_PASSWORD) {
      throw new Error("環境変数 MATSUI_LOGIN_ID または MATSUI_PASSWORD が設定されていません。");
    }

    const response = await page.goto(MatsuiPage.login);
    const url = response?.url();

    // メンテナンス画面にリダイレクトされた場合
    if (url && MatsuiPage.fundMente.indexOf(url) !== -1) {
      throw new Error("メンテナンス中のため同期を実行できません。");
    }

    await page.waitForLoadState("networkidle");

    // ログイン情報を入力
    await page.getByLabel("ログインID").fill(MATSUI_LOGIN_ID);
    await page.getByLabel("パスワード").fill(MATSUI_PASSWORD);

    // ページ遷移を待機しながらクリック
    await Promise.all([
      page.waitForURL("**", { timeout: 10000 }),
      page.getByRole("button", { name: "ログイン" }).click(),
    ]);
    logger.info("ログインフォームを送信しました。");

    const { authenticationCode } = await getAuthenticationCode();
    await page.fill(".inputAuthNumArea input[type='text']", authenticationCode);
    logger.info("認証コードを入力しました。");

    // 少し待ってから自動遷移したかどうかを確認
    await page.waitForTimeout(1000);

    // 認証ボタンがまだ存在するかチェック（自動遷移しなかった場合）
    const authButton = page.getByRole("button", { name: "認証する" });
    const buttonExists = (await authButton.count()) > 0;

    if (buttonExists) {
      await authButton.click();
      logger.info("自動遷移しなかったため、認証ボタンをクリックしました。");
    } else {
      logger.info("認証コード入力により自動遷移しました。");
    }

    // ログイン成功後にCookieを保存
    await backupCookies(page, CHROMIUM_USER_DATA_DIR_MATSUI!);
  }

  async prepareTargetPage(page: Page): Promise<Page> {
    await page.goto(MatsuiPage.position);
    // メインのコンテナが表示され、残高の読み込みが完了する（「※該当するデータがありません。」の要素が消える）まで待機する
    await page.locator("#currentPortfolioInquiry").waitFor({ state: "visible", timeout: 30000 });
    await page
      .locator("#currentPortfolioInquiry .noRecord")
      .waitFor({ state: "detached", timeout: 30000 });
    return page;
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
