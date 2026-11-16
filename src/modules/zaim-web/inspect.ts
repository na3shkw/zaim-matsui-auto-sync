import fs from "fs";
import path from "path";
import type { Interface } from "readline";
import type { Page, Request } from "playwright";
import { logger } from "../logger.js";
import { PersistentBrowser } from "../browser.js";
import { ZaimWebPage } from "./page.js";

/** 記録対象とするリクエストのHTTPメソッド */
const RECORDED_METHODS = ["POST", "PUT", "PATCH"];

/** 表示上の金額（例: `¥8,380`、`¥-436`）のパターン */
const DISPLAY_AMOUNT_PATTERN = /¥-?[\d,]+/g;
/** 表示上の金額の置換後の文字列 */
const MASKED_DISPLAY_AMOUNT = "¥*******";

export interface InspectOptions {
  /** ブラウザのユーザーデータディレクトリ */
  userDataDir: string;
  /** HTML・スクリーンショット・リクエストログの保存先 */
  outDir: string;
  /** 手動保存・終了の指示を受け付ける入力 */
  input: Interface;
}

/**
 * 保存するファイルの名前（拡張子なし）を生成する
 *
 * @param seq 連番
 * @param label 保存のきっかけ（nav: ページ遷移、manual: 手動）
 * @param url ページのURL
 * @returns ファイル名
 */
export function buildSnapshotName(seq: number, label: string, url: string): string {
  const { hostname, pathname } = new URL(url);
  return `${String(seq).padStart(2, "0")}-${label}-${hostname}${pathname}`
    .replace(/[^a-zA-Z0-9.-]+/g, "_")
    .slice(0, 120);
}

/**
 * HTML に含まれる具体的な金額をマスクする
 *
 * - 表示上の金額（例: `¥8,380`、`¥-436`）を `¥*******` に置換する
 * - 埋め込みデータの `"amount":<数値>` および `"y":<数値>`（グラフの値）を 0 に置換する
 *
 * @param html 保存する HTML
 * @returns 金額をマスクした HTML
 */
export function maskAmounts(html: string): string {
  return html
    .replace(DISPLAY_AMOUNT_PATTERN, MASKED_DISPLAY_AMOUNT)
    .replace(/"(amount|y)":-?\d+(\.\d+)?/g, '"$1":0');
}

/**
 * 表示中のページの金額を一時的にマスクした状態でスクリーンショットを保存する
 *
 * ページ内のテキストノードの金額を置換して撮影し、撮影後に元のテキストへ戻す。
 * 手動操作中のページの表示や React の描画状態を壊さないよう、置換は撮影中のみに限定する。
 * canvas に描画された金額はマスクできない。
 *
 * @param page PlaywrightのPageオブジェクト
 * @param filePath 保存先のファイルパス
 */
export async function screenshotWithMaskedAmounts(page: Page, filePath: string): Promise<void> {
  const pattern = { source: DISPLAY_AMOUNT_PATTERN.source, replacement: MASKED_DISPLAY_AMOUNT };
  const handle = await page.evaluateHandle(({ source, replacement }) => {
    const regex = new RegExp(source, "g");
    const originals: { node: Text; text: string }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue ?? "";
      const masked = text.replace(regex, replacement);
      if (masked !== text) {
        originals.push({ node: node as Text, text });
        node.nodeValue = masked;
      }
    }
    return originals;
  }, pattern);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
  } finally {
    await handle
      .evaluate((originals) => {
        for (const { node, text } of originals) node.nodeValue = text;
      })
      .catch(() => {});
    await handle.dispose().catch(() => {});
  }
}

/**
 * リクエストを記録対象とするか判定する
 *
 * Zaim への更新系リクエストのみを対象とし、くふうアカウント（id.kufu.jp）への
 * リクエストはパスワード等を含むため記録しない。
 *
 * @param method HTTPメソッド
 * @param url リクエストURL
 * @returns 記録対象であれば true
 */
export function shouldRecordRequest(method: string, url: string): boolean {
  const { hostname } = new URL(url);
  const zaimHostname = new URL(ZaimWebPage.zaimOrigin).hostname;
  return (
    (hostname === zaimHostname || hostname.endsWith(`.${zaimHostname}`)) &&
    RECORDED_METHODS.includes(method)
  );
}

/**
 * Zaim のウェブ画面の構造を調査する
 *
 * 画面ありのブラウザを開き、手動操作中のページ遷移ごと、および入力で Enter が押されたタイミングで
 * HTML とスクリーンショットを保存する（いずれも金額はマスクする）。Zaim への更新系リクエストの内容も記録する。
 * "q" が入力されると終了し、手動ログインしたセッションを保存する。
 *
 * @param options 調査の設定
 */
export async function inspectZaimWeb({ userDataDir, outDir, input }: InspectOptions): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });

  const browser = new PersistentBrowser(userDataDir, { headless: false, restoreStorageState: true });
  const { browserContext, page } = await browser.open();

  let seq = 0;
  const snapshot = async (target: Page, label: string) => {
    try {
      await target.waitForLoadState("domcontentloaded");
      const name = buildSnapshotName(++seq, label, target.url());
      fs.writeFileSync(path.join(outDir, `${name}.html`), maskAmounts(await target.content()));
      await screenshotWithMaskedAmounts(target, path.join(outDir, `${name}.png`));
      logger.info(`画面を保存しました: ${name}`);
    } catch (error) {
      logger.warn({ err: error }, "画面の保存に失敗しました。");
    }
  };

  // ページ遷移と手動保存の画面保存が重なると、一時的なマスクの置換・復元が交錯して
  // 金額が写る場合があるため、保存処理は1本のキューで直列に実行する
  let queue: Promise<void> = Promise.resolve();
  const enqueueSnapshot = (target: Page, label: string): Promise<void> =>
    (queue = queue.then(() => snapshot(target, label)));

  const requestLog = path.join(outDir, "requests.jsonl");
  browserContext.on("request", (req: Request) => {
    if (!shouldRecordRequest(req.method(), req.url())) return;
    fs.appendFileSync(
      requestLog,
      JSON.stringify({ method: req.method(), url: req.url(), postData: req.postData() }) + "\n",
    );
    logger.info(`リクエストを記録しました: ${req.method()} ${req.url()}`);
  });

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) void enqueueSnapshot(page, "nav");
  });

  try {
    await page.goto(ZaimWebPage.home);

    console.log(`
=== Zaim 画面調査 ===
1. ブラウザで手動ログインしてください（2段階認証の画面も自動保存されます）。
2. 調べたい画面（収入の入力画面など）を開いてください。
3. タブの切り替えやプルダウンを開いた状態など、ページ遷移を伴わない変化のたびに
   Enter を押すと、その時点の画面を保存します。
4. 登録処理を調べる場合は、テスト用に少額のデータを登録してください（登録リクエストの形式を記録します）。
   登録したデータは調査後に削除してください。
5. 終了するには "q" を入力して Enter を押してください。
保存先: ${outDir}
`);

    for await (const line of input) {
      if (line.trim() === "q") break;
      await enqueueSnapshot(browserContext.pages().at(-1) ?? page, "manual");
    }
  } finally {
    // 保存待ちの画面をすべて保存してから閉じる（手動ログインしたセッションも保存される）
    await queue;
    await browser.close();
  }
}
