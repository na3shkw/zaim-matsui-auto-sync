import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";
import type { MatsuiAuthenticationCode } from "../../types/index.js";
import { logger } from "../logger.js";

dayjs.extend(customParseFormat);

const {
  AUTH_CODE_POLLING_INTERVAL_SECONDS,
  AUTH_CODE_POLLING_TIMEOUT_SECONDS,
  GOOGLE_MESSAGE_MATSUI_CONVERSATION_URL,
  CHROMIUM_USER_DATA_DIR_GOOGLE,
  HEADLESS,
} = process.env;

const AUTH_CODE_REGEX = /認証番号：(\d{6})/;
const TIMESTAMP_REGEX = /(\d{4}年\d{1,2}月\d{1,2}日 \d{1,2}:\d{1,2}) に受信しました。/;
const POLLING_INTERVAL_SECONDS = parseInt(AUTH_CODE_POLLING_INTERVAL_SECONDS ?? "10", 10);
const POLLING_TIMEOUT_SECONDS = parseInt(AUTH_CODE_POLLING_TIMEOUT_SECONDS ?? "60", 10);
const AUTH_CODE_VALIDITY_DURATION_MINUTES = 3;

const MESSAGE_SELECTOR = "mws-text-message-part";

/**
 * `aria-label` のテキストからタイムスタンプをパースしてdayjsオブジェクトを返す。
 * @param text `aria-label`のテキスト
 * @returns {dayjs.Dayjs | null} パースされたdayjsオブジェクト
 */
function parseTimestamp(text: string): dayjs.Dayjs | null {
  const match = text.match(TIMESTAMP_REGEX);
  if (!match || !match[1]) return null;

  // dayjsのカスタムパースフォーマットを使用
  const format = "YYYY年M月D日 HH:mm";
  const parsedDate = dayjs(match[1], format);

  return parsedDate.isValid() ? parsedDate : null;
}

/**
 * Googleメッセージのページから松井証券の認証コードを検索して返す。
 *
 * @param page PlaywrightのPageオブジェクト
 * @returns 発見した認証コードとタイムスタンプ
 */
async function findAuthenticationCode(page: Page): Promise<MatsuiAuthenticationCode | null> {
  const messages = await page.$$(MESSAGE_SELECTOR);

  // 新しいメッセージから順にチェック
  for (const message of messages.reverse()) {
    const ariaLabel = await message.getAttribute("aria-label");
    if (!ariaLabel) continue;

    const authCodeMatch = ariaLabel.match(AUTH_CODE_REGEX);
    const timestampDayjs = parseTimestamp(ariaLabel);

    if (authCodeMatch && authCodeMatch[1] && timestampDayjs) {
      // タイムスタンプが3分以内かチェック
      // dayjs().diff(timestampDayjs, 'minute') は現在時刻 - タイムスタンプ の差分（分）を返す
      if (dayjs().diff(timestampDayjs, "minute") < AUTH_CODE_VALIDITY_DURATION_MINUTES) {
        return {
          authenticationCode: parseInt(authCodeMatch[1], 10),
          timestamp: timestampDayjs,
        };
      }
    }
  }
  return null;
}

/**
 * 松井証券からSMSで送信されたログイン認証番号を取得する。
 *
 * @returns {Promise<MatsuiAuthenticationCode>} 認証コードとタイムスタンプ
 */
export async function getAuthenticationCode(): Promise<MatsuiAuthenticationCode> {
  if (!GOOGLE_MESSAGE_MATSUI_CONVERSATION_URL || !CHROMIUM_USER_DATA_DIR_GOOGLE) {
    throw new Error(
      "環境変数 GOOGLE_MESSAGE_MATSUI_CONVERSATION_URL または CHROMIUM_USER_DATA_DIR_GOOGLE が設定されていません。"
    );
  }

  let browserContext: BrowserContext | null = null;

  try {
    browserContext = await chromium.launchPersistentContext(CHROMIUM_USER_DATA_DIR_GOOGLE, {
      headless: HEADLESS === "true",
    });
    const page = browserContext.pages()[0];
    if (!page) {
      throw Error("予期せぬエラーによりページを開けません。");
    }

    await page.goto(GOOGLE_MESSAGE_MATSUI_CONVERSATION_URL);

    // 読み込みが完了するまで待機する
    await page.locator("mws-message-part-content").last().waitFor({ state: "visible" });

    const startTime = dayjs();

    // ここでポーリングが終わるまで待つ
    const result = await new Promise<MatsuiAuthenticationCode>((resolve, reject) => {
      const poll = async () => {
        // タイムアウトチェック
        if (dayjs().diff(startTime, "second") > POLLING_TIMEOUT_SECONDS) {
          reject(new Error("認証コードの取得がタイムアウトしました。"));
          return;
        }

        // 認証コードを検索
        const code = await findAuthenticationCode(page);
        if (code) {
          resolve(code);
          return;
        }

        logger.info(`認証コードは未着です。${POLLING_INTERVAL_SECONDS} 秒後に再度確認します。`);
        setTimeout(poll, POLLING_INTERVAL_SECONDS * 1000);
      };

      poll();
    });

    return result;
  } catch (error) {
    logger.error(error, "認証コードの取得中にエラーが発生しました。");
    throw error;
  } finally {
    if (browserContext) {
      await browserContext.close();
    }
  }
}
