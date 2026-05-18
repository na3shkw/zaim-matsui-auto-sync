import type { Page } from "playwright";
import { logger } from "../../logger.js";
import { MatsuiPage } from "../page.js";

/**
 * 松井証券トップから米国株サイトの新タブを開いて返す。
 * iframe経由のナビゲーションを UsStockStrategy と UsStockPowerStrategy で共用する。
 */
export async function openUsStockTab(page: Page): Promise<Page> {
  await page.goto(MatsuiPage.tradeMemberHome);

  // ヘッダの「米国株」メニューから辿るとブラウザの実行環境起因でエラー画面になってしまうため、資産状況ページから辿る。

  const assetStatusLink = page.locator('[data-page="asset-status-top"]');
  await assetStatusLink.click();
  logger.info("資産状況ページに遷移しました。");

  const assetStatusListButton = page.locator(".btn-menu-asset-status-list:visible").first();
  await assetStatusListButton.waitFor({ state: "visible", timeout: 10000 });
  await assetStatusListButton.click();
  logger.info("資産状況一覧ページに遷移しました。");

  const usStockMarketValueLink = page.locator("a").filter({ hasText: "米国株式時価総額" });
  await usStockMarketValueLink.waitFor({ state: "visible", timeout: 10000 });
  await usStockMarketValueLink.click();
  logger.info("米国株式時価総額リンクをクリックしました。");

  const iframe = page.frameLocator("#net-stock-contents");
  logger.info("iframeの読み込みを待機中...");

  const ctFrame = iframe.frameLocator('frame[name="CT"]');
  logger.info("CTフレームを取得しました。");

  const usStockLink = ctFrame.locator("a").filter({ hasText: "米国株サイト" });
  await usStockLink.waitFor({ state: "visible", timeout: 10000 });
  await usStockLink.click();
  logger.info("「米国株サイト」リンクをクリックしました。");

  const launchButton = ctFrame.locator('a:has(img[name="kidouButton"])');
  await launchButton.waitFor({ state: "visible", timeout: 30000 });
  logger.info("起動ボタンが表示されました。");

  const [newPage] = await Promise.all([page.context().waitForEvent("page"), launchButton.click()]);
  logger.info("米国株用サイトの起動ボタンをクリックしました。");

  await newPage.waitForLoadState("networkidle");
  logger.info("米国株用サイトが起動しました。");

  const notificationTitle = newPage.locator("text=お客様へのご連絡");
  const isNotificationVisible = await notificationTitle
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (isNotificationVisible) {
    const laterButton = newPage.locator("div.btn").filter({ hasText: "あとで確認" });
    await laterButton.click();
    logger.info("「あとで確認」ボタンをクリックしました。");
    await newPage.waitForLoadState("networkidle");
  }

  return newPage;
}
