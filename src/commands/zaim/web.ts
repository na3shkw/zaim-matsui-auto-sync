import { Command } from "commander";
import dayjs from "dayjs";
import path from "path";
import readline from "readline";
import { configureLogger, logger } from "../../modules/logger.js";
import { ZaimWebRegistrar } from "../../modules/zaim-web/client.js";
import { inspectZaimWeb } from "../../modules/zaim-web/inspect.js";

const { CHROMIUM_USER_DATA_DIR_ZAIM, ERROR_LOG_DIR } = process.env;

/**
 * ターミナルで Enter が押されるまで待機する
 *
 * @param message 表示するメッセージ
 */
async function waitForEnter(message: string): Promise<void> {
  console.log(message);
  const rl = readline.createInterface({ input: process.stdin });
  await new Promise((resolve) => rl.once("line", resolve));
  rl.close();
}

/**
 * ブラウザを使用する処理を実行し、終了時にブラウザを閉じる
 *
 * @param prettyLog 整形されたログを出力するか
 * @param registrar 使用する登録クライアント
 * @param run 実行する処理
 */
async function runWithRegistrar(
  prettyLog: boolean,
  registrar: ZaimWebRegistrar,
  run: () => Promise<void>,
): Promise<void> {
  configureLogger(prettyLog ? "pretty" : "default");
  try {
    await run();
  } catch (error) {
    logger.error(error, "処理中にエラーが発生しました。");
    process.exitCode = 1;
  } finally {
    await registrar.close();
  }
}

export const webCommand = new Command("web").description(
  "Zaim のウェブ画面を操作するコマンド（Zaim API を使用しない）",
);

webCommand
  .command("login")
  .description("Zaim にログインし、セッションを保存する（保存済みのセッションが有効な場合はそれを使用する）")
  .option("--pretty-log", "整形されたログを出力する", false)
  .action(async (options) => {
    const registrar = new ZaimWebRegistrar();
    await runWithRegistrar(options.prettyLog, registrar, async () => {
      await registrar.login();
      logger.info("Zaim にログインしている状態です。");
    });
  });

webCommand
  .command("register-income")
  .description("入金を登録する（日付は当日のみ）")
  .requiredOption("--category-id <value>", "カテゴリID")
  .requiredOption("--amount <value>", "小数点なしの金額（マイナスも可）")
  .option("--to-account-id [value]", "入金先の口座ID")
  .option("--comment [value]", "コメント")
  .option("--dry-run", "入力と検証までを行い、「入力する」ボタンは押さない", false)
  .option("--wait", "終了前に Enter の入力を待つ（ブラウザで入力内容を確認する場合に使用）", false)
  .option("--pretty-log", "整形されたログを出力する", false)
  .action(async (options) => {
    const registrar = new ZaimWebRegistrar({ submit: !options.dryRun });
    await runWithRegistrar(options.prettyLog, registrar, async () => {
      const amount = Number(options.amount);
      const categoryId = Number(options.categoryId);
      const toAccountId = options.toAccountId ? Number(options.toAccountId) : undefined;
      if (![amount, categoryId, toAccountId ?? 0].every(Number.isInteger)) {
        throw new Error("--amount、--category-id、--to-account-id には整数を指定してください。");
      }

      await registrar.registerIncome({
        categoryId,
        amount,
        date: dayjs(),
        ...(toAccountId !== undefined ? { toAccountId } : {}),
        ...(options.comment !== undefined ? { comment: options.comment } : {}),
      });
      if (options.dryRun) {
        logger.info("ドライランのため Zaim への登録は行っていません。");
      }
      if (options.wait) {
        await waitForEnter("ブラウザで内容を確認し、Enter を押すと終了します。");
      }
    });
  });

webCommand
  .command("inspect")
  .description(
    "画面ありのブラウザを開き、手動操作中の Zaim の画面（HTML・スクリーンショット）と登録リクエストを保存する（画面構造の調査用）",
  )
  .option("--out-dir [path]", "保存先ディレクトリ（省略時は ERROR_LOG_DIR/zaim-inspect-<日時>）")
  .option("--pretty-log", "整形されたログを出力する", false)
  .action(async (options) => {
    configureLogger(options.prettyLog ? "pretty" : "default");
    const rl = readline.createInterface({ input: process.stdin });
    try {
      if (!CHROMIUM_USER_DATA_DIR_ZAIM) {
        throw new Error("環境変数 CHROMIUM_USER_DATA_DIR_ZAIM が設定されていません。");
      }
      let outDir: string;
      if (typeof options.outDir === "string") {
        outDir = path.resolve(options.outDir);
      } else if (ERROR_LOG_DIR) {
        outDir = path.join(ERROR_LOG_DIR, `zaim-inspect-${dayjs().format("YYYYMMDD-HHmmss")}`);
      } else {
        throw new Error("--out-dir を指定するか、環境変数 ERROR_LOG_DIR を設定してください。");
      }
      await inspectZaimWeb({ userDataDir: CHROMIUM_USER_DATA_DIR_ZAIM, outDir, input: rl });
    } catch (error) {
      logger.error(error, "処理中にエラーが発生しました。");
      process.exitCode = 1;
    } finally {
      rl.close();
    }
  });
