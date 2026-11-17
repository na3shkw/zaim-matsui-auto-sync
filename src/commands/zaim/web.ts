import { Command } from "commander";
import dayjs from "dayjs";
import path from "path";
import { logger } from "../../modules/logger.js";
import { createInputInterface, getUserInput, parseNumber } from "../../modules/utils.js";
import { ZaimWebRegistrar } from "../../modules/zaim-web/client.js";
import { inspectZaimWeb } from "../../modules/zaim-web/inspect.js";
import { runAction } from "../run-action.js";

const { CHROMIUM_USER_DATA_DIR_ZAIM, ERROR_LOG_DIR } = process.env;

/**
 * コマンドライン引数を 0 以外の整数に変換する（空文字・非数値・小数・0 はエラー）
 *
 * @param name 引数名（エラーメッセージ用）
 * @param value 指定された値
 * @returns 変換された整数
 */
function parseNonZeroInteger(name: string, value: string): number {
  const parsed = value.trim() === "" ? undefined : parseNumber(value);
  if (parsed === undefined || !Number.isInteger(parsed) || parsed === 0) {
    throw new Error(`${name} には 0 以外の整数を指定してください（指定値: "${value}"）。`);
  }
  return parsed;
}

export const webCommand = new Command("web").description(
  "Zaim のウェブ画面を操作するコマンド（Zaim API を使用しない）",
);

webCommand
  .command("login")
  .description(
    "Zaim にログインし、セッションを保存する（保存済みのセッションが有効な場合はそれを使用する）",
  )
  .option("--pretty-log", "整形されたログを出力する", false)
  .action(async (options) => {
    const registrar = new ZaimWebRegistrar();
    await runAction(
      options.prettyLog,
      async () => {
        await registrar.login();
        logger.info("Zaim にログインしている状態です。");
      },
      () => registrar.close(),
    );
  });

webCommand
  .command("register-income")
  .description("入金を登録する（日付は当日のみ）")
  .requiredOption("--category-id <value>", "カテゴリID")
  .requiredOption("--amount <value>", "小数点なしの金額（マイナスも可）")
  .option("--to-account-id <value>", "入金先の口座ID")
  .option("--comment <value>", "コメント")
  .option("--dry-run", "入力と検証までを行い、「入力する」ボタンは押さない", false)
  .option("--wait", "終了前に Enter の入力を待つ（ブラウザで入力内容を確認する場合に使用）", false)
  .option("--pretty-log", "整形されたログを出力する", false)
  .action(async (options) => {
    const registrar = new ZaimWebRegistrar();
    await runAction(
      options.prettyLog,
      async () => {
        const amount = parseNonZeroInteger("--amount", options.amount);
        const categoryId = parseNonZeroInteger("--category-id", options.categoryId);
        const toAccountId =
          options.toAccountId !== undefined
            ? parseNonZeroInteger("--to-account-id", options.toAccountId)
            : undefined;

        await registrar.registerIncome(
          {
            categoryId,
            amount,
            date: dayjs(),
            ...(toAccountId !== undefined ? { toAccountId } : {}),
            ...(options.comment !== undefined ? { comment: options.comment } : {}),
          },
          { dryRun: options.dryRun },
        );
        if (options.wait) {
          await getUserInput("ブラウザで内容を確認し、Enter を押すと終了します。");
        }
      },
      () => registrar.close(),
    );
  });

webCommand
  .command("inspect")
  .description(
    "画面ありのブラウザを開き、手動操作中の Zaim の画面（HTML・スクリーンショット）と登録リクエストを保存する（画面構造の調査用）",
  )
  .option("--out-dir <path>", "保存先ディレクトリ（省略時は ERROR_LOG_DIR/zaim-inspect-<日時>）")
  .option("--pretty-log", "整形されたログを出力する", false)
  .action(async (options) => {
    // 画面の保存（Enter）と終了（q）の指示を複数行にわたって受け付ける
    const rl = createInputInterface();
    await runAction(
      options.prettyLog,
      async () => {
        if (!CHROMIUM_USER_DATA_DIR_ZAIM) {
          throw new Error("環境変数 CHROMIUM_USER_DATA_DIR_ZAIM が設定されていません。");
        }
        let outDir: string;
        if (options.outDir !== undefined) {
          outDir = path.resolve(options.outDir);
        } else if (ERROR_LOG_DIR) {
          outDir = path.join(ERROR_LOG_DIR, `zaim-inspect-${dayjs().format("YYYYMMDD-HHmmss")}`);
        } else {
          throw new Error("--out-dir を指定するか、環境変数 ERROR_LOG_DIR を設定してください。");
        }
        await inspectZaimWeb({ userDataDir: CHROMIUM_USER_DATA_DIR_ZAIM, outDir, input: rl });
      },
      () => rl.close(),
    );
  });
