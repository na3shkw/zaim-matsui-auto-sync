import { Command } from "commander";
import dayjs from "dayjs";
import fs from "fs";
import { logger, scrapeMatsui, Zaim } from "../modules/index.js";

const { ZAIM_MATSUI_INCOME_CATEGORY_ID, ZAIM_MATSUI_ACCOUNT_ID, ZAIM_TOTAL_AMOUNT_FILE } =
  process.env;

interface lastTotalAmount {
  accountId: number;
  amount: number;
  updatedAt: string;
}

const program = new Command();

program
  .name("sync-matsui-zaim")
  .description("松井証券の資産情報をZaimに同期する")
  .action(async () => {
    try {
      if (!ZAIM_MATSUI_INCOME_CATEGORY_ID || !ZAIM_MATSUI_ACCOUNT_ID || !ZAIM_TOTAL_AMOUNT_FILE) {
        const vars = [
          "ZAIM_MATSUI_INCOME_CATEGORY_ID",
          "ZAIM_MATSUI_ACCOUNT_ID",
          "ZAIM_TOTAL_AMOUNT_FILE",
        ];
        throw new Error(`環境変数 ${vars.join(" または ")} が設定されていません。`);
      }

      // NISA資産状況を取得
      logger.info("NISA資産状況を取得します。");
      const nisaData = await scrapeMatsui();
      logger.info("NISA資産状況の取得が完了しました。");

      // 前回記録時点の総額との差分を取得
      logger.info("総額記録ファイルを取得します。");
      const isAmountFileExists = fs.existsSync(ZAIM_TOTAL_AMOUNT_FILE);
      let lastTotalAmount: lastTotalAmount[] = [];
      let nisaLastAmount: lastTotalAmount | undefined = undefined;
      let nisaLastAmountValue: number | undefined = undefined;
      const accountId = parseInt(ZAIM_MATSUI_ACCOUNT_ID, 10);
      if (isAmountFileExists) {
        lastTotalAmount = JSON.parse(
          fs.readFileSync(ZAIM_TOTAL_AMOUNT_FILE, { encoding: "utf-8" })
        );
        if (!lastTotalAmount) {
          throw new Error("総額記録ファイルの中身が空です。");
        }
        nisaLastAmount = lastTotalAmount.find((item) => item.accountId === accountId);
        nisaLastAmountValue = nisaLastAmount?.amount;
      } else {
        // 初回実行時のみ通る想定
        logger.info("総額記録ファイルがありません。現時点の総額を0として続行します。");
        nisaLastAmountValue = 0;
      }
      if (typeof nisaLastAmountValue === "undefined") {
        throw new Error("総額を取得できませんでした。");
      }
      logger.info("総額を取得しました。");

      const amount = nisaData.nisaTotalMarketValue - nisaLastAmountValue;
      logger.info(`記録する金額は ${amount} 円です。`);

      // Zaim APIにデータを送信
      const zaim = new Zaim();
      await zaim.registerIncomeJournalEntry({
        categoryId: parseInt(ZAIM_MATSUI_INCOME_CATEGORY_ID, 10),
        amount,
        date: dayjs(),
        toAccountId: accountId,
        comment: "自動同期",
      });
      logger.info("Zaimへの記録が完了しました。");

      // 総額データを更新
      logger.info("総額データを更新します。");
      const updatedAt = dayjs().format();
      if (nisaLastAmount) {
        nisaLastAmount.amount += amount;
        nisaLastAmount.updatedAt = updatedAt;
      } else {
        lastTotalAmount?.push({
          amount,
          accountId,
          updatedAt,
        });
      }
      fs.writeFileSync(ZAIM_TOTAL_AMOUNT_FILE, JSON.stringify(lastTotalAmount, null, 2), {
        encoding: "utf-8",
      });
      logger.info("総額データを更新しました。");
    } catch (error) {
      logger.error(error, "処理中にエラーが発生しました。");
      process.exitCode = 1;
    }
  });

program.parse();
