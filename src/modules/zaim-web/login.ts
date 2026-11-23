import type { Locator, Page } from "playwright";
import { logger } from "../logger.js";
import { ZaimWebPage } from "./page.js";
import { KufuLoginSelector, KufuTwoFactorSelector } from "./selectors.js";
import { generateTotp, getTotpRemainingMs } from "./totp.js";

const { ZAIM_EMAIL, ZAIM_PASSWORD, ZAIM_TOTP_SECRET } = process.env;

/** 残り有効時間がこれ未満のワンタイムパスワードは使わず、次の周期まで待つ（ミリ秒） */
const TOTP_MIN_REMAINING_MS = 5000;
/** 次の周期のワンタイムパスワードを使う際に、周期の切り替わりから余分に待つ時間（ミリ秒） */
const TOTP_PERIOD_MARGIN_MS = 1000;
/** 2段階認証のコードを入力する最大回数（拒否された場合に次の周期のコードで再試行する） */
const TOTP_MAX_ATTEMPTS = 2;
/** フォーム送信後の画面遷移を待つ時間（ミリ秒） */
const NAVIGATION_TIMEOUT_MS = 30000;

/**
 * URL が Zaim 上のページかどうかを判定する
 *
 * @param url 判定するURL
 * @returns Zaim 上のページであれば true
 */
function isZaimUrl(url: URL): boolean {
  return url.origin === ZaimWebPage.zaimOrigin && !url.pathname.startsWith("/user_session");
}

/**
 * URL がくふうアカウントのログイン関連ページ（/signin 配下）かどうかを判定する
 *
 * @param url 判定するURL
 * @returns ログイン関連ページであれば true
 */
function isKufuSigninUrl(url: URL): boolean {
  return url.origin === ZaimWebPage.kufuIdOrigin && url.pathname.startsWith("/signin");
}

/**
 * 指定したページを開き、Zaim にログイン済みかどうかを判定する
 *
 * 未ログインの場合は、くふうアカウントのログインページへリダイレクトされる。
 *
 * @param page PlaywrightのPageオブジェクト
 * @param url 開くページのURL（既定: Zaim のホーム）
 * @returns ログイン済みであれば true
 */
export async function isZaimSessionValid(
  page: Page,
  url: string = ZaimWebPage.home,
): Promise<boolean> {
  try {
    await page.goto(url, { timeout: 15000 });
    return isZaimUrl(new URL(page.url()));
  } catch (error) {
    logger.error(error, "Zaim のセッション有効性チェック中にエラーが発生しました。");
    return false;
  }
}

/**
 * 指定時間待機する
 *
 * @param ms 待機時間（ミリ秒）
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 有効期限に余裕のあるワンタイムパスワードを生成する
 *
 * @param secret Base32 形式のシークレットキー
 * @returns ワンタイムパスワード
 */
async function generateFreshTotp(secret: string): Promise<string> {
  const remainingMs = getTotpRemainingMs();
  if (remainingMs < TOTP_MIN_REMAINING_MS) {
    logger.info(`ワンタイムパスワードの残り有効時間が短いため、${remainingMs} ミリ秒待機します。`);
    await sleep(remainingMs + TOTP_PERIOD_MARGIN_MS);
  }
  return generateTotp(secret);
}

/**
 * フォームを送信し、遷移先のURLを返す
 *
 * 送信後に読み込まれたページがくふうアカウントのログイン関連ページ（2段階認証画面やエラー表示）であれば
 * そのURLを返し、それ以外の場合は Zaim のページに到達するまで待つ。
 *
 * @param page PlaywrightのPageオブジェクト
 * @param submit 送信ボタンのロケーター
 * @returns 遷移先のURL
 */
async function submitAndWait(page: Page, submit: Locator): Promise<URL> {
  await Promise.all([
    page.waitForEvent("load", { timeout: NAVIGATION_TIMEOUT_MS }),
    submit.click(),
  ]);
  const url = new URL(page.url());
  if (isKufuSigninUrl(url)) return url;
  await page.waitForURL(isZaimUrl, { timeout: NAVIGATION_TIMEOUT_MS });
  return new URL(page.url());
}

