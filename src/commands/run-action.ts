import { configureLogger, logger } from "../modules/logger.js";

/**
 * コマンドの処理を実行する
 *
 * ロガーを設定して処理を実行し、エラー発生時はログを出力して終了コードを 1 にする。
 * 後片付けは成否にかかわらず実行する。
 *
 * @param prettyLog 整形されたログを出力するか
 * @param run 実行する処理
 * @param cleanup 後片付けの処理
 */
export async function runAction(
  prettyLog: boolean,
  run: () => Promise<void>,
  cleanup?: () => Promise<void> | void,
): Promise<void> {
  configureLogger(prettyLog ? "pretty" : "default");
  try {
    await run();
  } catch (error) {
    logger.error(error, "処理中にエラーが発生しました。");
    process.exitCode = 1;
  } finally {
    await cleanup?.();
  }
}