/**
 * ログイン画面に表示されているエラーメッセージを取得する
 *
 * @param page PlaywrightのPageオブジェクト
 * @returns エラーメッセージ（取得できない場合は空文字列）
 */
async function getSigninErrorMessage(page: Page): Promise<string> {
  try {
    const texts = await page.locator(KufuLoginSelector.errorMessage).allInnerTexts();
    return texts
      .map((text) => text.trim())
      .filter(Boolean)
      .join(" / ");
  } catch {
    return "";
  }
}

/**
 * 2段階認証のコードを入力して送信する
 *
 * コードが拒否された場合（2段階認証画面に留まった場合）は、次の周期のコードで再試行する。
 *
 * @param page PlaywrightのPageオブジェクト
 * @param secret Base32 形式のシークレットキー
 */
async function submitTotp(page: Page, secret: string): Promise<void> {
  for (let attempt = 1; attempt <= TOTP_MAX_ATTEMPTS; attempt++) {
    await page.fill(KufuTwoFactorSelector.passcode, await generateFreshTotp(secret));
    logger.info(`2段階認証のコードを入力しました（${attempt}/${TOTP_MAX_ATTEMPTS} 回目）。`);

    const url = await submitAndWait(page, page.locator(KufuTwoFactorSelector.submit));
    if (isZaimUrl(url)) return;

    if (url.pathname !== ZaimWebPage.kufuTotpPath) {
      throw new Error(`2段階認証の後に予期しないページへ遷移しました: ${url.href}`);
    }
    if (attempt < TOTP_MAX_ATTEMPTS) {
      // 同じ周期内のコードの再利用を拒否される場合があるため、次の周期まで待ってから再試行する
      const waitMs = getTotpRemainingMs() + TOTP_PERIOD_MARGIN_MS;
      logger.warn(
        `2段階認証のコードが受け付けられませんでした。${waitMs} ミリ秒後に次のコードで再試行します。`,
      );
      await sleep(waitMs);
    }
  }
  const message = await getSigninErrorMessage(page);
  throw new Error(
    `2段階認証のコードが受け付けられませんでした。環境変数 ZAIM_TOTP_SECRET を確認してください。${message ? `（画面の表示: ${message}）` : ""}`,
  );
}

/**
 * くふうアカウント（メールアドレス・パスワード＋認証アプリの2段階認証）で Zaim にログインする
 *
 * 2段階認証が無効なアカウントの場合は、パスワード認証のみでログインを完了する。
 *
 * @param page PlaywrightのPageオブジェクト
 */
export async function loginToZaim(page: Page): Promise<void> {
  if (!ZAIM_EMAIL || !ZAIM_PASSWORD) {
    throw new Error("環境変数 ZAIM_EMAIL または ZAIM_PASSWORD が設定されていません。");
  }

  await page.goto(ZaimWebPage.login);
  await page.locator(KufuLoginSelector.email).waitFor({ state: "visible" });

  await page.fill(KufuLoginSelector.email, ZAIM_EMAIL);
  await page.fill(KufuLoginSelector.password, ZAIM_PASSWORD);
  logger.info("Zaim のログイン情報を入力しました。");

  // 2段階認証が有効な場合は2段階認証画面へ、無効な場合は Zaim へ遷移する
  const url = await submitAndWait(page, page.locator(KufuLoginSelector.submit));
  logger.info("Zaim のログインボタンをクリックしました。");

  if (url.pathname === ZaimWebPage.kufuTotpPath) {
    if (!ZAIM_TOTP_SECRET) {
      throw new Error(
        "2段階認証を求められましたが、環境変数 ZAIM_TOTP_SECRET が設定されていません。",
      );
    }
    await submitTotp(page, ZAIM_TOTP_SECRET);
  } else if (!isZaimUrl(url)) {
    // ログイン画面に留まった場合は、メールアドレスまたはパスワードの誤りとみなす
    const message = await getSigninErrorMessage(page);
    throw new Error(
      `Zaim にログインできませんでした。環境変数 ZAIM_EMAIL・ZAIM_PASSWORD が正しいか確認してください（URL: ${url.origin}${url.pathname}）。${message ? `画面の表示: ${message}` : ""}`,
    );
  }

  logger.info("Zaim へのログインが完了しました。");
}
